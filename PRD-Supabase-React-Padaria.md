# Documento de Requisitos do Produto (PRD)

**Projeto:** Sistema de Inventário e WMS (Padaria)
**Versão:** 3.0
**Data:** 2026-08-12
**Stack alvo:** Supabase (PostgreSQL + Auth) + React (SPA/PWA) + Web Speech API (voz)

> Este documento descreve o comportamento exigido do sistema com detalhe
> suficiente para reimplementá-lo na stack Supabase + React. As seções 6
> (modelo de dados), 7 (contrato de API) e 8 (regras de cálculo) existem para
> esse fim: sem elas, o comportamento observável não é reproduzível.

---

### 7.1. Políticas de Acesso
- O aplicativo adota o modelo de bloqueio por **Whitelist (Lista Branca)** para gestores.
- Novos usuários que tentarem fazer login via Google OAuth só terão acesso permitido se o seu e-mail já houver sido pré-cadastrado na tabela `usuarios` por um administrador.
- Se o e-mail não constar na Whitelist, o gatilho (`handle_new_user`) do banco de dados abortará a criação da conta na camada de Autenticação, garantindo segurança hermética contra acessos não autorizados.

## 1. Visão Geral

Aplicação para uma padaria, cobrindo três domínios:

1. **Operação de chão de loja** — inventário por turno e setor, sobras, perdas e crédito de funcionários.
2. **Suprimentos (WMS)** — cálculo de sugestão de compra, simulação por fornecedor e conferência de recebimento.
3. **Crédito Loja (fiado)** — débitos lançados pela operação, quitações exclusivas da gestão.

**Objetivo principal:** reduzir significativamente o tempo gasto nos inventários diários (quantidade configurável de turnos), usando captura por voz, ao mesmo tempo em que centraliza pedidos, estoques, perdas e fiado em um sistema fácil de usar.

**Stack alvo:**

- **Backend:** Supabase, usando PostgreSQL como banco relacional, autenticação de usuários (Google OAuth 2.0) e, quando necessário, Edge Functions para lógica adicional.
- **Frontend:** aplicação React, servida como PWA (Progressive Web App), instalada nos celulares da operação e da gestão. Design **mobile-first** (ambos os perfis operam exclusivamente em celular).
- **Voz:** Web Speech API (SpeechRecognition) para captura por voz, rodando em página de topo em navegador Chrome.
- **Hospedagem:** Vercel (frontend) + Supabase (backend).

O sistema é dimensionado para uma única unidade, com dezenas de produtos e milhares de lançamentos por ano.

---

## 2. Atores, Acesso e Autenticação

### 2.1 Perfis de usuários

- **Operação (app operacional)** — funcionários no balcão, usando o celular compartilhado da padaria para inventário, sobras, perdas, recebimento de mercadoria e lançamento de débitos. Não possuem conta individual no sistema.
- **Gestão (app de gestão)** — proprietário/gestor, usando o app para cadastros, pedidos, recebimentos, quitações de crédito, dashboards, alertas e configurações. Possuem conta individual via Google OAuth 2.0.

### 2.2 Autenticação

O sistema utiliza dois mecanismos de autenticação distintos:

#### 2.2.1 Gestão — Google OAuth 2.0

- Autenticação via Supabase Auth, exclusivamente com **Google OAuth 2.0**.
- Não existe login por e-mail/senha.
- Pode haver múltiplos gestores. O papel `gestao` é o nível mais alto do sistema (não existe superadmin).
- Apenas um gestor existente pode cadastrar novos usuários e atribuir papéis.

#### 2.2.2 Operação — PIN compartilhado

- A área operacional **não exige login individual**.
- O acesso é protegido por um **PIN numérico único**, compartilhado entre todos os funcionários.
- O PIN é configurado pelo gestor na tela de configurações.
- O PIN é validado contra a configuração armazenada no banco.
- Há um único celular da padaria compartilhado entre os funcionários para a operação.

### 2.3 Perfis e autorização

- Cada usuário gestor possui um registro na tabela `usuarios` com FK para `auth.users` e coluna `role`:
  - `operacional` — perfil de operação (usado internamente para RLS da sessão PIN).
  - `gestao` — perfil de gestão.

- **Modelo de acesso adotado:**
  - A autorização é sempre validada no servidor ou na camada de API; esconder botões na interface não é considerado controle de acesso.

### 2.4 Apps e rotas

- App operacional: rota principal `/` na aplicação React (acesso via PIN).
- App de gestão: rota principal `/gestao` (acesso via Google OAuth).

