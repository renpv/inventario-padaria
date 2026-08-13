# Data Model: Padaria Inventário & WMS

This document outlines the database schema (14 tables) implemented in PostgreSQL / Supabase, including relationships, constraints, and audit columns.

## Database Entities

### 1. `usuarios`
Represents users integrated with Supabase Auth.
- `id_usuario` (UUID, PK, Default: `gen_random_uuid()`)
- `auth_user_id` (UUID, FK -> `auth.users`, UNIQUE, Nullable)
- `nome` (VARCHAR(100), NOT NULL)
- `email` (VARCHAR(255), UNIQUE, NOT NULL)
- `role` (role_enum, NOT NULL, DEFAULT 'operacional')
- `ativo` (ativo_enum, NOT NULL, DEFAULT 'SIM')
- `created_at` (TIMESTAMPTZ, DEFAULT `now()`)
- `updated_at` (TIMESTAMPTZ, DEFAULT `now()`)

### 2. `configuracoes`
System parameters stored as key-value pairs.
- `id_config` (UUID, PK)
- `chave` (VARCHAR(100), UNIQUE, NOT NULL)
- `valor` (TEXT, NOT NULL)
- `descricao` (TEXT)
- `created_at` (TIMESTAMPTZ, DEFAULT `now()`)
- `updated_at` (TIMESTAMPTZ, DEFAULT `now()`)

