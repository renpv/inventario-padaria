-- Migration to add fiado credit limit validation

CREATE OR REPLACE FUNCTION check_limite_global_fiado()
RETURNS TRIGGER AS $$
DECLARE
    limite NUMERIC;
    saldo_atual NUMERIC;
    total_debitos NUMERIC;
    total_quitacoes NUMERIC;
BEGIN
    -- Check limit only for new debits
    IF NEW.tipo IN ('Adiantamento', 'Retirada de produto') THEN
        -- Fetch global limit, fallback to 0 (no limit) if not found or empty
        SELECT COALESCE(NULLIF(valor, ''), '0')::NUMERIC INTO limite 
        FROM configuracoes 
        WHERE chave = 'limite_global_fiado';

        IF limite > 0 THEN
            -- Calculate total debits for the employee
            SELECT COALESCE(SUM(valor), 0) INTO total_debitos 
            FROM credito_movimentos 
            WHERE id_funcionario = NEW.id_funcionario 
              AND tipo IN ('Adiantamento', 'Retirada de produto');
              
            -- Calculate total clearances for the employee
            SELECT COALESCE(SUM(valor), 0) INTO total_quitacoes 
            FROM credito_movimentos 
            WHERE id_funcionario = NEW.id_funcionario 
              AND tipo IN ('Quitação total', 'Quitação parcial');
              
            saldo_atual := total_debitos - total_quitacoes;
            
            IF (saldo_atual + NEW.valor) > limite THEN
                RAISE EXCEPTION 'Limite de fiado excedido.';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_limite_global_fiado
BEFORE INSERT ON credito_movimentos
FOR EACH ROW EXECUTE PROCEDURE check_limite_global_fiado();
