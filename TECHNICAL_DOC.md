# Documentação Técnica: Padaria Inventário & WMS

Este documento fornece a visão geral de alto nível da arquitetura e decisões de design da aplicação.

## Arquitetura de Alto Nível

- **Frontend:** React + Vite + TailwindCSS v4.
- **Backend (BaaS):** Supabase (PostgreSQL, Supabase Auth).
- **Abordagem Offline-First:** Toda interação crítica da área operacional grava primeiro no IndexedDB (usando Dexie.js).
- **Hospedagem:** Planejado para Vercel.

## Gerenciamento de Estado e Ciclo de Vida

- **Context API (`AuthContext`):** 
  - Controla o perfil de acesso (`role`: `operacional` ou `gestao`).
  - Controla o status de conectividade de rede (`isOnline`), escutando eventos de janela `online`/`offline`.
  - Provê autenticação (via Google Auth para gestores, verificação de PIN para operação).

## Modelagem e Lógica Backend (Supabase)

- As validações de estado complexo, como a criação do turno seguinte ou reparação da ausência de turnos anteriores (`self-healing`), ficam diretamente a cargo de RPCs do banco de dados (funções PL/pgSQL).
- A camada RLS restringe as visualizações. Operadores são limitados apenas pela sessão via código PIN que os autentica no escopo do Supabase indiretamente por uma function de verificação local.

## A Web Speech API

A captura por voz (`useSpeechToText`) ouve continuamente enquanto a tela do Inventário está ativa e com a captura iniciada.
1. O evento gera um `transcript`.
2. A aplicação submete a string ao `fuzzyMatcher` customizado (baseado em distância de Levenshtein).
3. Havendo match válido na lista de produtos carregados (acima do limite de confiança), ele atualiza imediatamente o rascunho.
4. Caso a fala caia em palavras mortas de exclusão explícitas no dicionário, a operação é abortada para o ruído.

## Sincronização (Daemon)

`SyncDaemon`: Um loop contínuo que avalia a lista pendente de `offlineQueue` no IndexedDB.
Quando a rede volta, ele pega um a um os registros pendentes, envia para o backend. Se a resposta for sucesso, remove da fila.

## Testes Automatizados

- **Unitários e Mocks (Vitest):** Usado para cálculos de WMS, self-healing SQLs ou módulos utilitários de algoritmos de string.
- **E2E (Playwright):** O foco central. Varre o fluxo transacional (Login Operador -> Setup Setor -> Preenchimento Draft de Produtos) e intercepta chamadas de banco quando necessário para evitar corrompimento de testes em dados reais.
