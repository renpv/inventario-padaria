import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export type UserRole = 'operacional' | 'gestao' | 'unauthenticated';

interface AuthContextType {
  role: UserRole;
  isOnline: boolean;
  /** false enquanto a sessão anônima operacional está sendo restaurada após um reload. */
  authReady: boolean;
  loginWithPIN: (pin: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Chaves usadas para cachear manualmente os tokens da sessão do Supabase
// Auth, já que persistSession está desabilitado no client (ver
// supabaseClient.ts) — sem isso, um reload perde a sessão em memória mesmo
// com o role ainda salvo em `user_role`. Guardamos apenas o essencial para
// restaurar via supabase.auth.setSession() (que renova o access_token a
// partir do refresh_token quando necessário).
//
// Duas chaves separadas (em vez de uma genérica) para não misturar: a
// operacional pode sempre se auto-renovar criando outro usuário anônimo se o
// cache expirar, a de gestão não (só o login OAuth real emite uma nova).
const ANON_SESSION_KEY = 'operacional_anon_session';
const GESTAO_SESSION_KEY = 'gestao_session';

interface CachedSession {
  access_token: string;
  refresh_token: string;
}

const loadCachedSession = (key: string): CachedSession | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CachedSession) : null;
  } catch {
    return null;
  }
};

const saveCachedSession = (key: string, session: CachedSession) => {
  localStorage.setItem(key, JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }));
};

const clearCachedSession = (key: string) => localStorage.removeItem(key);

// Chamadas concorrentes para a MESMA chave (ex.: o efeito de mount rodando
// duas vezes sob React StrictMode em desenvolvimento) precisam esperar a
// mesma tentativa em vez de disparar duas independentes: o Supabase rotaciona
// o refresh_token a cada uso (e signInAnonymously cria um usuário por
// chamada), então uma segunda chamada concorrente usaria um token que a
// primeira já invalidou (ou criaria uma conta anônima extra à toa).
const inFlight = new Map<string, Promise<boolean>>();

const dedupe = (key: string, fn: () => Promise<boolean>): Promise<boolean> => {
  const existing = inFlight.get(key);
  if (existing) return existing;

  const attempt = fn();
  inFlight.set(key, attempt);
  attempt.finally(() => inFlight.delete(key));
  return attempt;
};

/** Tenta restaurar uma sessão a partir do cache em `key`. Não cria sessão nova. */
const restoreCachedSession = (key: string): Promise<boolean> =>
  dedupe(`restore:${key}`, async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) return true;

    const cached = loadCachedSession(key);
    if (!cached) return false;

    const { data, error } = await supabase.auth.setSession(cached);
    if (error || !data.session) {
      // Refresh token expirado/inválido: descarta o cache.
      clearCachedSession(key);
      return false;
    }

    saveCachedSession(key, data.session);
    return true;
  });

/**
 * Garante que o client Supabase tenha uma sessão anônima válida, reaproveitando
 * a sessão cacheada sempre que possível e só criando um usuário anônimo novo
 * via signInAnonymously() quando não há cache ou o refresh token salvo não é
 * mais válido. Necessário porque o Supabase limita a taxa de criação de
 * usuários anônimos, e cada PIN login gerando uma conta nova esgota essa cota
 * rapidamente com vários operadores usando o app ao longo do turno.
 */
