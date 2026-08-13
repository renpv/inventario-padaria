-- RPC: iniciar_turno
-- Inicia um turno operacional garantindo a auditoria de turnos anteriores via self-healing
CREATE OR REPLACE FUNCTION iniciar_turno(target_id_turno UUID, data_operacional TIMESTAMPTZ)
RETURNS UUID AS $$
DECLARE
    target_ordem INT;
    turno_record RECORD;
    existing_id UUID;
    novo_lancamento_id UUID;
BEGIN
    -- 1. Obter a ordem do turno alvo
    SELECT ordem INTO target_ordem FROM turnos WHERE id_turno = target_id_turno;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Turno com ID % não encontrado', target_id_turno;
    END IF;

    -- 2. Executar Self-Healing: verificar turnos anteriores com ordem < target_ordem
    FOR turno_record IN 
        SELECT id_turno, nome_turno 
        FROM turnos 
        WHERE ordem < target_ordem AND ativo = 'SIM'
        ORDER BY ordem ASC
    LOOP
        -- Verificar se existe lançamento para este turno no mesmo dia operacional (data calendário correspondente)
        SELECT id_lancamento INTO existing_id 
        FROM lancamentos_op 
        WHERE id_turno = turno_record.id_turno 
          AND data::date = data_operacional::date;

        -- Se não existe, injeta o registro automático de "NÃO REALIZADO"
        IF NOT FOUND THEN
            INSERT INTO lancamentos_op (
                data,
                id_turno,
                tipo,
                status,
                justificativa_forca
            ) VALUES (
                data_operacional,
                turno_record.id_turno,
                'Inventário',
                'NÃO REALIZADO',
                'Turno não realizado — registro automático'
            );
        END IF;
    END LOOP;

    -- 3. Iniciar o turno alvo (Operação Idempotente)
    SELECT id_lancamento INTO existing_id 
    FROM lancamentos_op 
    WHERE id_turno = target_id_turno 
      AND data::date = data_operacional::date;

    IF FOUND THEN
        -- Retorna o ID existente se já estiver em andamento
        RETURN existing_id;
    ELSE
        -- Cria um novo lançamento com status 'EM ANDAMENTO'
        INSERT INTO lancamentos_op (
            data,
            id_turno,
            tipo,
            status
        ) VALUES (
            data_operacional,
            target_id_turno,
            'Inventário',
            'EM ANDAMENTO'
        ) RETURNING id_lancamento INTO novo_lancamento_id;

        RETURN novo_lancamento_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