A mesma PWA serve ambos os perfis; o menu e as telas disponíveis dependem do tipo de sessão autenticada.

### 2.5 Microfone e navegador

- A captura por voz depende da **Web Speech API**, disponível principalmente no Chrome.
- O frontend é servido em **página de topo** (domínio próprio ou subdomínio), sem iframe de terceiros, garantindo acesso ao microfone.
- Caso algum embedding via iframe seja usado futuramente, é obrigatório declarar `allow="microphone"` na tag do iframe, ou a voz não funcionará.

---

## 3. Requisitos Funcionais — Operação

### RF-01 | Captura por voz

Transcrição de áudio em pares (produto, quantidade), cruzando com o cadastro do setor por fuzzy matching (Levenshtein) e expressões regulares.

- **RF-01.1 — Ditado de zero:** os termos `zero`, `zerado`, `nenhum`, `nenhuma`, `sem` e `nada` registram explicitamente a quantidade `0`.
- **RF-01.2 — Contagem zero é contagem válida:** produto com quantidade `0` conta como conferido; não entra na lista de pendentes nem exige justificativa.
- **RF-01.3 — Ação rápida:** cada campo numérico (loja e retaguarda) possui botões de incremento, decremento e zeramento.
- **RF-01.4 — Unidade visível:** a unidade de medida aparece ao lado do nome do produto.

Implementação:

- O reconhecimento de voz é feito no frontend React via Web Speech API.
- O texto reconhecido é interpretado localmente, aplicado fuzzy matching contra a lista de produtos do setor carregada do Supabase, e a quantidade é extraída via regex.

### RF-02 | Sequência obrigatória de turnos

Os turnos do dia são **configuráveis pelo gestor** (quantidade, nomes e horários de referência). O sistema é pré-configurado com 4 turnos padrão: `Manhã - entrada` (05:00), `Manhã - saída` (11:00), `Tarde - entrada` (15:00), `Tarde - saída` (17:00), mas o gestor pode alterar livremente.

- **Configuração de turnos:** o gestor define, pela tela de configurações:
  - **Nome** do turno (texto livre, ex: "Abertura", "Almoço", "Fechamento").
  - **Ordem de execução** (inteiro sequencial, define a sequência obrigatória).
  - **Horário de início e término** (define a janela válida do turno, ex: 00:00 até 09:00. Se o inventário não for iniciado dentro desta janela, será considerado "não realizado").
  - **Notificação:** o gestor pode configurar se deseja receber notificação através de checkboxes (push, email, nenhuma) para cada turno específico.
- **Alterações nos turnos** só afetam dias futuros. Lançamentos de dias anteriores preservam o turno original.
- **Horários de corte:** devem ser implementados para determinar o dia operacional, sempre dentro do mesmo dia calendário.
- Um turno só fica acessível quando o anterior (pela ordem de execução) estiver **encerrado** (`CONFIRMADO`) ou marcado como `NÃO REALIZADO`.
- Caso contrário, o turno aparece como `🔒 Bloqueado` e recusa o toque com aviso.
- O turno é escolhido no dashboard operacional e exibido como título fixo na tela de inventário.
- **Apenas um dispositivo por vez** pode operar o turno (celular único compartilhado).

### RF-03 | Visão de setores do turno

- São exibidos apenas os setores que possuem ao menos um produto ativo.
- O setor deve ser exibido mesmo que seu estoque atual esteja zerado, desde que possua produtos ativos.
- Setores sem produto ficam ocultos.
- Não há sequência obrigatória entre setores: o operador alterna livremente, e vários podem estar parcialmente contados ao mesmo tempo.

### RF-04 | Rascunho local em tempo real

Itens ditados ou digitados são gravados no dispositivo a cada alteração.

- Sair do setor e voltar preserva o rascunho.
- O rascunho é descartado apenas quando o setor é concluído e enviado ao servidor.

Implementação:

- O rascunho é guardado em storage local (IndexedDB/localStorage) por setor e turno.
- Ao reconectar ou concluir, os itens são sincronizados com Supabase.

### RF-05 | Fechamento forçado por setor

Havendo produtos não contados, a ação de conclusão vira **"Forçar Fechamento"** e abre um modal dedicado de justificativa.

- O campo de justificativa sempre abre limpo.
- A justificativa é obrigatória e pode ser digitada ou ditada por voz.
- A justificativa fica registrada no lançamento do turno para auditoria e para o e-mail de fechamento.

