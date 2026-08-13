# Documentação de Testes (Test Plan & Execution)

Este arquivo mapeia e documenta os testes do projeto em acordo com a constituição (`CONSTITUTION.md`), validando regras de negócio, integrações via Supabase e fluxos ponta-a-ponta.

## 1. Testes Unitários

**Ferramenta:** Vitest

- **WMS Sugestão de Compra (`mathCalculations.test.ts`):** 
  Testa se as fórmulas de sugestão respeitam o mínimo de estoque, consumo projetado, e se zeram quando o resultado é negativo. (Alta cobertura de branches lógicas).
  
- **Fuzzy Matching (`fuzzyMatcher.test.ts`):** 
  Garante que aproximações via algoritmo de Levenshtein ignorem palavras mortas ("e", "de") e aceitem "zero/nada", cobrindo casos de transcrições imperfeitas de voz.

- **Cálculo de Extrato de Fiado (`fiadoCalculations.test.ts`):** 
  Valida se o cálculo do `saldoApos` é incrementado em casos de Retirada/Adiantamento e subtraído para Quitações, mantendo a cronologia e garantindo integridade gerencial. (Meta de Cobertura > 80%).

## 2. Testes de Integração (Banco de Dados)

**Ferramenta:** SQL Script & pgTAP

- **Self-Healing de Turnos (`self_healing.test.sql`):** 
  Um script que simula a abertura do 3º turno sem que o 1º e 2º tenham sido abertos, conferindo se os registros omissos foram forçadamente lançados com justificativa "NÃO REALIZADO".

- **Limites e Segurança de Fiado (`fiado_security.test.sql`):** 
  Script transacional que:
  1. Tenta inserir Retirada extrapolando `limite_global_fiado`, esperando erro explícito do TRIGGER de limite (`check_limite_global_fiado`).
  2. Garante que os saldos voltam a permitir débitos após uma quitação.
  *(A validação de RLS contra operadores será atestada também por E2E ou acessos mockados do Supabase, visto que os scripts internos via psql rodam como postgres admin por padrão).*

## 3. Testes Ponta-a-Ponta (E2E)

**Ferramenta:** Playwright

- **Login e Inventário (`login-flow.spec.ts`):**
  Varre a interface desde a inserção do PIN de acesso (1234) até a listagem de setores, escolha do setor "Pães" e preenchimento de uma quantidade usando interface ou fallback de voz (quando mockado). Tem timeouts configurados para acomodar os cold starts do servidor local.

- **Fluxo Operacional de Fiados (`fiado-flow.spec.ts`):**
  Verifica se o Operador logado por PIN consegue acessar a interface `/fiado`, validar a seleção de funcionários e os campos de valor/produto necessários para um lançamento, garantindo que o form exibe as restrições corretas.

- **Dashboard WMS (`wms-flow.spec.ts`):**
  Testa a restrição de segurança da rota `/wms` bloqueando acessos indevidos e redirecionando (já que o fluxo gerencial completo via Google Auth OAuth é testado manualmente em homologação).
