# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

## [Unreleased]

### Adicionado
- **Testes E2E (Playwright)**: Configuração completa e testes automatizados validando o fluxo de Login via PIN e acesso ao Inventário com suporte a falhas simuladas (mock).
- **Core de Inventário Operacional**: Interface de seleção de setores e tela de contagem de estoque (`ShiftInventory.tsx`) com capacidade de ditar quantidades por voz.
- **Captura por Voz**: Implementação do `useSpeechToText` cruzando dados com algoritmo de Levenshtein (Fuzzy Matching) para mapear termos falados com os produtos.
- **Modo Offline**: Mecanismo de persistência no navegador via IndexedDB/Dexie e Sync Daemon, preservando dados (drafts e operações confirmadas) durante falhas de rede.
- **Self-Healing SQL**: Migração e testes integrados para procedimentos em Postgres (RPCs) que injetam faltas em turnos operacionais omitidos.
- **Dashboard WMS**: Dashboards calculando a sugestão de compra em tempo real via views no banco e tela de visualização de pedidos de suprimento (WhatsApp sharing).
- **Autenticação Dupla (Contexto)**: `AuthContext` com fallbacks locais de Login via Google OAuth para o gestor e PIN numérico genérico para operadores.

### Modificado
- Configuração Vite + Tailwind v4 finalizada.
- `CONSTITUTION.md` reconstruída refletindo regras arquiteturais mobile-first.

### Corrigido
- Tempo limite (timeout) nos testes Playwright para acomodar long delays quando a URL do Supabase aponta para instâncias mockadas.
