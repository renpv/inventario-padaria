# CLAUDE.md - Guia de Desenvolvimento do Projeto

**Projeto:** Padaria Inventário & WMS  
**Stack:** React 19 + TypeScript + Vite + TailwindCSS v4 + Supabase  
**Última atualização:** 2026-08-13  
**Maintainer:** Claude (session co-authored)

---

## 📋 Visão Geral Executiva

Sistema PWA de inventário por voz para padaria, com dois perfis:
- **Operacional:** PIN compartilhado (1234 em dev), sem login individual
- **Gestão:** Google OAuth com Whitelist de e-mails

Funcionalidades principais:
- Captura offline-first com Dexie (IndexedDB)
- Cálculo automático de sugestão de compra (WMS)
- Gestão de crédito/fiado com limite global
- Voice-first interface para balcão

Para o comportamento funcional completo (regras de negócio, modelo de dados, contrato de API), ver [PRD-Supabase-React-Padaria.md](./PRD-Supabase-React-Padaria.md) — este arquivo é sobre *como o código está organizado e por quê*, não sobre requisitos de produto.

---

## 🔐 Autenticação (CRÍTICO)

Ambos os fluxos de login (PIN e Google) terminam autenticando o client Supabase de alguma forma, porque as políticas de RLS de todas as tabelas exigem `TO authenticated`. `role` (o que a UI mostra/permite) e "estar autenticado no Supabase" (o que a RLS exige) são dois conceitos relacionados mas distintos — ver `src/context/AuthContext.tsx`.

### Fluxo PIN (Operacional)

O PIN em si **não** é a autenticação — é uma checagem de negócio (RPC `validar_pin`) que roda **depois** de garantir uma sessão. Como a operação não tem login individual, essa sessão é uma **sessão anônima do Supabase Auth** (`signInAnonymously`), necessária só para satisfazer `TO authenticated` na RLS.

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

**Por que reaproveitar a sessão anônima em vez de criar uma nova a cada login?** O Supabase limita a taxa de criação de usuários anônimos por projeto. Como `persistSession: false` (ver abaixo), um reload perderia a sessão em memória — sem reaproveitamento, cada login/reload criaria um usuário anônimo novo e esgotaria essa cota rapidamente com vários operadores usando o app ao longo do turno. A solução: cachear manualmente os tokens (`access_token`/`refresh_token`) em `localStorage` e restaurá-los via `supabase.auth.setSession()`, só criando uma sessão nova quando o cache não existe ou o refresh token expirou.

**PIN validado no servidor:** o PIN nunca é comparado no cliente — `validar_pin(pin)` é uma RPC `SECURITY DEFINER` que compara contra `configuracoes.valor` onde `chave='pin_operacional'`.

### Fluxo Google OAuth (Gestão)

- Whitelist obrigatória: o e-mail precisa já existir na tabela `usuarios` (pré-cadastrado por um gestor) **antes** do primeiro login.
- Gatilho no Supabase (`handle_new_user`, `AFTER INSERT ON auth.users`): se o e-mail não constar na whitelist, `RAISE EXCEPTION` — a criação da conta é abortada na camada de Auth.
- ⚠️ **Esse gatilho precisa ignorar sessões anônimas** (`IF new.is_anonymous THEN RETURN new; END IF;` no início da função) — sem essa checagem, ele também rejeita a criação de todo usuário anônimo do fluxo PIN (que não tem e-mail), quebrando o login operacional inteiro com erro 500 "Database error creating anonymous user". Ver migração `20260813170000_fix_anonymous_pin_login.sql`.
- **Sessão real também é cacheada/restaurada em reload**, pelo mesmo motivo e mecanismo do PIN (chave separada, `gestao_session`) — sem isso, um gestor logado era deslogado a cada F5, já que `persistSession: false` também afeta sessões reais, não só anônimas.
- Chamadas concorrentes de restauração de sessão (ex.: efeito de montagem do React rodando duas vezes sob StrictMode em dev) são deduplicadas em `AuthContext.tsx` — o Supabase rotaciona o refresh token a cada uso, então duas tentativas simultâneas com o mesmo token cache fariam a segunda falhar por engano.
- Não existe login por e-mail/senha para usuários finais. A única exceção é uma conta de teste dedicada usada pela suíte automatizada (ver seção de Testes) — nunca aparece na UI.