### 3. `turnos`
Dynamically configured work shifts.
- `id_turno` (UUID, PK)
- `nome_turno` (VARCHAR(50), NOT NULL)
- `ordem` (INT, UNIQUE, NOT NULL)
- `horario_inicio` (TIME, NOT NULL)
- `horario_fim` (TIME, NOT NULL)
- `notificacao_tipo` (notificacao_enum, NOT NULL, DEFAULT 'nenhuma')
- `ativo` (ativo_enum, NOT NULL, DEFAULT 'SIM')
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 4. `setores`
Bakery sectors/categories.
- `id_setor` (UUID, PK)
- `nome_setor` (VARCHAR(100), NOT NULL)
- `ativo` (ativo_enum, NOT NULL, DEFAULT 'SIM')
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 5. `fornecedores`
Vendor details.
- `id_fornecedor` (UUID, PK)
- `nome` (VARCHAR(150), NOT NULL)
- `pedido_minimo` (NUMERIC(10,2), DEFAULT 0.00)
- `taxa_entrega` (NUMERIC(10,2), DEFAULT 0.00)
- `ativo` (ativo_enum, NOT NULL, DEFAULT 'SIM')
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 6. `produtos`
Bakery products catalogue.
- `id_produto` (UUID, PK)
- `id_setor` (UUID, FK -> `setores`, NOT NULL)
- `nome_produto` (VARCHAR(150), NOT NULL)
- `unidade_medida` (VARCHAR(20), NOT NULL)
- `estoque_minimo` (NUMERIC(10,3), DEFAULT 0.000)
- `periodicidade_compra` (periodicidade_enum, NOT NULL)
- `ativo` (ativo_enum, NOT NULL, DEFAULT 'SIM')
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 7. `produtos_fornecedores`
Price registry for product-vendor relations.
- `id_produto` (UUID, FK -> `produtos`, PK)
- `id_fornecedor` (UUID, FK -> `fornecedores`, PK)
- `valor_unitario` (NUMERIC(10,2), NOT NULL)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 8. `funcionarios`
Staff registration for store credit.
- `id_funcionario` (UUID, PK)
- `nome` (VARCHAR(150), NOT NULL)
- `ativo` (ativo_enum, NOT NULL, DEFAULT 'SIM')
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 9. `lancamentos_op`
Operational logs for inventories, losses, or leftovers.
- `id_lancamento` (UUID, PK)
- `data` (TIMESTAMPTZ, NOT NULL, DEFAULT `now()`)
- `id_turno` (UUID, FK -> `turnos`, NOT NULL)
- `tipo` (tipo_lancamento_enum, NOT NULL)
- `status` (status_lancamento_enum, NOT NULL, DEFAULT 'EM ANDAMENTO')
- `justificativa_forca` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 10. `lancamentos_itens`
Items counted inside an operational log.
- `id_item_op` (UUID, PK)
- `id_lancamento` (UUID, FK -> `lancamentos_op`, NOT NULL)
- `id_produto` (UUID, FK -> `produtos`, NOT NULL)
- `qtd_loja` (NUMERIC(10,3), NOT NULL, DEFAULT 0.000)
- `qtd_estoque` (NUMERIC(10,3), NOT NULL, DEFAULT 0.000)
- `qtd_total` (NUMERIC(10,3), NOT NULL, DEFAULT 0.000)
- `observacao_motivo` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 11. `pedidos_compra`
WMS orders.
- `id_pedido` (UUID, PK)
- `data_geracao` (TIMESTAMPTZ, DEFAULT `now()`)
- `id_fornecedor` (UUID, FK -> `fornecedores`, NOT NULL)
- `valor_produtos` (NUMERIC(10,2), NOT NULL)
- `taxa_entrega` (NUMERIC(10,2), DEFAULT 0.00)
- `valor_total` (NUMERIC(10,2), NOT NULL)
- `status` (status_pedido_enum, NOT NULL, DEFAULT 'Simulado')
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 12. `pedidos_itens`
Items on a purchase order.
- `id_pedido_item` (UUID, PK)
- `id_pedido` (UUID, FK -> `pedidos_compra`, NOT NULL)
- `id_produto` (UUID, FK -> `produtos`, NOT NULL)
- `quantidade` (NUMERIC(10,3), NOT NULL)
- `valor_unit_aplicado` (NUMERIC(10,2), NOT NULL)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 13. `recebimentos_itens`
Receiving logs.
- `id_recebimento_item` (UUID, PK)
- `id_pedido` (UUID, FK -> `pedidos_compra`, NULLABLE)
- `id_produto` (UUID, FK -> `produtos`, NOT NULL)
- `qtd_esperada` (NUMERIC(10,3), NOT NULL)
- `qtd_recebida` (NUMERIC(10,3), NOT NULL)
- `divergencia` (divergencia_enum, NOT NULL)
- `observacao` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 14. `credito_movimentos`
Financial movements for staff credit (fiado).
- `id_movimento` (UUID, PK)
- `id_funcionario` (UUID, FK -> `funcionarios`, NOT NULL)
- `data` (TIMESTAMPTZ, NOT NULL, DEFAULT `now()`)
- `tipo` (tipo_credito_enum, NOT NULL)
- `id_produto` (UUID, FK -> `produtos`, NULLABLE)
- `quantidade` (NUMERIC(10,3), NULLABLE)
- `valor` (NUMERIC(10,2), NOT NULL)
- `observacao` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

## Custom Enums in Postgres

- `ativo_enum`: `'SIM'`, `'NÃO'`
- `role_enum`: `'operacional'`, `'gestao'`
- `notificacao_enum`: `'push'`, `'email'`, `'nenhuma'`
- `tipo_lancamento_enum`: `'Inventário'`, `'Sobra'`, `'Perda'`
- `status_lancamento_enum`: `'EM ANDAMENTO'`, `'CONFIRMADO'`, `'NÃO REALIZADO'`
- `periodicidade_enum`: `'Semanal'`, `'Quinzenal'`, `'Mensal'`, `'Não se aplica'`
- `status_pedido_enum`: `'Simulado'`, `'Enviado'`, `'Recebido'`, `'Recebido com Divergências'`, `'Cancelado'`
- `divergencia_enum`: `'Conforme'`, `'Faltou'`, `'Veio a mais'`, `'Veio trocado'`
- `tipo_credito_enum`: `'Adiantamento'`, `'Retirada de produto'`, `'Quitação total'`, `'Quitação parcial'`