### RF-06 | Setor concluído em modo leitura

Reabrir um setor já concluído exibe banner explicativo e bloqueia edição.

- O estado de "setor concluído" é calculado a partir dos itens já gravados no lançamento do turno no banco.
- Guardar esse estado apenas no navegador não é permitido, para que o progresso não desapareça em refresh ou troca de aparelho.
- **Reabertura:** apenas o gestor pode reabrir um setor concluído, via tela de gestão. A operação nunca pode reabrir.

### RF-07 | Ciclo de vida do turno

Estados de um lançamento de turno:

```text
(inexistente) ──iniciar──► EM ANDAMENTO ──encerrar──► CONFIRMADO
                                 │                         │
                      (turno pulado, via self-healing)      │ (gestor reabre)
                                 ▼                         ▼
                          NÃO REALIZADO              EM ANDAMENTO
```

- **Iniciar** um turno cria o lançamento com status `EM ANDAMENTO`. A operação é idempotente: reabrir o turno ou trocar de setor reaproveita o mesmo lançamento, nunca cria outro.
- **Concluir um setor** grava apenas a contagem dos produtos daquele setor; não altera o status do turno.
- **Encerrar o turno** é ação explícita do operador, disponível somente quando todos os setores válidos têm contagem.
  - Ao encerrar, grava `CONFIRMADO`, libera o turno seguinte e retorna ao dashboard.
- O encerramento é recusado enquanto houver setor sem contagem, listando os setores pendentes, salvo quando acompanhado de justificativa (fechamento forçado).
- Um turno `EM ANDAMENTO` continua sendo o turno atual do dia e não libera o próximo.
- **Reabertura pelo gestor:** o gestor pode reabrir um turno `CONFIRMADO`, voltando-o para `EM ANDAMENTO`. A operação nunca pode reabrir turnos.

### RF-08 | Tratamento de omissão (self-healing)

Ao iniciar um turno, o sistema verifica os turnos anteriores do mesmo dia e tipo.

- Para cada turno anterior que não exista, injeta um registro com status `NÃO REALIZADO` e justificativa automática.
- Isso mantém a série do dia completa e auditável, sem impedir o trabalho.

### RF-09 | Recebimento de mercadoria pela operação

A conferência de entrega pode ser feita por funcionários na área operacional, por voz ou digitação.

- Não exige perfil de gestor.
- A interface segue o mesmo padrão do inventário (lista de itens, contagem por voz ou manual).
- **Modalidades:** o recebimento pode ser:
  - **Vinculado a pedido:** o operador seleciona um pedido de compra existente e confere os itens.
  - **Avulso:** o operador registra o recebimento sem vínculo com pedido prévio.

### RF-10 | Consulta pública de estoque

Área operacional com busca em tempo real do saldo consolidado (loja + retaguarda) dos produtos ativos.

- Usa um endpoint público com payload reduzido (produto, unidade, quantidade, mínimo).
- O dashboard de estoques da gestão, que expõe setor e indicadores gerenciais, permanece restrito.

### RF-11 | Sobras e perdas

Lançamento por setor, no mesmo modelo do inventário (voz ou manual), gravado como lançamento operacional de tipo próprio (`Sobra`, `Perda`).

- Sobras e perdas são **exclusivamente para auditoria e relatórios**.
- **Não alteram** o estoque atual do produto (ver seção 8 — Regras de Cálculo).

### RF-12 | Operação offline

Sem conexão, as ações de escrita da área operacional são enfileiradas no dispositivo e sincronizadas quando a conexão volta.

- O usuário é avisado de que o lançamento foi salvo localmente.
- O indicador de estado (online/offline) fica visível na barra superior.
- **Leitura offline:** a lista de produtos e setores fica em cache (IndexedDB/Service Worker) para funcionar sem conexão.

---

## 4. Requisitos Funcionais — Gestão

### RF-13 | Cadastros

CRUD de:

- Setores.
- Produtos.
- Fornecedores.
- Funcionários.
- Tabela de preços Produto × Fornecedor.

Exclusão é lógica (`ativo = 'NÃO'`) nas entidades de cadastro (Setores, Produtos, Fornecedores, Funcionários). Na tabela de preços, exclusão é física.

### RF-14 | Cálculo de consumo

Para cada produto, considera os lançamentos de inventário **confirmados** dentro da janela definida pela periodicidade de compra do produto.

