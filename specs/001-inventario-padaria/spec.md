# Feature Specification: Sistema de Inventário e WMS (Padaria)

**Feature Branch**: `001-inventario-padaria`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "Sistema de Inventário e WMS (Padaria)"

## Clarifications

### Session 2026-08-12
- Q: Como o sistema deve resolver conflitos se múltiplos funcionários editarem offline contagens do mesmo setor/turno e tentarem sincronizar? → A: Última gravação vence (Last Write Wins) baseada no timestamp do servidor.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inventário por Turno com Captura de Voz (Priority: P1)

Como operador no balcão da padaria, quero ditar a contagem dos produtos por voz setor a setor durante o meu turno, para que o processo de inventário seja rápido e mãos-livres.

**Why this priority**: É a funcionalidade core do app operacional (MVP), essencial para reduzir o tempo operacional no chão de loja.

**Independent Test**: Pode ser testado ativando o microfone na tela de inventário de um setor, dizendo "pão francês 50" e "pão de queijo zero", e verificando se os valores são preenchidos corretamente nos campos e salvos localmente.

**Acceptance Scenarios**:

1. **Dado** que o operador está na tela do setor "Padaria", **Quando** ele ditar "pão francês 50", **Então** a quantidade do produto "Pão Francês" deve ser definida como 50 e a unidade (ex: unidade/kg) exibida ao lado.
2. **Dado** que o operador ditar "pão de queijo zero", **Quando** a fala for transcrita, **Então** o sistema deve reconhecer a palavra "zero" e definir o valor de contagem como 0 (válido/conferido).
3. **Dado** que há produtos não contados no setor, **Quando** o operador clicar em concluir, **Então** o botão deve mudar para "Forçar Fechamento" e exigir uma justificativa por voz ou texto.

---

### User Story 2 - Resiliência com Operação Offline e Self-Healing (Priority: P1)

Como operador da padaria, quero que minhas contagens e rascunhos sejam salvos no dispositivo mesmo se a rede falhar, e que turnos anteriores esquecidos sejam corrigidos pelo sistema para não bloquear meu turno atual.

**Why this priority**: Essencial para a confiabilidade do sistema no ambiente real da padaria, onde a oscilação de Wi-Fi é frequente.

**Independent Test**: Pode ser testado desativando a rede física/Wi-Fi, fazendo alterações nos rascunhos, confirmando que os dados persistem localmente (IndexedDB) e sincronizando-os automaticamente quando a rede é restaurada.

**Acceptance Scenarios**:

1. **Dado** que a internet caiu (indicador superior mostra "Offline"), **Quando** o operador alterar a quantidade de um item de rascunho, **Então** a alteração deve ser salva no storage local do navegador.
2. **Dado** que o operador inicia o turno "Tarde - entrada", **Quando** os turnos anteriores do mesmo dia não tiverem registro, **Então** o sistema de self-healing deve criar automaticamente esses turnos anteriores com o status "NÃO REALIZADO".

---

### User Story 3 - Sugestão e Simulação de Compra (WMS) (Priority: P2)

Como gestor da padaria, quero visualizar sugestões de compras automáticas baseadas no consumo real e estoque mínimo de cada produto, simulando pedidos agrupados por fornecedor.

**Why this priority**: Permite otimizar o estoque de suprimentos e agilizar a reposição com fornecedores na Fase 2.

**Independent Test**: Pode ser testado acessando o menu de gestão, visualizando as sugestões calculadas pela fórmula WMS e simulando um pedido compartilhável via WhatsApp.

**Acceptance Scenarios**:

1. **Dado** que o consumo do período do produto "Farinha Tipo 1" foi de 100kg, o estoque mínimo é 20kg, o estoque atual é 10kg e há um pedido enviado de 30kg, **Quando** o WMS calcular a sugestão, **Então** a quantidade sugerida deve ser `(100 + 20) - (10 + 30) = 80kg`.
2. **Dado** que o gestor seleciona a simulação de um fornecedor, **Quando** o valor total dos itens for menor que o pedido mínimo configurado, **Devem** ser exibidos um alerta visual e uma solicitação de confirmação para poder enviar.

---

### User Story 4 - Controle de Fiado (Crédito Loja) (Priority: P3)

Como gestor e operador, quero que los débitos de funcionários sejam lançados e restritos ao limite global de fiado configurado, com quitações exclusivas pela gestão.

**Why this priority**: Evita perdas financeiras com retiradas e adiantamentos descontrolados de funcionários (Fase 3).

**Independent Test**: Lançar um débito para um funcionário que atinja o limite máximo e validar que novos débitos são impedidos.

**Acceptance Scenarios**:

1. **Dado** que o limite global de fiado é R$ 200,00 e o saldo atual do funcionário é R$ 190,00, **Quando** o operador tentar lançar uma retirada de R$ 15,00, **Então** o sistema deve rejeitar o lançamento por extrapolar o limite.

