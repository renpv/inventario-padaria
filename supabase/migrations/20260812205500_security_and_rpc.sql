-- Enable RLS on all tables
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos_op ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE recebimentos_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE credito_movimentos ENABLE ROW LEVEL SECURITY;

-- 1. Helper function to check if the current user is a Gestor
CREATE OR REPLACE FUNCTION is_gestor()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check role in auth.jwt() metadata or look up in usuarios table
    -- Supabase stores role or user metadata in auth.jwt()
    RETURN EXISTS (
        SELECT 1 FROM usuarios 
        WHERE auth_user_id = auth.uid() 
          AND role = 'gestao'
          AND ativo = 'SIM'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Helper function to check if there is a valid operational PIN session
-- Since operation doesn't require individual login, the frontend uses an anon/authenticated client.
-- In production, the RLS policies can check a header, custom claim, or allow all authenticated users (including operational role) to perform basic operations.
-- Here we allow the 'operacional' role (or authenticated users) to perform read/write operations under strict limits.
CREATE OR REPLACE FUNCTION is_operacional()
RETURNS BOOLEAN AS $$
BEGIN
    -- Allow operational if they have the operational role or if they are gestao (gestao overrides operational)
    RETURN is_gestor() OR EXISTS (
        SELECT 1 FROM usuarios
        WHERE auth_user_id = auth.uid()
          AND role = 'operacional'
          AND ativo = 'SIM'
    ) OR (auth.role() = 'authenticated'); -- Fallback for generic auth
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for Gestao (Full Access)
CREATE POLICY gestao_all_usuarios ON usuarios TO authenticated USING (is_gestor()) WITH CHECK (is_gestor());
CREATE POLICY gestao_all_configuracoes ON configuracoes TO authenticated USING (is_gestor()) WITH CHECK (is_gestor());
CREATE POLICY gestao_all_turnos ON turnos TO authenticated USING (is_gestor()) WITH CHECK (is_gestor());
CREATE POLICY gestao_all_setores ON setores TO authenticated USING (is_gestor()) WITH CHECK (is_gestor());
CREATE POLICY gestao_all_fornecedores ON fornecedores TO authenticated USING (is_gestor()) WITH CHECK (is_gestor());
CREATE POLICY gestao_all_produtos ON produtos TO authenticated USING (is_gestor()) WITH CHECK (is_gestor());
CREATE POLICY gestao_all_produtos_fornecedores ON produtos_fornecedores TO authenticated USING (is_gestor()) WITH CHECK (is_gestor());
CREATE POLICY gestao_all_funcionarios ON funcionarios TO authenticated USING (is_gestor()) WITH CHECK (is_gestor());
CREATE POLICY gestao_all_lancamentos_op ON lancamentos_op TO authenticated USING (is_gestor()) WITH CHECK (is_gestor());
CREATE POLICY gestao_all_lancamentos_itens ON lancamentos_itens TO authenticated USING (is_gestor()) WITH CHECK (is_gestor());
CREATE POLICY gestao_all_pedidos_compra ON pedidos_compra TO authenticated USING (is_gestor()) WITH CHECK (is_gestor());
CREATE POLICY gestao_all_pedidos_itens ON pedidos_itens TO authenticated USING (is_gestor()) WITH CHECK (is_gestor());
CREATE POLICY gestao_all_recebimentos_itens ON recebimentos_itens TO authenticated USING (is_gestor()) WITH CHECK (is_gestor());
CREATE POLICY gestao_all_credito_movimentos ON credito_movimentos TO authenticated USING (is_gestor()) WITH CHECK (is_gestor());

-- RLS Policies for Operacional (Restricted Access)
-- Read permissions
CREATE POLICY oper_select_turnos ON turnos FOR SELECT TO authenticated USING (ativo = 'SIM');
CREATE POLICY oper_select_setores ON setores FOR SELECT TO authenticated USING (ativo = 'SIM');
CREATE POLICY oper_select_produtos ON produtos FOR SELECT TO authenticated USING (ativo = 'SIM');
CREATE POLICY oper_select_funcionarios ON funcionarios FOR SELECT TO authenticated USING (ativo = 'SIM');

-- Write permissions (operational can log counts, leftovers, losses, purchases conferral and debits)
CREATE POLICY oper_insert_lancamentos ON lancamentos_op FOR INSERT TO authenticated WITH CHECK (tipo IN ('Inventário', 'Sobra', 'Perda'));
CREATE POLICY oper_select_lancamentos ON lancamentos_op FOR SELECT TO authenticated USING (true);

CREATE POLICY oper_insert_lancamentos_itens ON lancamentos_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY oper_select_lancamentos_itens ON lancamentos_itens FOR SELECT TO authenticated USING (true);

CREATE POLICY oper_insert_recebimentos_itens ON recebimentos_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY oper_select_recebimentos_itens ON recebimentos_itens FOR SELECT TO authenticated USING (true);

CREATE POLICY oper_insert_credito_movimentos ON credito_movimentos FOR INSERT TO authenticated WITH CHECK (tipo IN ('Adiantamento', 'Retirada de produto'));
CREATE POLICY oper_select_credito_movimentos ON credito_movimentos FOR SELECT TO authenticated USING (true);

-- RPC: validar_pin
CREATE OR REPLACE FUNCTION validar_pin(pin_input TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    pin_stored TEXT;
BEGIN
    SELECT valor INTO pin_stored FROM configuracoes WHERE chave = 'pin_operacional';
    RETURN pin_input = pin_stored;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