### Configuração Supabase

```typescript
// src/services/supabaseClient.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,      // client não usa o storage automático do Supabase
    autoRefreshToken: false,    // refresh é feito manualmente via ensureAnonymousSession/restoreCachedSession
  }
});
```

**Por que `persistSession: false` em vez do padrão (`true`)?** Histórico: originalmente essa flag foi ligada porque o Supabase tentava recuperar uma sessão anônima automaticamente e falhava com erro 500 — mas a causa raiz real disso era o gatilho de whitelist rejeitando usuários anônimos (ver acima), não a persistência em si. Com o gatilho corrigido, `persistSession: true` provavelmente funcionaria — mas o projeto manteve `false` e passou a gerenciar a persistência manualmente (`ensureAnonymousSession`/`restoreCachedSession` em `AuthContext.tsx`), o que dá controle explícito sobre quando uma sessão nova é criada (importante para não esbarrar no rate limit de sign-ins anônimos).

### Variáveis de Ambiente

```env
# .env — chaves PÚBLICAS (prefixo VITE_ = vão para o bundle do cliente), OK commitar exemplo/URL mas não o anon key real de produção sem necessidade
VITE_SUPABASE_URL=https://srzemgdpwunhnnfxdgjs.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...

# .env.local — SEGREDOS, nunca commitar (já cai em *.local no .gitignore)
SUPABASE_SERVICE_ROLE_KEY=...          # acesso admin total, contorna RLS — só scripts Node (scripts/), NUNCA em src/
E2E_GESTAO_TEST_EMAIL=e2e-gestao-test@padaria.local
E2E_GESTAO_TEST_PASSWORD=...           # conta de teste gestão, ver seção de Testes
```

Validação obrigatória no client:
```typescript
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente Supabase não configuradas!');
}
```

---

## 📁 Estrutura de Pastas

```
src/
├── context/
│   └── AuthContext.tsx          # Provider + loginWithPIN/loginWithGoogle/logout + cache de sessão
├── pages/
│   ├── Login.tsx                # Form PIN + Google OAuth button
│   ├── Dashboard.tsx            # Home operacional/gestão
│   ├── Config.tsx               # Hub de cadastros/config da gestão
│   ├── SectorSelector.tsx / ShiftInventory.tsx   # Inventário por turno (RF-01 a RF-08)
│   ├── SobrasPerdas.tsx / ConsultaEstoque.tsx / Recebimento.tsx   # RF-09 a RF-11
│   ├── Fiado.tsx                # Lançamento de débito (operação)
│   ├── WmsDashboard.tsx / PedidosCompra.tsx      # WMS: sugestão de compra, pedidos (RF-14 a RF-17)
│   ├── GestaoTurnosDia.tsx      # Status/reabertura de turnos do dia (gestão, RF-21)
│   └── cadastros/*.tsx          # CRUDs de gestão (turnos, setores, produtos, fornecedores, funcionários, preços, usuários, configurações)
├── components/
│   ├── TurnosStatusPanel.tsx    # Painel "turnos de hoje", reaproveitado por operação e gestão
│   └── ...outros componentes
├── services/
│   └── supabaseClient.ts        # Cliente Supabase com opções de auth
└── utils/
    ├── operationalDay.ts        # Self-healing (RF-08) e bloqueio sequencial de turnos (RF-02) — lógica pura, testada
    ├── mathCalculations.ts      # Fórmula WMS (RF-15) — espelha get_sugestao_compra do Postgres
    └── fiadoCalculations.ts     # Saldo corrido de fiado

scripts/
└── setup-test-gestor.mjs        # Provisiona a conta de teste gestão (idempotente, precisa de SUPABASE_SERVICE_ROLE_KEY)

supabase/
├── migrations/                  # SQL versionado — ver seção "Estado do banco" abaixo
└── functions/                   # Edge Functions (ex.: envio de e-mail de fechamento)

tests/
├── e2e/                         # Playwright — ver seção de Testes
└── integration/                 # Vitest contra o Supabase real — ver seção de Testes
```