const ensureAnonymousSession = (): Promise<boolean> =>
  dedupe(`ensure:${ANON_SESSION_KEY}`, async () => {
    if (await restoreCachedSession(ANON_SESSION_KEY)) return true;

    const { data, error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError || !data.session) {
      console.error('Falha ao iniciar sessão operacional:', anonError?.message);
      return false;
    }

    saveCachedSession(ANON_SESSION_KEY, data.session);
    return true;
  });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>(() => {
    return (localStorage.getItem('user_role') as UserRole) || 'unauthenticated';
  });
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const savedRoleOnMount = localStorage.getItem('user_role') as UserRole;
  const [authReady, setAuthReady] = useState<boolean>(
    savedRoleOnMount !== 'operacional' && savedRoleOnMount !== 'gestao'
  );

  useEffect(() => {
    // Sync connection status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // O client não persiste sessão (persistSession: false), então um reload
    // perde a sessão do Supabase Auth em memória mesmo com o role ainda salvo
    // em `user_role` — sem isso, as consultas protegidas por RLS rodariam sem
    // autenticação e retornariam vazio. Restauramos a sessão cacheada aqui
    // (ver ensureAnonymousSession/restoreCachedSession) e só liberamos o
    // render das páginas protegidas (authReady) depois disso, evitando que
    // elas disparem suas próprias queries antes da sessão estar pronta.
    const savedRole = localStorage.getItem('user_role') as UserRole;
    if (savedRole === 'operacional') {
      setRole('operacional');
      ensureAnonymousSession().finally(() => setAuthReady(true));
    } else if (savedRole === 'gestao') {
      // Diferente da operacional, uma sessão de gestão não pode ser
      // reemitida por nós mesmos (só o login OAuth real faz isso) — se o
      // cache não existir ou o refresh token estiver inválido, a única opção
      // é deslogar e pedir para entrar de novo.
      restoreCachedSession(GESTAO_SESSION_KEY).then((ok) => {
        if (!ok) {
          setRole('unauthenticated');
          localStorage.removeItem('user_role');
        }
        setAuthReady(true);
      });
    }

    // Supabase Auth listener. `INITIAL_SESSION` dispara ao inscrever o
    // listener, refletindo a sessão automática do Supabase (sempre nula aqui,
    // já que persistSession é false) — ignoramos esse evento porque a
    // restauração manual acima já cobre esse caso. Só tratamos `session`
    // nulo como logout de fato em `SIGNED_OUT`.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        if (session.user.is_anonymous) {
          // Sessão anônima usada apenas para satisfazer as políticas de RLS do
          // fluxo operacional (PIN compartilhado). O papel de acesso é
          // controlado por loginWithPIN, não por esta sessão do Supabase Auth.
          return;
        }

        // Query user role in Supabase
        const { data, error } = await supabase
          .from('usuarios')
          .select('role')
          .eq('auth_user_id', session.user.id)
          .single();

        if (data && !error) {
          setRole(data.role as UserRole);
          localStorage.setItem('user_role', data.role);
          if (data.role === 'gestao') {
            saveCachedSession(GESTAO_SESSION_KEY, session);
          }
        } else {
          setRole('unauthenticated');
          localStorage.removeItem('user_role');
        }
      } else if (event === 'SIGNED_OUT') {
        clearCachedSession(GESTAO_SESSION_KEY);
        if (localStorage.getItem('user_role') !== 'operacional') {
          setRole('unauthenticated');
          localStorage.removeItem('user_role');
        }
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      subscription.unsubscribe();
    };
  }, []);

  const loginWithPIN = async (pin: string): Promise<boolean> => {
    try {
      // A operação não tem login individual, mas as políticas de RLS exigem uma
      // sessão autenticada (`TO authenticated`). Por isso, garantimos uma sessão
      // anônima do Supabase Auth antes de validar o PIN. Isso requer que "Allow
      // anonymous sign-ins" esteja habilitado no projeto Supabase (Authentication
      // > Settings) — sem isso, o login operacional será recusado.
      //
      // Como persistSession está desabilitado no client, reaproveitamos a
      // sessão anônima manualmente (localStorage) em vez de criar um usuário
      // anônimo novo a cada login/reload: o Supabase limita a taxa de criação
      // de usuários anônimos, e cada PIN login gerando uma conta nova esgota
      // essa cota rapidamente com vários operadores usando o app ao longo do
      // turno (RF de autenticação operacional).
      const sessionReady = await ensureAnonymousSession();
      if (!sessionReady) {
        return false;
      }

      const { data, error } = await supabase.rpc('validar_pin', { pin_input: pin });
      if (error) {
        // Erro de rede/servidor ao validar o PIN: nunca concede acesso por
        // padrão. Um PIN só é válido se o servidor confirmar explicitamente.
        console.error('Falha ao validar PIN:', error.message);
        return false;
      }

      if (data === true) {
        setRole('operacional');
        localStorage.setItem('user_role', 'operacional');
        return true;
      }

      return false;
    } catch (err) {
      console.error('Erro inesperado ao validar PIN:', err);
      return false;
    }
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) {
      console.error('Falha ao iniciar login com Google:', error.message);
      throw error;
    }
  };

  const logout = () => {
    // Limpa o estado local de forma síncrona — o chamador (Layout.handleLogout)
    // não aguarda esta função antes de navegar para /login, então o
    // signOut() real (round-trip de rede) roda em segundo plano sem atrasar
    // a resposta visual do logout nem deixar `user_role` temporariamente
    // desatualizado em relação à URL.
    if (role === 'gestao') {
      clearCachedSession(GESTAO_SESSION_KEY);
      // Encerra a sessão real do Supabase Auth (Google OAuth). A sessão
      // anônima do fluxo operacional NÃO é invalidada aqui — continua
      // cacheada para reuso pelo próximo login por PIN (ver
      // ensureAnonymousSession), evitando criar um usuário anônimo novo a
      // cada troca de operador no mesmo dispositivo.
      supabase.auth.signOut();
    }
    setRole('unauthenticated');
    localStorage.removeItem('user_role');
  };

  return (
    <AuthContext.Provider value={{ role, isOnline, authReady, loginWithPIN, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