- A janela é `hoje - dias da periodicidade do produto`.
- Implementado via consultas SQL em Postgres.

### RF-15 | Sugestão de compra (fórmula WMS)

```text
Qtd Sugerida = (Consumo do Período + Estoque Mínimo) − Estoque Atual
```

- Produtos com sugestão menor ou igual a zero não entram na lista.
- Ver seção 8 para definição de "Estoque Atual".

### RF-16 | Simulação de compra

Agrupa os itens por fornecedor e apresenta, para cada um:

- itens com preço unitário e subtotal;
- taxa de entrega;
- total;
- indicação se o pedido mínimo foi atingido.

Ao selecionar um fornecedor, o sistema deve exibir um botão **"Realizar pedido"**, já preenchido com a quantidade sugerida (RF-15) de cada produto daquele fornecedor.
Na tela de gerar o pedido, deve haver opções para **copiar o pedido para a área de transferência** e um botão para **compartilhar o conteúdo do pedido diretamente no WhatsApp**.

A consolidação gera um pedido por fornecedor.

- Quando o produto tem **múltiplos fornecedores**, o sistema sugere o de **menor preço**, mas o gestor pode trocar manualmente.
- Quando o total **não atinge o pedido mínimo** do fornecedor, o sistema exibe aviso visual e pede **confirmação explícita** para prosseguir.

### RF-17 | Recebimento e conferência

Cruza quantidade pedida com recebida, classificando cada item:

| Situação                     | Classificação         |
|------------------------------|-----------------------|
| recebido = pedido            | `Conforme`            |
| recebido < pedido            | `Faltou`              |
| recebido > pedido            | `Veio a mais`         |
| produto não constava do pedido | `Veio trocado`      |
| item do pedido não conferido | `Faltou` (observação automática) |

O pedido termina como `Recebido` se tudo estiver conforme, ou `Recebido com Divergências` caso contrário.

### RF-18 | Alertas de fechamento

E-mail no fechamento do último turno do dia, com:

- resumo dos turnos;
- destaque para os fechamentos que tiveram justificativa.

A gestão configura destinatários e liga/desliga o envio pela tela de configurações.

### RF-19 | Dashboards

- **Estoques:** produtos ativos, quantidade atual, mínimo, setor, quantidade de produtos abaixo do mínimo e setor mais crítico. Filtro por setor.
- **Fiados:** total em aberto, quantidade de devedores, maior devedor e saldo por funcionário.
- **Operacional do dia:** status de todos os turnos configurados e qual é o turno atual. O número de turnos exibidos é dinâmico, baseado na tabela `turnos`.

Os dashboards são implementados via views e consultas SQL em Postgres, consumidos pelo frontend React.

### RF-20 | Configurações do sistema

Tela de configurações no app de gestão, permitindo ao gestor gerenciar:

- **Turnos do dia:** CRUD de turnos (nome, ordem de execução, horário de referência). Ver RF-02.
- **PIN operacional:** código numérico de acesso à área operacional.
- **Alertas por e-mail:** destinatários e liga/desliga do envio.
- **Limite global de fiado:** valor máximo de crédito por funcionário.
- **Push notifications:** liga/desliga e configuração de eventos.

As configurações são armazenadas em tabelas dedicadas no banco (`configuracoes` para chave-valor, `turnos` para turnos).

### RF-21 | Reabertura de setores e turnos

- Apenas o gestor pode reabrir setores concluídos e turnos confirmados.
- A operação nunca tem acesso a esta funcionalidade.
- A reabertura de um turno `CONFIRMADO` volta seu status para `EM ANDAMENTO`.
- A reabertura é registrada com timestamp para auditoria.

### RF-22 | Pedidos de compra — ciclo de vida

Transições de status dos pedidos de compra:

```text
Simulado ──(gestor confirma envio)──► Enviado ──(conferência)──► Recebido
    │                                    │                    ou Recebido com Divergências
    │                                    │
    └──(gestor cancela)──► Cancelado ◄───┘
```

- A transição `Simulado → Enviado` é ação manual do gestor (botão "Marcar como Enviado").
- **Cancelamento:** apenas o gestor pode cancelar. Permitido em qualquer status, **exceto** `Recebido` e `Recebido com Divergências`.
- Pedidos cancelados **não afetam** estoque (estoque só é impactado após recebimento efetivo).

---

## 5. Requisitos Funcionais — Crédito Loja

### RF-23 | Débitos pela operação

Registro de:

- adiantamento em espécie;
- retirada de produto para funcionário ativo.

