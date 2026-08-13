# Padaria Inventário & WMS

Sistema de inventário por voz e PWA para gestão operacional de padarias. Suporta contagem offline-first, cálculo de sugestão de compra automatizada e controle rigoroso de débitos e fiados para funcionários.

## Funcionalidades Principais
- **Voice-first & Mobile-first:** Otimizado primariamente para smartphones compartilhados da operação no balcão, permitindo ditar estoques e sobras/perdas.
- **Offline-First:** As informações alimentadas por balcão e caixas são gravadas no navegador via Dexie (IndexedDB) e empurradas via `syncDaemon` para o banco quando há rede.
- **WMS:** Dashboard analítico e automatizado calculando consumos por produto dentro dos limites periódicos.
- **Gestão de Crédito/Fiado:** Bloqueio no banco de dados para evitar excessos (conforme limite global de fiado). Interface gerencial protegida por Auth duplo (Google OAuth).
- **Self-Healing SQL:** Injeção automática de turnos não trabalhados (aborted) para preservar coerência cronológica do estoque local.

## Documentação Extra
- [CONSTITUTION.md](./CONSTITUTION.md) - Regras fundamentais arquiteturais do projeto.
- [CHANGELOG.md](./CHANGELOG.md) - Modificações mapeadas por grandes entregas de versão.
- [TECHNICAL_DOC.md](./TECHNICAL_DOC.md) - Especificações técnicas e decisões da camada de código.
- [DOCUMENTATION_OF_TESTS.md](./DOCUMENTATION_OF_TESTS.md) - Como rodar testes (Playwright, pgTAP, Vitest) que garantem a segurança da aplicação.
- [quickstart.md](./quickstart.md) - Check-list do sistema (Deploy/Homologação).

## Tecnologias e Dependências
- **Frontend:** React 19 + TypeScript + Vite PWA + TailwindCSS v4.
- **Backend:** Supabase (PostgreSQL, Edge Functions via RPC).
- **Testes:** Vitest (unitário), Playwright (E2E), pgTAP (Supabase).

## Como Instalar e Rodar
Leia o nosso [quickstart.md](./quickstart.md) para verificar como criar a instância no Supabase e instalar este projeto localmente em 5 minutos.
