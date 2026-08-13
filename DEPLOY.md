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

## Gaps conhecidos em produção (2026-08-13)

O mesmo projeto Supabase (`srzemgdpwunhnnfxdgjs`) serve produção e desenvolvimento local — não há staging separado.

**1. Migração não aplicada** — `supabase/migrations/20260813150000_onda2_lifecycle_and_gaps.sql` está no repo mas não no banco. Quebra `encerrar_turno` (RF-07), `reabrir_turno` (RF-21), `consultar_estoque` (RF-10) e `conferir_recebimento` (RF-09/17) com `PGRST202`. Também traz a constraint `UNIQUE(id_lancamento, id_produto)` e o trigger `check_lancamento_editable` em `lancamentos_itens`, sem os quais o upsert de contagem do Inventário pode duplicar linhas.
Ação: `supabase db push` (com `SUPABASE_ACCESS_TOKEN` configurado) ou colar o SQL no painel. Os testes em `tests/integration/` têm casos vermelhos de propósito até isso ser corrigido — não "conserte" os testes, conserte o deploy.

**2. `produtos` vazio** — `setores` (5), `turnos` (4) e `funcionarios` (3) têm dados reais, mas `produtos` tem 0 linhas. RF-03 só mostra setores com produto ativo, então a área operacional não tem nenhum setor disponível pra contar até a gestão cadastrar produtos (Config → Cadastros → Produtos). Não é bug — é o estado esperado de um deploy inicial sem seed de dados.

## Troubleshooting rápido

| Sintoma | Causa provável |
|---|---|
| 404 ao dar refresh numa rota (`/wms`, etc.) em produção | `vercel.json` ausente/removido |
| Login Google redireciona pra localhost | Supabase Auth URL Configuration sem o domínio de produção |
| RPC "Could not find the function ... in the schema cache" (`PGRST202`) | Migração não aplicada — ver gap #1 acima |
| `over_request_rate_limit` no console | Cota de sign-in anônimo esgotada — ver `AUTH.md` |