Regras:

- Valor precisa ser positivo.
- **Valor é digitado manualmente** pelo operador (não existe preço de venda no sistema).
- Retirada de produto exige produto válido.
- **Limite global de fiado:** o sistema impede novos débitos quando o saldo do funcionário atinge o limite configurado pelo gestor.

### RF-24 | Quitações exclusivas da gestão

Quitação total (abate o saldo inteiro) ou parcial (valor informado).

- A área operacional não tem acesso a esta operação, nem na interface nem na API.

### RF-25 | Extrato e confirmação dupla

Extrato por funcionário com saldo acumulado em ordem cronológica.

- Edição e exclusão de movimento exigem confirmação dupla.
- São restritas à gestão.
- Funcionários desativados (`ativo = NÃO`) mantêm saldo visível para quitação pelo gestor.

---

## 6. Modelo de Dados

### 6.1 Convenções

- **IDs:** UUID gerado pelo Postgres (`gen_random_uuid()`), padrão Supabase.
- **Auditoria:** todas as tabelas possuem `created_at TIMESTAMPTZ DEFAULT now()` e `updated_at TIMESTAMPTZ DEFAULT now()` (atualizado via trigger).
- **Soft delete:** entidades de cadastro usam coluna `ativo` (`SIM`/`NÃO`). Demais tabelas não usam soft delete.
- **Idioma:** nomes de tabelas e colunas em português, consistente com o domínio.

### 6.2 Tabelas

O banco de dados é PostgreSQL, com 14 tabelas principais:

| Tabela                | Colunas principais                                                                 | Soft delete |
|-----------------------|-------------------------------------------------------------------------------------|-------------|
| `usuarios`            | `id_usuario` (PK, UUID), `auth_user_id` (FK → auth.users, UNIQUE), `nome`, `email`, `role` (enum), `ativo` | sim |
| `configuracoes`       | `id_config` (PK, UUID), `chave` (UNIQUE), `valor`, `descricao`                    | não         |
| `turnos`              | `id_turno` (PK, UUID), `nome_turno`, `ordem` (INT, UNIQUE), `horario_inicio` (TIME), `horario_fim` (TIME), `notificacao_tipo` (enum), `ativo` | sim |
| `setores`             | `id_setor` (PK, UUID), `nome_setor`, `ativo`                                      | sim         |
| `fornecedores`        | `id_fornecedor` (PK, UUID), `nome`, `pedido_minimo`, `taxa_entrega`, `ativo`      | sim         |
| `produtos`            | `id_produto` (PK, UUID), `id_setor` (FK), `nome_produto`, `unidade_medida`, `estoque_minimo`, `periodicidade_compra`, `ativo` | sim |
| `produtos_fornecedores` | `id_produto` (FK), `id_fornecedor` (FK), `valor_unitario` — PK composta          | não (exclusão física) |
| `funcionarios`        | `id_funcionario` (PK, UUID), `nome`, `ativo`                                      | sim         |
| `lancamentos_op`      | `id_lancamento` (PK, UUID), `data` (TIMESTAMPTZ), `id_turno` (FK → turnos), `tipo`, `status`, `justificativa_forca` | não |
| `lancamentos_itens`   | `id_item_op` (PK, UUID), `id_lancamento` (FK), `id_produto` (FK), `qtd_loja`, `qtd_estoque`, `qtd_total`, `observacao_motivo` | não |
| `pedidos_compra`      | `id_pedido` (PK, UUID), `data_geracao`, `id_fornecedor` (FK), `valor_produtos`, `taxa_entrega`, `valor_total`, `status` | não |
| `pedidos_itens`       | `id_pedido_item` (PK, UUID), `id_pedido` (FK), `id_produto` (FK), `quantidade`, `valor_unit_aplicado` | não |
| `recebimentos_itens`  | `id_recebimento_item` (PK, UUID), `id_pedido` (FK, nullable), `id_produto` (FK), `qtd_esperada`, `qtd_recebida`, `divergencia`, `observacao` | não |
| `credito_movimentos`  | `id_movimento` (PK, UUID), `id_funcionario` (FK), `data`, `tipo`, `id_produto` (FK, nullable), `quantidade`, `valor`, `observacao` | não (exclusão física, com confirmação dupla) |

> **Nota sobre `turnos`:** a tabela usa soft delete (`ativo`) para preservar referências históricas. Turnos desativados não aparecem no dashboard operacional, mas lançamentos antigos que os referenciam permanecem íntegros via FK.

