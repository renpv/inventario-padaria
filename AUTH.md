# Autenticação — Detalhes de Implementação

Referenciado por [CLAUDE.md](./CLAUDE.md). Para o *comportamento* exigido (não a implementação), ver [PRD-Supabase-React-Padaria.md, seção 2.2](./PRD-Supabase-React-Padaria.md).

## Por que ambos os fluxos passam pelo Supabase Auth

`role` (o que a UI mostra/permite) e "estar autenticado no Supabase" (o que a RLS exige, `TO authenticated` em toda policy) são conceitos relacionados mas distintos. Mesmo o PIN — que não é um login individual — precisa de uma sessão Supabase por trás para que as queries não sejam recusadas pela RLS.

## Fluxo PIN (Operacional)

```typescript
// src/context/AuthContext.tsx (resumido)
const loginWithPIN = async (pin: string) => {
  const sessionReady = await ensureAnonymousSession(); // reaproveita sessão cacheada, ou cria uma nova
  if (!sessionReady) return false;
  const { data, error } = await supabase.rpc('validar_pin', { pin_input: pin });
  if (error || data !== true) return false;
  setRole('operacional');
  localStorage.setItem('user_role', 'operacional');
  return true;
};
```

O PIN nunca é comparado no cliente — `validar_pin(pin)` é uma RPC `SECURITY DEFINER` que compara contra `configuracoes.valor` (`chave='pin_operacional'`). A sessão que autentica essa chamada é **anônima** (`signInAnonymously`), só para satisfazer `TO authenticated`.

## Fluxo Google OAuth (Gestão)

- Whitelist obrigatória: e-mail precisa já existir em `usuarios` **antes** do primeiro login.
- Gatilho `handle_new_user` (`AFTER INSERT ON auth.users`): se o e-mail não constar, `RAISE EXCEPTION` — aborta a criação da conta.
- **Esse gatilho precisa ignorar sessões anônimas** (`IF new.is_anonymous THEN RETURN new; END IF;` no início) — sem essa checagem, ele também rejeita todo usuário anônimo do fluxo PIN (que não tem e-mail), quebrando o login operacional inteiro (500 "Database error creating anonymous user"). Ver migração `20260813170000_fix_anonymous_pin_login.sql`.
- Não existe login por e-mail/senha para usuários finais. A exceção é a conta de teste dedicada da suíte automatizada (ver `TEST-INSTRUCTIONS.md`), que nunca aparece na UI.

## Cache manual de sessão (por que e como)

O client roda com `persistSession: false` e `autoRefreshToken: false` — o Supabase não persiste nem restaura sessão sozinho. Sem isso, um reload perderia a sessão em memória mesmo com `role` ainda salvo em `localStorage`.

**Por quê não usar o default (`persistSession: true`)?** Historicamente essa flag foi desligada achando que a causa de um erro 500 era a persistência em si — mas a causa real era o gatilho de whitelist rejeitando sessões anônimas (ver acima). Hoje, com o gatilho corrigido, `true` provavelmente funcionaria — mas o projeto manteve `false` e gerencia a persistência manualmente, o que dá controle explícito sobre quando uma sessão nova é criada (importante para o rate limit abaixo).

**Mecanismo** (`AuthContext.tsx`):
- `ensureAnonymousSession()` / `restoreCachedSession(key)`: tenta restaurar a sessão salva (`localStorage`, chaves `operacional_anon_session` / `gestao_session`) via `setSession()` antes de criar uma nova. Só a operacional pode se auto-reemitir (`signInAnonymously()`) se o cache falhar — uma sessão de gestão expirada só é resolvida deslogando e pedindo novo login OAuth.
- `authReady` (exposto pelo `useAuth()`): `false` enquanto a sessão está sendo restaurada após reload. `ProtectedRoute` (`App.tsx`) espera isso antes de montar páginas protegidas, para que elas não disparem queries antes da sessão estar pronta.
- Chamadas concorrentes de restauração (efeito de montagem rodando duas vezes sob React StrictMode em dev) são deduplicadas por chave (`dedupe()`) — o Supabase rotaciona o refresh token a cada uso, então duas tentativas simultâneas com o mesmo token cache fariam a segunda falhar por engano.

## Rate limit de sign-in anônimo

O Supabase limita quantos usuários anônimos podem ser criados por período/projeto. Sem o cache acima, cada login/reload operacional criaria um usuário novo — poucos operadores já esgotam a cota (`over_request_rate_limit`). Configurável em Authentication → Rate Limits no painel. Confirmado na prática: mesmo o volume da suíte E2E esbarra nisso por padrão, indício de que vale revisar esse limite para o uso real esperado em produção.

## Problemas resolvidos (histórico)

| Sintoma | Causa | Correção |
|---|---|---|
| Login PIN falha com 500 "Database error creating anonymous user" | `handle_new_user` rejeitava sign-ins anônimos por falta de e-mail | Ignorar `new.is_anonymous` no gatilho |
| Rate limit de sign-in anônimo esgotado rápido | Um usuário anônimo novo por login/reload | Cache de sessão em `localStorage` + `setSession()` |
| Gestor deslogado sozinho ao dar F5 | Só a sessão PIN tinha lógica de restauração | Generalizado cache/restauração para qualquer role |
| Restaurações concorrentes invalidando uma à outra | StrictMode roda o efeito de montagem 2x, mesma refresh token usada 2x | `dedupe()` por chave de cache |
| Login com Google redireciona para localhost em produção | Site URL / Redirect URLs do Supabase sem o domínio de produção | Atualizar Authentication → URL Configuration a cada novo domínio |