---

## 🗄️ Estado do banco (Supabase) — ⚠️ migração pendente

O ambiente usado para validar a última sessão de testes tinha a migração **`20260813150000_onda2_lifecycle_and_gaps.sql` não aplicada**, apesar de estar no repositório. Isso quebra em produção, agora:

- `encerrar_turno` — RF-07 (botão "Encerrar Turno" no Inventário nunca conclui)
- `reabrir_turno` — RF-21 (gestão não consegue reabrir setor/turno)
- `consultar_estoque` — RF-10 (Consulta de Estoque operacional sempre volta vazia, sem indicar erro na UI)
- `conferir_recebimento` — RF-09/RF-17 (Recebimento não registra conferência)
- A constraint `UNIQUE(id_lancamento, id_produto)` em `lancamentos_itens` e o trigger `check_lancamento_editable` também vêm dessa migração.

**Antes de mexer em qualquer coisa relacionada a turnos, recebimento ou consulta de estoque**, confirme que essa migração está aplicada (`supabase db push`, ou rodando o SQL manualmente no painel). Os testes de integração (`tests/integration/`) têm casos que ficam vermelhos de propósito enquanto isso não for corrigido — não "conserte" esses testes, conserte o deploy da migração.

Detalhes completos em [PRD-Supabase-React-Padaria.md, seção 7.4](./PRD-Supabase-React-Padaria.md).

---

## 🐛 Problemas Resolvidos

### Login operacional (PIN) rejeitado com "Database error creating anonymous user" (500)
**Causa:** o gatilho de whitelist do OAuth (`handle_new_user`) rodava em **todo** INSERT em `auth.users`, inclusive sign-ins anônimos — como eles não têm e-mail, o gatilho recusava a criação.  
**Solução:** adicionar `IF new.is_anonymous THEN RETURN new; END IF;` no topo da função (migração `20260813170000`).

### Rate limit de sign-in anônimo esgotado rapidamente
**Causa:** todo login PIN criava um usuário anônimo **novo** (já que `persistSession: false` não reaproveitava nada) — poucos logins/reloads já batiam no limite do Supabase.  
**Solução:** cachear os tokens da sessão anônima em `localStorage` e restaurar via `setSession()` em vez de `signInAnonymously()` sempre que possível (`ensureAnonymousSession()` em `AuthContext.tsx`).

### Sessão de gestão (Google OAuth) não sobrevivia a reload
**Causa:** o mesmo problema acima, mas para sessões reais — só o fluxo PIN tinha lógica de restauração.  
**Solução:** generalizar o cache/restauração de sessão para qualquer role, com uma chave separada (`gestao_session`) já que uma sessão de gestão não pode ser reemitida por nós mesmos (só o login OAuth real faz isso) — se o cache falhar, a única saída é deslogar.

### Restaurações concorrentes de sessão invalidando uma à outra
**Causa:** o efeito de montagem do `AuthProvider` roda duas vezes sob React StrictMode em dev — duas chamadas de `restoreCachedSession()` simultâneas usavam o mesmo refresh token, e a segunda falhava porque o Supabase já tinha rotacionado o token na primeira.  
**Solução:** deduplicar chamadas concorrentes por chave (`dedupe()` em `AuthContext.tsx`), esperando a mesma Promise em vez de disparar duas independentes.

### "Cannot access variable before it is declared"
**Causa:** Funções fetch declaradas APÓS useEffect que as chamava  
**Solução:** Mover declaração de função antes de useEffect

### "setState in effect" ESLint rule
**Causa:** Funções que fazem setState definidas fora de effect mas chamadas dentro  
**Solução:** Envolver com `useCallback` e adicionar à dependency array