> **Nota sobre `lancamentos_op.id_turno`:** o campo `turno` (texto/enum) foi substituído por `id_turno` (FK → `turnos`), garantindo integridade referencial e suporte a turnos dinâmicos.

> **Nota sobre `recebimentos_itens`:** o campo `id_pedido` é **nullable** para suportar recebimentos avulsos (sem pedido de compra vinculado).

### 6.3 Tabela `configuracoes` — Chaves previstas

| Chave                    | Tipo     | Descrição                                    | Valor padrão |
|--------------------------|----------|----------------------------------------------|-------------|
| `pin_operacional`        | string   | PIN de acesso à área operacional             | `1234`      |
| `email_alerta_ativo`     | boolean  | Liga/desliga envio de e-mail de fechamento   | `true`      |
| `email_alerta_destinos`  | string[] | Lista de e-mails destinatários (JSON)        | `[]`        |
| `limite_global_fiado`    | numeric  | Valor máximo de crédito por funcionário      | `0` (sem limite) |
| `push_notifications`     | boolean  | Liga/desliga push notifications              | `true`      |

### 6.4 Domínios de valores (enums)

Domínios modelados como enums em Postgres:

- `ativo_enum`: `SIM`, `NÃO`.
- `role_enum`: `operacional`, `gestao`.
- `notificacao_enum`: `push`, `email`, `nenhuma`.
- `tipo_lancamento_enum`: `Inventário`, `Sobra`, `Perda`.
- `status_lancamento_enum`: `EM ANDAMENTO`, `CONFIRMADO`, `NÃO REALIZADO`.
- `periodicidade_enum`: `Semanal` (7 dias), `Quinzenal` (15), `Mensal` (30), `Não se aplica` (fora do WMS).
- `status_pedido_enum`: `Simulado`, `Enviado`, `Recebido`, `Recebido com Divergências`, `Cancelado`.
- `divergencia_enum`: `Conforme`, `Faltou`, `Veio a mais`, `Veio trocado`.
- `tipo_credito_enum`: `Adiantamento`, `Retirada de produto`, `Quitação total`, `Quitação parcial`.

---

## 7. Contrato de API

### 7.1 Princípios

- **Supabase Client:** o frontend React usa o `@supabase/supabase-js` para comunicação direta com o Postgres via REST (PostgREST).
- **Controle de Acesso:** as lógicas de autorização são gerenciadas via funções da API ou diretamente pelo servidor, baseando-se no JWT do usuário autenticado (gestores) ou na validação da sessão PIN.
- **Edge Functions:** usadas apenas quando a lógica não pode ser expressa em SQL padrão ou validações simples (ex: envio de e-mail, push notifications, integrações).

### 7.2 Endpoints por domínio

#### Operação (sessão PIN)

| Operação                  | Método           | Recurso / RPC                    | Notas |
|---------------------------|------------------|----------------------------------|-------|
| Validar PIN               | `rpc`            | `validar_pin(pin)`               | Retorna booleano |
| Listar setores ativos     | `select`         | `setores` (filtro `ativo=SIM`)   | Cache offline |
| Listar produtos do setor  | `select`         | `produtos` (filtro setor + ativo)| Cache offline |
| Listar turnos ativos      | `select`         | `turnos` (filtro `ativo=SIM`, order by `ordem`) | Cache offline |
| Iniciar turno             | `rpc`            | `iniciar_turno(data, id_turno)`  | Idempotente |
| Gravar contagem de setor  | `insert/upsert`  | `lancamentos_itens`              | Via lançamento ativo |
| Encerrar turno            | `rpc`            | `encerrar_turno(id_lancamento, justificativa?)` | Valida setores pendentes |
| Lançar sobra/perda        | `insert`         | `lancamentos_op` + `lancamentos_itens` | Tipo `Sobra` ou `Perda` |
| Registrar recebimento     | `insert`         | `recebimentos_itens`             | Com ou sem pedido vinculado |
| Lançar débito (fiado)     | `insert`         | `credito_movimentos`             | Valida limite global |
| Consultar estoque público | `rpc`            | `consultar_estoque()`            | Payload reduzido |

#### Gestão (sessão Google OAuth)

