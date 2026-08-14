# CLAUDE.md - Guia de Desenvolvimento do Projeto

**Projeto:** Padaria Inventário & WMS
**Stack:** React 19 + TypeScript + Vite + TailwindCSS v4 + Supabase
**Última atualização:** 2026-08-13

Sistema PWA de inventário por voz para padaria: **Operacional** (PIN compartilhado, sem login individual) e **Gestão** (Google OAuth + whitelist). Comportamento/requisitos completos: [PRD-Supabase-React-Padaria.md](./PRD-Supabase-React-Padaria.md) — este arquivo é sobre *implementação*, não *requisitos*.

## 🔐 Autenticação — resumo

Ambos os fluxos autenticam o client Supabase (RLS exige `TO authenticated` em toda tabela), mesmo o PIN não sendo login individual: PIN usa uma sessão **anônima** por trás; Gestão usa Google OAuth com whitelist (`handle_new_user` — precisa ignorar sessões anônimas). O client roda com `persistSession: false`, então a sessão é cacheada manualmente em `localStorage` e restaurada em cada reload (`ensureAnonymousSession`/`restoreCachedSession` em `AuthContext.tsx`) — sem isso, reload desloga o usuário e cada login criaria uma sessão anônima nova, esgotando o rate limit do Supabase.

**Detalhes completos, histórico de bugs e o porquê de cada decisão:** [AUTH.md](./AUTH.md)

## 📁 Estrutura de Pastas

```
src/
├── context/AuthContext.tsx      # loginWithPIN/loginWithGoogle/logout + cache de sessão
├── pages/                       # Login, Dashboard, Config, Inventário (Sector/ShiftInventory),
│                                 # Sobras/Perdas, Consulta Estoque, Recebimento, Fiado, WMS,
│                                 # Pedidos, GestaoTurnosDia, cadastros/*.tsx (CRUDs de gestão)
├── components/                  # TurnosStatusPanel, ProductList, etc.
├── services/supabaseClient.ts   # Cliente Supabase
└── utils/                       # operationalDay.ts (self-healing/bloqueio de turnos, testado),
                                  # mathCalculations.ts (fórmula WMS), fiadoCalculations.ts

scripts/setup-test-gestor.mjs    # Provisiona conta de teste gestão (idempotente)
supabase/{migrations,functions}/ # SQL versionado + Edge Functions
tests/{e2e,integration}/         # Playwright + Vitest contra Supabase real
```

## 🗄️ Estado do banco

O projeto Supabase de `.env` é o **mesmo usado em produção** (sem staging separado). Migrações aplicadas e confirmadas (2026-08-13, 23/23 testes de integração verdes). Gap restante: tabela `produtos` vazia — área operacional sem setores disponíveis até a gestão cadastrar produtos (Config → Cadastros → Produtos). **Detalhes:** [DEPLOY.md](./DEPLOY.md).

## 🚀 Deploy & CI

**CD:** Vercel, deploy automático em push para `main` → https://inventario-padaria.vercel.app (integração Git nativa, não passa por GitHub Actions). Exige `vercel.json` (rewrite de SPA) e o Supabase Auth URL Configuration cobrindo o domínio de produção.

**CI:** `.github/workflows/ci.yml` roda lint + type-check + build + unit em todo push/PR. Integração e e2e **não** rodam em CI de propósito (mesmo Supabase de produção, sem staging — rodar automaticamente esbarra no rate limit) — sempre locais antes de mergear mudanças de auth/RLS/fluxos.

**Git hooks (Husky):** pre-commit roda `lint-staged` (eslint --fix nos arquivos staged); pre-push roda build + unit tests, espelhando o CI. Ativados via `"prepare": "husky"` no `package.json` — só rodam automaticamente depois de `npm install`; **`git clone` sozinho não ativa os hooks**, rode `npm install` uma vez em qualquer clone novo.

Lint 100% limpo (2026-08-13). `react-hooks/set-state-in-effect` está **desligada** no `eslint.config.js` — dispara no padrão "fetch on mount" usado de propósito em ~15 componentes; justificativa no próprio arquivo de config.

**Detalhes, troubleshooting e gerenciamento de tokens:** [DEPLOY.md](./DEPLOY.md).

## 🧪 Testes

```bash
npm test                 # unit — Vitest, sem rede
npm run test:integration # integração — Vitest contra Supabase real
npm run test:e2e         # e2e — Playwright contra Supabase real + navegador
```

Cobre operação e gestão nos 3 níveis, incluindo login de gestão simulado (conta de teste dedicada, sem depender de OAuth real). **Passo a passo de execução:** [TEST-INSTRUCTIONS.md](./TEST-INSTRUCTIONS.md). **Mapa do que cada teste cobre:** [DOCUMENTATION_OF_TESTS.md](./DOCUMENTATION_OF_TESTS.md) *(desatualizado em partes — confira os arquivos em `tests/` como fonte da verdade)*.

## 🔧 Comandos do dia a dia

```bash
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint
```

## 📊 Padrões de Código

- **Fetch em componente:** envolver com `useCallback` e listar como dependência do `useEffect` (evita warning `setState in effect` e reruns desnecessários).
- **`useAuth()`:** exporta `{ role, authReady, loginWithPIN, loginWithGoogle, logout }`. `authReady` fica `false` durante a restauração de sessão pós-reload — `ProtectedRoute` (`App.tsx`) espera isso antes de montar páginas protegidas.
- **RLS:** toda query já é filtrada automaticamente pela sessão atual — não reimplemente checagem de permissão no cliente, só trate o retorno vazio/erro.

## ⚠️ Checklist de Segurança

- [ ] Nunca commitar `.env.local` (segredos) — hoje ficam em variáveis de ambiente do Windows (`setx`), não em arquivo
- [ ] `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ACCESS_TOKEN` só em scripts Node, nunca em `src/`
- [ ] `handle_new_user` (whitelist) ignorando sessões anônimas
- [x] Rate limit de sign-in anônimo revisado — 30/h por IP (default do Supabase); com o cache de sessão, cada dispositivo só consome isso raramente (não mais 1 por login), então está OK por ora
- [x] Supabase Auth URL Configuration cobrindo todo domínio ativo (ver DEPLOY.md)
- [x] Migrações aplicadas (2026-08-13) — `encerrar_turno`, `reabrir_turno`, `consultar_estoque`, `conferir_recebimento` confirmadas via `npm run test:integration`

## 📚 Referências

- [PRD-Supabase-React-Padaria.md](./PRD-Supabase-React-Padaria.md) — requisitos, modelo de dados, contrato de API, regras de cálculo (fonte da verdade para *comportamento*)
- [AUTH.md](./AUTH.md) — autenticação em detalhe
- [DEPLOY.md](./DEPLOY.md) — deploy, config externa, gaps conhecidos, tokens
- [CONSTITUTION.md](./CONSTITUTION.md) — princípios arquiteturais
- [TECHNICAL_DOC.md](./TECHNICAL_DOC.md) — decisões técnicas
- [TEST-INSTRUCTIONS.md](./TEST-INSTRUCTIONS.md) / [DOCUMENTATION_OF_TESTS.md](./DOCUMENTATION_OF_TESTS.md) — testes