### Hardcoded credentials
**Causa:** Fallbacks com valores fictícios no supabaseClient  
**Solução:** Validação obrigatória, sem fallback inseguro

### react-refresh/only-export-components
**Causa:** AuthContext exportava tanto componente quanto hook  
**Solução:** `useAuth` é exportado do próprio `AuthContext.tsx` (não há mais arquivo `useAuth.ts` separado — ver Estrutura de Pastas).

---

## 🧪 Testes

Três camadas, cada uma com seu próprio comando:

```bash
npm test                 # unit — Vitest, src/**/*.test.ts, sem rede, roda em segundos
npm run test:integration # integração — Vitest, tests/integration/, contra o Supabase real
npm run test:e2e         # e2e — Playwright, tests/e2e/, contra o Supabase real + navegador
```

### Unit (`src/**/*.test.ts`)
Lógica pura: fórmula WMS (`mathCalculations.test.ts`), saldo de fiado (`fiadoCalculations.test.ts`), fuzzy matching de voz (`fuzzyMatcher.test.ts`), self-healing e bloqueio sequencial de turnos (`operationalDay.test.ts`).

### Integração (`tests/integration/`, config própria em `vitest.integration.config.ts`)
- `rls-gestao.test.ts` — caminho negativo: confirma que a RLS bloqueia a sessão operacional (anônima) em tudo que é exclusivo da gestão.
- `gestao-crud.test.ts` — caminho positivo: confirma que a RLS libera CRUD de fato para a sessão de gestão. Alguns casos dependem das RPCs da migração pendente (ver acima) e ficam vermelhos até ela ser aplicada.

### E2E (`tests/e2e/`, Playwright)
Cobre login PIN, dashboard, inventário, fiado, sobras/perdas, consulta de estoque, recebimento (área operacional) e autenticação/CRUD/WMS (área gerencial).

**Login de gestão em teste automatizado:** o fluxo real é Google OAuth, não automatizável. A suíte usa uma conta de teste dedicada, provisionada por:

```bash
node scripts/setup-test-gestor.mjs   # idempotente — requer SUPABASE_SERVICE_ROLE_KEY em .env.local
```

O helper `loginAsGestor()` (`tests/e2e/helpers.ts`) autentica essa conta por e-mail/senha e injeta a sessão no navegador via `#access_token=...` na URL — o mesmo mecanismo que o Supabase Auth usa em redirects de magic link/recuperação de senha. Nenhum código de produção precisa expor o client Supabase para isso funcionar.

**Concorrência limitada (`workers: 2` em `playwright.config.ts`):** cada teste roda em um browser context isolado (sem a sessão anônima cacheada compartilhada), então testes em paralelo demais disparam `signInAnonymously()` simultâneos e esbarram no rate limit do Supabase. Se a suíte falhar em massa com `over_request_rate_limit`, é isso — espere a janela de rate limit resetar (ou aumente o limite em Authentication → Rate Limits no painel).

**Gap de dados conhecido:** a tabela `produtos` pode estar vazia no seu ambiente — testes que dependem de produtos reais pulam automaticamente (`test.skip`) em vez de falhar.

---

## 🔧 Configuração de Desenvolvimento

### Servidor de Dev
```bash
npm run dev
# http://localhost:5173
```

### Build
```bash
npm run build
# dist/
```

### Lint (ESLint)
```bash
npm run lint
```

---

## 📊 Padrões de Código Importantes

### useCallback Pattern (Fetch Functions)
```typescript
const fetchData = useCallback(async () => {
  const { data, error } = await supabase
    .from('table')
    .select('*');
  setData(data);
}, []); // Deps: apenas se usar props/state externo

useEffect(() => {
  fetchData();
}, [fetchData]);
```

### Context Hook Pattern
```typescript
// AuthContext.tsx
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// Em componentes:
const { role, authReady, loginWithPIN, loginWithGoogle, logout } = useAuth();
```

