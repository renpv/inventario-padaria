# Deploy & Operação — Detalhes

Referenciado por [CLAUDE.md](./CLAUDE.md). Requisitos formais em [PRD-Supabase-React-Padaria.md, RNF-05/RNF-06](./PRD-Supabase-React-Padaria.md).

## Vercel

- **Produção:** https://inventario-padaria.vercel.app (domínio estável — use para qualquer configuração externa, ex.: Redirect URLs do Supabase). **Não** use a URL de deployment específico (`inventario-padaria-<hash>-renpv.vercel.app`) para isso — muda a cada push.
- Repo conectado: `renpv/inventario-padaria` no GitHub. Deploy automático em push para `main`; preview automático em PRs.
- Env vars configuradas via UI da Vercel (Project → Settings → Environment Variables): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **`vercel.json`** (raiz do repo): rewrite `/(.*) → /index.html`, obrigatório para SPA com React Router. Sem ele, refresh em qualquer rota que não seja `/` retorna 404 (o dev server do Vite faz esse fallback sozinho, então só aparece em produção). Se reaparecer o 404, confira se o arquivo não foi removido.

## Supabase Auth URL Configuration

Precisa cobrir **todo domínio que serve o app**, não só produção:

- **Site URL:** `https://inventario-padaria.vercel.app`
- **Redirect URLs** (uma por linha, com `/**`):
  ```
  https://inventario-padaria.vercel.app/**
  http://localhost:5173/**
  ```

Sem a URL de produção nessa lista, o login com Google completa mas redireciona de volta para o Site URL configurado (não é bug de código — `loginWithGoogle` não hardcoda URL nenhuma). Precisa ser revisado a cada novo domínio (preview, domínio customizado).

## Gerenciamento de tokens/segredos

- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`: configurados via `setx` como variáveis de ambiente de usuário do Windows (não em arquivo do projeto). Decisão de 2026-08-13 — considerado suficiente por ora; um gerenciador de segredos centralizado (Doppler, 1Password) foi cogitado para lidar com múltiplos projetos Supabase/Vercel de forma visual, mas fica pra depois.
  - `setx` só afeta processos **novos** — depois de configurar, é preciso reabrir o terminal/sessão para as variáveis ficarem visíveis.
  - `SUPABASE_SERVICE_ROLE_KEY`: acesso admin total ao banco (contorna RLS). Só em scripts Node (`scripts/`), nunca em `src/`.
  - `SUPABASE_ACCESS_TOKEN`: token de conta Supabase (não escopado a um projeto) — permite `supabase link`/`db push`/Management API.
  - `VERCEL_TOKEN`: permite `vercel` CLI sem login interativo.
- `E2E_GESTAO_TEST_EMAIL`/`PASSWORD`: credenciais da conta de teste de gestão (ver `TEST-INSTRUCTIONS.md`), hoje em `.env.local`.

## Gaps conhecidos em produção

O mesmo projeto Supabase (`srzemgdpwunhnnfxdgjs`) serve produção e desenvolvimento local — não há staging separado.

**Migrações — ✅ resolvido em 2026-08-13.** `20260813150000_onda2_lifecycle_and_gaps.sql`, `20260813160000_email_fechamento.sql` e `20260813170000_fix_anonymous_pin_login.sql` foram aplicadas. `encerrar_turno`, `reabrir_turno`, `consultar_estoque` e `conferir_recebimento` confirmadas funcionando (23/23 em `npm run test:integration`).

**`produtos` vazio — ainda pendente.** `setores` (8), `turnos` (4) e `funcionarios` (3) têm dados reais, mas `produtos` tem 0 linhas. RF-03 só mostra setores com produto ativo, então a área operacional não tem nenhum setor disponível pra contar até a gestão cadastrar produtos (Config → Cadastros → Produtos). Não é bug — é o estado esperado de um deploy inicial sem seed de dados.

**Rate limit de sign-in anônimo — revisado, mantido no default.** Confirmado em 2026-08-13: 30 sign-ins anônimos/hora por IP (default do Supabase). Antes do cache de sessão (ver AUTH.md) isso seria apertado — um operador por login consumia 1 unidade. Com o cache, um dispositivo só consome isso ocasionalmente (sessão expirada/cache limpo), então o default deve bastar; monitore se aparecer `over_request_rate_limit` de novo.

## Troubleshooting rápido

| Sintoma | Causa provável |
|---|---|
| 404 ao dar refresh numa rota (`/wms`, etc.) em produção | `vercel.json` ausente/removido |
| Login Google redireciona pra localhost | Supabase Auth URL Configuration sem o domínio de produção |
| RPC "Could not find the function ... in the schema cache" (`PGRST202`) | Alguma migração não aplicada — confira `supabase/migrations/` vs. o que rodou no banco |
| `over_request_rate_limit` no console | Cota de sign-in anônimo esgotada — ver `AUTH.md` |