| Operação                  | Método           | Recurso / RPC                    | Notas |
|---------------------------|------------------|----------------------------------|-------|
| CRUD Turnos               | `select/insert/update` | `turnos`                   | Soft delete. Alterações só afetam dias futuros |
| CRUD Setores              | `select/insert/update` | `setores`                  | Soft delete |
| CRUD Produtos             | `select/insert/update` | `produtos`                 | Soft delete |
| CRUD Fornecedores         | `select/insert/update` | `fornecedores`             | Soft delete |
| CRUD Funcionários         | `select/insert/update` | `funcionarios`             | Soft delete |
| CRUD Preços               | `select/insert/update/delete` | `produtos_fornecedores` | Exclusão física |
| Cálculo de consumo        | `rpc`            | `calcular_consumo()`             | View ou function |
| Sugestão de compra        | `rpc`            | `sugestao_compra()`              | Usa fórmula WMS |
| Gerar pedido              | `insert`         | `pedidos_compra` + `pedidos_itens` | Status `Simulado` |
| Marcar como enviado       | `update`         | `pedidos_compra`                 | Status → `Enviado` |
| Cancelar pedido           | `update`         | `pedidos_compra`                 | Exceto `Recebido` |
| Conferir recebimento      | `rpc`            | `conferir_recebimento(id_pedido, itens[])` | Classifica divergências |
| Reabrir setor/turno       | `rpc`            | `reabrir_turno(id_lancamento)`   | Volta para `EM ANDAMENTO` |
| Quitação de fiado         | `insert`         | `credito_movimentos`             | Tipo `Quitação` |
| Editar/excluir movimento  | `update/delete`  | `credito_movimentos`             | Confirmação dupla (frontend) |
| Dashboard estoques        | `rpc`            | `dashboard_estoques()`           | View materializada ou function |
| Dashboard fiados          | `rpc`            | `dashboard_fiados()`             | Agregações |
| Dashboard operacional     | `rpc`            | `dashboard_operacional(data)`    | Status dinâmico de todos os turnos ativos |
| Configurações (ler/salvar)| `select/update`  | `configuracoes`                  | Chave-valor |
| Gerenciar usuários        | `select/insert/update` | `usuarios`                 | Apenas gestores |

### 7.3 Edge Functions

| Função                    | Trigger / Chamada        | Descrição |
|---------------------------|--------------------------|-----------|
| `enviar_email_fechamento` | Chamada via webhook ou cron | Envia e-mail ao encerrar último turno do dia |
| `enviar_push_notification`| Chamada por eventos      | Push notification para turnos atrasados, pedidos entregues |

---

## 8. Regras de Cálculo

### 8.1 Estoque Atual

```text
Estoque Atual(produto) = Σ(qtd_loja + qtd_estoque) do último inventário CONFIRMADO
                        + Σ(recebimentos posteriores ao último inventário)
```

- O último inventário CONFIRMADO é o lançamento mais recente com `tipo = 'Inventário'` e `status = 'CONFIRMADO'`.
- **Recebimentos posteriores:** soma de `qtd_recebida` em `recebimentos_itens` para o produto, com data posterior ao timestamp do último inventário.
- **Sobras e perdas NÃO afetam** o estoque atual. São registros exclusivamente para auditoria.
- **Cancelamentos de pedidos** não afetam o estoque (estoque só muda com recebimento efetivo).

### 8.2 Consumo do Período

```text
Consumo(produto, período) = Estoque Inicial − Estoque Final + Recebimentos no Período
```

Onde:

- **Estoque Inicial:** estoque no inventário CONFIRMADO mais antigo dentro da janela.
- **Estoque Final:** estoque no inventário CONFIRMADO mais recente dentro da janela.
- **Janela:** `hoje - dias da periodicidade_compra do produto` até `hoje`.
- Implementado via consultas SQL em Postgres.

### 8.3 Sugestão de Compra

```text
Qtd Sugerida(produto) = (Consumo do Período + Estoque Mínimo) − (Estoque Atual + Qtd em Pedidos Enviados)
```

- **Qtd em Pedidos Enviados:** soma das quantidades deste produto que constam em pedidos de compra com status `Enviado` (ou seja, produtos já pedidos a outros fornecedores que ainda não chegaram). Isso evita pedir o mesmo item duas vezes de fornecedores diferentes. O estoque real só é alterado quando o pedido for `Recebido`.
- Se `Qtd Sugerida ≤ 0`, o produto **não aparece** na lista de sugestão.
- A sugestão é agrupada por fornecedor (menor preço como padrão, gestor pode trocar).

### 8.4 Saldo de Fiado

```text
Saldo(funcionário) = Σ(débitos) − Σ(quitações)
```