`authReady` é `false` enquanto uma sessão (PIN ou gestão) está sendo restaurada após um reload — `ProtectedRoute` (`App.tsx`) espera isso antes de montar páginas protegidas, para que elas não disparem queries antes da sessão estar pronta.

### RLS Query Pattern (Supabase)
```typescript
const { data } = await supabase
  .from('table')
  .select('*')
  .eq('id_setor', idSetor);
  // RLS verifica automaticamente se a sessão atual (operacional/gestão) pode ver essa linha
```

---

## 🚀 Deploy & CI/CD

### GitHub Actions (`.github/workflows/ci.yml`)
- Lint check
- Type check (`tsc`)
- Build check
- Testes (unit sempre; integração/e2e dependem de segredos configurados no CI)

### Vercel
- Deploy automático em push para main
- Preview em PRs
- Variáveis de ambiente: configure via UI (não comitar `.env`/`.env.local`)

---

## ⚠️ Checklist de Segurança

- [ ] Nunca commitar `.env.local` (segredos: service role key, credenciais de teste)
- [ ] `VITE_SUPABASE_ANON_KEY` em `.env` pode ser commitada (é uma chave pública por design), mas confira antes de trocar de projeto Supabase
- [ ] Nunca hardcode credenciais em código
- [ ] `SUPABASE_SERVICE_ROLE_KEY` só em scripts Node (`scripts/`), nunca em `src/`
- [ ] Supabase RLS ativado em todas as tabelas
- [ ] Google OAuth Whitelist funcionando **e** ignorando sessões anônimas (`handle_new_user`)
- [ ] PIN único por ambiente (dev/prod), validado no servidor (`validar_pin` RPC)
- [ ] Rate limit de sign-ins anônimos configurado com folga (Authentication → Rate Limits)
- [ ] HTTPS obrigatório em produção
- [ ] Migração `20260813150000_onda2_lifecycle_and_gaps.sql` aplicada (ver seção "Estado do banco")

---

## 📞 Troubleshooting

### PIN Login não funciona
1. Verifique `.env` tem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
2. Erro "Database error creating anonymous user" (500) → o gatilho `handle_new_user` está rejeitando sessões anônimas, ver "Problemas Resolvidos" acima.
3. Erro `over_request_rate_limit` no console → esgotou a cota de sign-ins anônimos do projeto; espere resetar ou aumente o limite no painel.
4. Clear browser storage (DevTools → Storage → Clear all) e reinicie o dev server para descartar sessão cacheada corrompida.

### Gestor é deslogado sozinho ao dar refresh
Confirme que `AuthContext.tsx` tem a lógica de `restoreCachedSession(GESTAO_SESSION_KEY)` no efeito de montagem — se foi removida/revertida, esse é o bug que ela corrige.

### RPC "Could not find the function ... in the schema cache" (`PGRST202`)
A função não existe no banco conectado, mesmo que o arquivo de migração esteja no repo — migração não aplicada. Ver seção "Estado do banco" acima.

### Google OAuth retorna erro
1. Verifique se o e-mail já está pré-cadastrado em `usuarios` (whitelist) **antes** do primeiro login.
2. Confirme credenciais OAuth em Supabase → Auth → Providers.

### Build falha
1. `npm install` (reinstale dependências)
2. Verifique TypeScript: `tsc --noEmit`
3. ESLint: `npm run lint`

---

## 📚 Referências Internas

- [PRD-Supabase-React-Padaria.md](./PRD-Supabase-React-Padaria.md) — requisitos de produto, modelo de dados, contrato de API, regras de cálculo. Fonte da verdade para *comportamento*; este arquivo é sobre *implementação*.
- [CONSTITUTION.md](./CONSTITUTION.md) — arquitetura fundamental
- [TECHNICAL_DOC.md](./TECHNICAL_DOC.md) — decisões técnicas
- [DOCUMENTATION_OF_TESTS.md](./DOCUMENTATION_OF_TESTS.md) — estratégia de testes
- [TEST-INSTRUCTIONS.md](./TEST-INSTRUCTIONS.md) — instruções de execução de testes
