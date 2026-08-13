# Padaria Inventário & WMS Constitution

Este documento define as regras e diretrizes fundamentais para o desenvolvimento do projeto **Padaria Inventário & WMS**. Estas diretrizes atuam como leis imutáveis que guiam a arquitetura, a implementação e as interações no código.

## 1. Princípios Essenciais (Core Principles)

### I. Abordagem Mobile-First & PWA
Toda interface de usuário deve ser desenhada primariamente para telas de celulares, visto que a operação ocorre inteiramente via dispositivos móveis compartilhados no balcão da padaria. A aplicação deve operar como Progressive Web App (PWA).

### II. Offline-First & Resiliência
A instabilidade de rede não deve interromper a operação. 
- Todas as ações de escrita (inventário, sobras, débitos) devem ser salvas localmente via IndexedDB/Dexie.
- Um daemon de sincronização deve garantir que os dados cheguem ao servidor (Supabase) assim que a conexão for reestabelecida.

### III. Interação Orientada a Voz (Voice-First)
O fluxo principal (contagem de inventário) baseia-se em entrada por voz via Web Speech API. O processamento de fala e o fuzzy matching (algoritmo de Levenshtein) devem ser precisos e resilientes, sempre com fallback visual claro para edição manual.

### IV. Test-Driven & Qualidade Garantida (NON-NEGOTIABLE)
Nenhuma funcionalidade é considerada completa sem a devida cobertura de testes, que engloba:
- **Testes Unitários:** Para lógicas isoladas e regras de negócio (cálculos, fuzzy matching).
- **Testes de Integração:** Para interações com o Supabase e lógicas de banco (RPCs, Self-Healing).
- **Testes E2E (Playwright):** Para fluxos operacionais completos na interface de usuário.

### V. Atomicidade e Commits por Tarefa
O progresso deve ser granular e rastreável. Cada tarefa listada em `task.md` e efetivamente implementada deve gerar obrigatoriamente um commit isolado, no padrão Conventional Commits, garantindo o histórico exato do desenvolvimento sem a necessidade de push imediato.

## 2. Restrições Arquiteturais

- **Stack Fixa:** React (Frontend), Tailwind CSS (Estilização), Supabase (PostgreSQL, Auth e RPCs).
- **Gerenciamento de Estado:** O estado global relacionado à autenticação e à conectividade deve ser isolado em Context API (`AuthContext`), enquanto o estado operacional offline deve residir primariamente no IndexedDB para evitar perda de dados.
- **Consultas Otimizadas:** A interface deve fazer requisições restritas aos dados essenciais e cachear listas estáticas (como produtos e setores) para suportar a usabilidade offline.

## 3. Workflow de Desenvolvimento

1. **Gestão de Tarefas:** Todo o escopo de trabalho reside na lista de verificação `task.md`. Nenhuma grande alteração deve ser feita sem antes constar como uma tarefa a ser atacada.
2. **Atualização de Status:** Ao iniciar e ao finalizar uma funcionalidade, a respectiva checkbox no `task.md` deve ser marcada.
3. **Revisão:** A arquitetura proposta para novos desafios deve sempre se alinhar às premissas do Product Requirements Document (PRD).

## Governança

Esta constituição sobrepõe-se a outras práticas temporárias. Qualquer mudança fundamental na infraestrutura ou nos requisitos arquiteturais exige uma alteração justificada e documentada neste arquivo.