- Débitos: movimentos do tipo `Adiantamento` ou `Retirada de produto`.
- Quitações: movimentos do tipo `Quitação total` ou `Quitação parcial`.
- **Limite global:** se `Saldo + novo débito > limite_global_fiado`, o sistema recusa o lançamento (exceto se limite = 0, que significa sem limite).

### 8.5 Self-Healing de Turnos

Ao iniciar o turno `T` (com `ordem = N`) no dia `D`:

```text
Para cada turno ativo com ordem < N (consultando tabela `turnos`):
  Se não existe lançamento para esse turno no dia D:
    Criar lançamento com:
      - id_turno = turno.id_turno
      - data = agora
      - tipo = 'Inventário'
      - status = 'NÃO REALIZADO'
      - justificativa_forca = 'Turno não realizado — registro automático'
```

> **Nota:** o self-healing consulta dinamicamente a tabela `turnos` (filtro `ativo = SIM`) para determinar quais turnos anteriores verificar. Isso garante compatibilidade com qualquer número de turnos configurados.

### 8.6 Dia Operacional

- O dia operacional é determinado pela data calendário atual com **horários de corte**.
- Os horários de corte garantem que operações realizadas na madrugada (ex: 04:55) pertencem ao dia correto.
- Todos os turnos de um dia operacional pertencem ao mesmo dia calendário.

---

## 9. Requisitos Não-Funcionais

### RNF-01 | Interface e UX

- **Idioma:** português (sem internacionalização).
- **Tema:** dark mode como padrão. Paleta moderna com tons terrosos/quentes (identidade visual padaria).
- **Navegação:** bottom tabs em todas as telas (celular e desktop).
- **Dispositivos:** design mobile-first. Ambos os perfis (operação e gestão) operam exclusivamente em celular.
- **PWA:** aplicação instalável via Chrome, com ícone na tela inicial.

### RNF-02 | Offline

- **Escrita offline:** ações de escrita enfileiradas em IndexedDB e sincronizadas ao reconectar.
- **Leitura offline:** dados de produtos e setores em cache (Service Worker + IndexedDB).
- **Indicador:** barra superior exibe estado online/offline.

### RNF-03 | Push Notifications

- Notificações push via Service Worker para eventos:
  - Turno atrasado (não iniciado após horário previsto).
  - Pedido de compra entregue/recebido.
  - Outros eventos configuráveis pelo gestor.

### RNF-04 | Testes

- **Testes unitários:** regras de cálculo (estoque, consumo, sugestão WMS, self-healing, saldo de fiado).
- **Testes de integração:** fluxos completos com Supabase (RLS, CRUD, transições de status).
- **Testes E2E:** Cypress ou Playwright para fluxos críticos (inventário por turno, recebimento, fiado).

### RNF-05 | Deploy e CI/CD

- **Frontend:** Vercel, com HTTPS automático e deploy via Git.
- **Backend:** Supabase (plano free ou pro, conforme demanda).
- **CI/CD:** pipeline automatizado (GitHub Actions ou similar) para build, testes e deploy.

### RNF-06 | Segurança

- Autenticação Google OAuth 2.0 exclusiva (gestão).
- PIN operacional validado contra banco (não hardcoded).
- HTTPS obrigatório.

---

## 10. Escopo de Entrega

### 10.1 MVP (Primeira Entrega)

| RF    | Descrição                                 |
|-------|-------------------------------------------|
| RF-01 a RF-08 | Inventário por turno (voz, turnos configuráveis, setores, self-healing) |
| RF-11 | Sobras e perdas                           |
| RF-12 | Operação offline                          |
| RF-13 | Cadastros CRUD (setores, produtos, fornecedores, funcionários, preços) |
| RF-19 | Dashboards básicos (estoques, operacional) |
| RF-20 | Configurações do sistema                  |
| RNF-03| Push notifications                        |

### 10.2 Fase 2

| RF    | Descrição                                 |
|-------|-------------------------------------------|
| RF-14 a RF-16 | WMS: cálculo de consumo, sugestão e simulação de compra |
| RF-09, RF-17  | Recebimento e conferência                 |
| RF-22 | Ciclo de vida completo de pedidos         |

### 10.3 Fase 3

| RF    | Descrição                                 |
|-------|-------------------------------------------|
| RF-23 a RF-25 | Crédito Loja / Fiado completo             |
| RF-18 | Alertas por e-mail                        |
| RF-19 | Dashboard de fiados                       |
| RF-21 | Reabertura de setores e turnos            |