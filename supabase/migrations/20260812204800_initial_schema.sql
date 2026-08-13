-- Create Custom Enums
CREATE TYPE ativo_enum AS ENUM ('SIM', 'NÃO');
CREATE TYPE role_enum AS ENUM ('operacional', 'gestao');
CREATE TYPE notificacao_enum AS ENUM ('push', 'email', 'nenhuma');
CREATE TYPE tipo_lancamento_enum AS ENUM ('Inventário', 'Sobra', 'Perda');
CREATE TYPE status_lancamento_enum AS ENUM ('EM ANDAMENTO', 'CONFIRMADO', 'NÃO REALIZADO');
CREATE TYPE periodicidade_enum AS ENUM ('Semanal', 'Quinzenal', 'Mensal', 'Não se aplica');
CREATE TYPE status_pedido_enum AS ENUM ('Simulado', 'Enviado', 'Recebido', 'Recebido com Divergências', 'Cancelado');
CREATE TYPE divergencia_enum AS ENUM ('Conforme', 'Faltou', 'Veio a mais', 'Veio trocado');
CREATE TYPE tipo_credito_enum AS ENUM ('Adiantamento', 'Retirada de produto', 'Quitação total', 'Quitação parcial');

-- Helper function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Table: usuarios
CREATE TABLE usuarios (
    id_usuario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role role_enum NOT NULL DEFAULT 'operacional',
    ativo ativo_enum NOT NULL DEFAULT 'SIM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_usuarios_updated_at
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 2. Table: configuracoes
CREATE TABLE configuracoes (
    id_config UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_configuracoes_updated_at
BEFORE UPDATE ON configuracoes
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Populate Default Configurations
INSERT INTO configuracoes (chave, valor, descricao) VALUES
('pin_operacional', '1234', 'PIN de acesso à área operacional'),
('email_alerta_ativo', 'true', 'Liga/desliga envio de e-mail de fechamento'),
('email_alerta_destinos', '[]', 'Lista de e-mails destinatários (JSON)'),
('limite_global_fiado', '0', 'Valor máximo de crédito por funcionário (0 = sem limite)'),
('push_notifications', 'true', 'Liga/desliga push notifications');

-- 3. Table: turnos
CREATE TABLE turnos (
    id_turno UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_turno VARCHAR(50) NOT NULL,
    ordem INT UNIQUE NOT NULL,
    horario_inicio TIME NOT NULL,
    horario_fim TIME NOT NULL,
    notificacao_tipo notificacao_enum NOT NULL DEFAULT 'nenhuma',
    ativo ativo_enum NOT NULL DEFAULT 'SIM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_turnos_updated_at
BEFORE UPDATE ON turnos
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Populate Default Shifts
INSERT INTO turnos (nome_turno, ordem, horario_inicio, horario_fim) VALUES
('Manhã - entrada', 1, '05:00:00', '11:00:00'),
('Manhã - saída', 2, '11:00:00', '15:00:00'),
('Tarde - entrada', 3, '15:00:00', '17:00:00'),
('Tarde - saída', 4, '17:00:00', '22:00:00');

-- 4. Table: setores
CREATE TABLE setores (
    id_setor UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_setor VARCHAR(100) NOT NULL,
    ativo ativo_enum NOT NULL DEFAULT 'SIM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_setores_updated_at
BEFORE UPDATE ON setores
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 5. Table: fornecedores
CREATE TABLE fornecedores (
    id_fornecedor UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(150) NOT NULL,
    pedido_minimo NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    taxa_entrega NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    ativo ativo_enum NOT NULL DEFAULT 'SIM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_fornecedores_updated_at
BEFORE UPDATE ON fornecedores
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 6. Table: produtos
CREATE TABLE produtos (
    id_produto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_setor UUID REFERENCES setores(id_setor) ON DELETE RESTRICT,
    nome_produto VARCHAR(150) NOT NULL,
    unidade_medida VARCHAR(20) NOT NULL,
    estoque_minimo NUMERIC(10,3) NOT NULL DEFAULT 0.000,
    periodicidade_compra periodicidade_enum NOT NULL,
    ativo ativo_enum NOT NULL DEFAULT 'SIM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_produtos_updated_at
BEFORE UPDATE ON produtos
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 7. Table: produtos_fornecedores
CREATE TABLE produtos_fornecedores (
    id_produto UUID REFERENCES produtos(id_produto) ON DELETE CASCADE,
    id_fornecedor UUID REFERENCES fornecedores(id_fornecedor) ON DELETE CASCADE,
    valor_unitario NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id_produto, id_fornecedor)
);

CREATE TRIGGER update_produtos_fornecedores_updated_at
BEFORE UPDATE ON produtos_fornecedores
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 8. Table: funcionarios
CREATE TABLE funcionarios (
    id_funcionario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(150) NOT NULL,
    ativo ativo_enum NOT NULL DEFAULT 'SIM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_funcionarios_updated_at
BEFORE UPDATE ON funcionarios
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 9. Table: lancamentos_op
CREATE TABLE lancamentos_op (
    id_lancamento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data TIMESTAMPTZ NOT NULL DEFAULT now(),
    id_turno UUID REFERENCES turnos(id_turno) ON DELETE RESTRICT,
    tipo tipo_lancamento_enum NOT NULL,
    status status_lancamento_enum NOT NULL DEFAULT 'EM ANDAMENTO',
    justificativa_forca TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_lancamentos_op_updated_at
BEFORE UPDATE ON lancamentos_op
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 10. Table: lancamentos_itens
CREATE TABLE lancamentos_itens (
    id_item_op UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_lancamento UUID REFERENCES lancamentos_op(id_lancamento) ON DELETE CASCADE,
    id_produto UUID REFERENCES produtos(id_produto) ON DELETE RESTRICT,
    qtd_loja NUMERIC(10,3) NOT NULL DEFAULT 0.000,
    qtd_estoque NUMERIC(10,3) NOT NULL DEFAULT 0.000,
    qtd_total NUMERIC(10,3) NOT NULL DEFAULT 0.000,
    observacao_motivo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_lancamentos_itens_updated_at
BEFORE UPDATE ON lancamentos_itens
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 11. Table: pedidos_compra
CREATE TABLE pedidos_compra (
    id_pedido UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_geracao TIMESTAMPTZ NOT NULL DEFAULT now(),
    id_fornecedor UUID REFERENCES fornecedores(id_fornecedor) ON DELETE RESTRICT,
    valor_produtos NUMERIC(10,2) NOT NULL,
    taxa_entrega NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    valor_total NUMERIC(10,2) NOT NULL,
    status status_pedido_enum NOT NULL DEFAULT 'Simulado',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_pedidos_compra_updated_at
BEFORE UPDATE ON pedidos_compra
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 12. Table: pedidos_itens
CREATE TABLE pedidos_itens (
    id_pedido_item UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pedido UUID REFERENCES pedidos_compra(id_pedido) ON DELETE CASCADE,
    id_produto UUID REFERENCES produtos(id_produto) ON DELETE RESTRICT,
    quantidade NUMERIC(10,3) NOT NULL,
    valor_unit_aplicado NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_pedidos_itens_updated_at
BEFORE UPDATE ON pedidos_itens
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 13. Table: recebimentos_itens
CREATE TABLE recebimentos_itens (
    id_recebimento_item UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pedido UUID REFERENCES pedidos_compra(id_pedido) ON DELETE SET NULL,
    id_produto UUID REFERENCES produtos(id_produto) ON DELETE RESTRICT,
    qtd_esperada NUMERIC(10,3) NOT NULL,
    qtd_recebida NUMERIC(10,3) NOT NULL,
    divergencia divergencia_enum NOT NULL,
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_recebimentos_itens_updated_at
BEFORE UPDATE ON recebimentos_itens
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 14. Table: credito_movimentos
CREATE TABLE credito_movimentos (
    id_movimento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_funcionario UUID REFERENCES funcionarios(id_funcionario) ON DELETE CASCADE,
    data TIMESTAMPTZ NOT NULL DEFAULT now(),
    tipo tipo_credito_enum NOT NULL,
    id_produto UUID REFERENCES produtos(id_produto) ON DELETE SET NULL,
    quantidade NUMERIC(10,3),
    valor NUMERIC(10,2) NOT NULL,
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_credito_movimentos_updated_at
BEFORE UPDATE ON credito_movimentos
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