---

### Edge Cases

- **Navegador sem suporte a Web Speech API**: Se o operador utilizar um navegador que não suporta a transcrição, a interface deve exibir um alerta amigável e permitir a digitação manual normalmente através dos botões de incremento/decremento.
- **Sincronização Concorrente**: Se dois funcionários alterarem contagens no mesmo dispositivo offline e sincronizarem depois, o sistema resolverá utilizando a abordagem de "última escrita vence" (Last Write Wins), baseando-se no timestamp da transação no servidor Supabase.

---

## Requirements *(mandatory)*

### Functional Requirements

#### 1. Operação & Voz
- **FR-001**: O sistema DEVE capturar a voz e realizar fuzzy matching (Levenshtein) para associar ao produto do setor.
- **FR-002**: O sistema DEVE interpretar os termos "zero", "zerado", "nenhum", "nenhuma", "sem" e "nada" como quantidade 0.
- **FR-003**: O sistema DEVE exibir botões rápidos para incrementar (+), decrementar (-) e zerar a contagem.

#### 2. Fluxo de Turnos & Self-Healing
- **FR-004**: O sistema DEVE respeitar a sequência obrigatória de turnos configurada pelo gestor.
- **FR-005**: Ao iniciar um turno, o sistema DEVE rodar a verificação de self-healing e auto-gerar registros como "NÃO REALIZADO" para turnos anteriores faltantes do mesmo dia.
- **FR-006**: O sistema DEVE salvar rascunhos em IndexedDB localmente por setor e turno enquanto não finalizados.
- **FR-007**: Setores concluídos DEVEM entrar em modo somente leitura para a operação. A reabertura só pode ser feita pelo gestor.

#### 3. WMS & Pedidos (Gestão)
- **FR-008**: O sistema DEVE calcular o estoque atual de cada produto com base na fórmula: `último inventário + recebimentos posteriores`.
- **FR-009**: O sistema DEVE calcular o consumo e sugerir compras usando a fórmula WMS.
- **FR-010**: O sistema DEVE agrupar simulações de compra por fornecedor e permitir compartilhar o pedido via WhatsApp ou área de transferência.
- **FR-011**: O sistema DEVE gerenciar o status do ciclo de vida dos pedidos: `Simulado → Enviado → Recebido/Divergente/Cancelado`.

#### 4. Crédito Loja (Fiado)
- **FR-012**: O sistema DEVE barrar débitos que ultrapassem o `limite_global_fiado` cadastrado nas configurações.
- **FR-013**: Apenas gestores PODEM lançar quitações (totais ou parciais) de crédito.

### Key Entities

- **usuarios**: Tabela de usuários integrados ao Supabase Auth, contendo nome, e-mail, role (`gestao` ou `operacional`) e status ativo.
- **configuracoes**: Tabela chave-valor para salvar parâmetros do sistema (ex: PIN, limite global de fiado, e-mails de alerta).
- **turnos**: Cadastro dinâmdynamic de turnos com horário de início, término e ordem sequencial obrigatória.
- **setores**: Divisões físicas da padaria (ex: Padaria, Frios, Mercearia).
- **produtos**: Catálogo de itens com setor, unidade de medida, estoque mínimo e periodicidade.
- **produtos_fornecedores**: Preço unitário acordado com cada fornecedor (chave composta).
- **funcionarios**: Cadastro de colaboradores elegíveis ao sistema de fiado.
- **lancamentos_op**: Lançamentos operacionais de inventários, sobras ou perdas por turno.
- **lancamentos_itens**: Itens das contagens associadas ao lançamento principal.
- **pedidos_compra** e **pedidos_itens**: Pedidos de reposição gerados no WMS.
- **recebimentos_itens**: Itens conferidos fisicamente em recebimentos.
- **credito_movimentos**: Registro de retiradas, adiantamentos e quitações de fiado.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O operador deve ser capaz de concluir a contagem de um setor usando 100% de comandos de voz (mãos livres) em menos de 3 minutos.
- **SC-002**: Redução a zero de "turnos em aberto órfãos" no banco de dados graças ao sistema de self-healing.
- **SC-003**: 100% das sugestões de compras e simulações calculadas sem divergência aritmética em relação à fórmula especificada no PRD.
- **SC-004**: Garantia de que nenhuma conta operacional consiga lançar quitações ou reabrir turnos confirmados.

---

## Assumptions

- O dispositivo celular da padaria roda navegador Chrome atualizado com suporte completo a Web Speech API.
- A autenticação via Google OAuth 2.0 é exclusiva para contas do perfil `gestao`.
- Os operadores compartilharão um único dispositivo logado na área operacional com validação de PIN numérico.
