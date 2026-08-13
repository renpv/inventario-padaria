-- Test script for Fiado Security and Limits
BEGIN;

DO $$
DECLARE
    target_func_id UUID;
BEGIN
    INSERT INTO funcionarios (nome) VALUES ('Teste Funcionario') RETURNING id_funcionario INTO target_func_id;
    
    -- Setup limite_global_fiado to 50
    UPDATE configuracoes SET valor = '50' WHERE chave = 'limite_global_fiado';

    -- Test 1: Insert debit within limit (should succeed)
    INSERT INTO credito_movimentos (id_funcionario, tipo, valor)
    VALUES (target_func_id, 'Adiantamento', 30.00);

    -- Test 2: Insert debit exceeding limit (should fail with RAISE EXCEPTION)
    BEGIN
        INSERT INTO credito_movimentos (id_funcionario, tipo, valor)
        VALUES (target_func_id, 'Retirada de produto', 25.00);
        RAISE EXCEPTION 'Test failed: Should have blocked debit exceeding limit.';
    EXCEPTION WHEN OTHERS THEN
        -- Verify it's the limit exception
        IF SQLERRM NOT LIKE 'Limite de fiado excedido%' THEN
            RAISE EXCEPTION 'Test failed with unexpected error: %', SQLERRM;
        END IF;
    END;

    -- Test 3: Insert Quitação (should decrease balance, allowing more debits)
    INSERT INTO credito_movimentos (id_funcionario, tipo, valor)
    VALUES (target_func_id, 'Quitação parcial', 20.00);

    -- Saldo is now 10 (30 - 20). Limit is 50. 
    -- Test 4: Insert debit of 30 should now succeed (10 + 30 = 40 <= 50)
    INSERT INTO credito_movimentos (id_funcionario, tipo, valor)
    VALUES (target_func_id, 'Retirada de produto', 30.00);

    RAISE NOTICE 'All tests passed successfully.';
END $$;

ROLLBACK;
