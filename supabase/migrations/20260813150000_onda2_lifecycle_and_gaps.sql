-- ============================================================================
-- Onda 2: fecha o ciclo de vida real de turnos/setores (self-healing e
-- bloqueio sequencial passam a ser realmente usados pelo frontend) e cobre
-- lacunas de escopo do PRD (RF-10 consulta pública, RF-21 reabertura).
-- ============================================================================

-- 1. Permitir upsert de itens por (lançamento, produto).
-- Hoje o frontend cria um `lancamentos_op` novo por setor concluído, o que
-- contraria o RF-07 ("reabrir o turno ou trocar de setor reaproveita o mesmo
-- lançamento, nunca cria outro"). Ao corrigir isso no frontend, cada setor
-- passa a gravar seus itens sob o MESMO lançamento do turno/dia — o que exige
-- upsert por (id_lancamento, id_produto) em vez de sempre inserir.
--
-- Remove duplicidades pré-existentes (mantém o registro mais recente por
-- lançamento+produto) antes de aplicar a constraint, caso o ambiente já tenha
-- dados gravados sob o comportamento antigo.
DELETE FROM lancamentos_itens a
USING lancamentos_itens b
WHERE a.id_lancamento = b.id_lancamento
  AND a.id_produto = b.id_produto
  AND a.created_at < b.created_at;

ALTER TABLE lancamentos_itens
  ADD CONSTRAINT uq_lancamentos_itens_lancamento_produto UNIQUE (id_lancamento, id_produto);

-- Upsert via PostgREST precisa de permissão de UPDATE além do INSERT já
-- existente (`oper_insert_lancamentos_itens`).
CREATE POLICY oper_update_lancamentos_itens ON lancamentos_itens
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Defesa em profundidade para o RF-06 ("setor concluído entra em modo
-- leitura; só o gestor reabre"): bloqueia UPDATE em itens de um lançamento
-- que não esteja EM ANDAMENTO, a menos que quem execute seja gestor.
CREATE OR REPLACE FUNCTION check_lancamento_editable()
RETURNS TRIGGER AS $$
DECLARE
    v_status status_lancamento_enum;
BEGIN
    SELECT status INTO v_status FROM lancamentos_op WHERE id_lancamento = NEW.id_lancamento;
    IF v_status IS DISTINCT FROM 'EM ANDAMENTO' AND NOT is_gestor() THEN
        RAISE EXCEPTION 'Este lançamento já foi encerrado e só pode ser alterado pela gestão.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_check_lancamento_itens_editable
BEFORE UPDATE ON lancamentos_itens
FOR EACH ROW EXECUTE PROCEDURE check_lancamento_editable();

-- 2. RPC: encerrar_turno
-- Ação explícita de encerramento do turno (RF-07). Recusa se houver produto
-- ativo ainda sem contagem no lançamento, a menos que uma justificativa seja
-- informada (fechamento forçado no nível do turno — distinto da justificativa
-- por setor do RF-05, que já existe na tela de contagem).
CREATE OR REPLACE FUNCTION encerrar_turno(p_id_lancamento UUID, p_justificativa TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_status status_lancamento_enum;
    v_pendentes INT;
BEGIN
    SELECT status INTO v_status FROM lancamentos_op WHERE id_lancamento = p_id_lancamento;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lançamento % não encontrado', p_id_lancamento;
    END IF;

    IF v_status <> 'EM ANDAMENTO' THEN
        RAISE EXCEPTION 'Somente turnos EM ANDAMENTO podem ser encerrados (status atual: %)', v_status;
    END IF;

    SELECT COUNT(*) INTO v_pendentes
    FROM produtos p
    WHERE p.ativo = 'SIM'
      AND NOT EXISTS (
        SELECT 1 FROM lancamentos_itens li
        WHERE li.id_lancamento = p_id_lancamento AND li.id_produto = p.id_produto
      );

    IF v_pendentes > 0 AND (p_justificativa IS NULL OR btrim(p_justificativa) = '') THEN
        RAISE EXCEPTION 'Existem % produto(s) sem contagem. Informe uma justificativa para forçar o encerramento.', v_pendentes;
    END IF;

    UPDATE lancamentos_op
    SET status = 'CONFIRMADO',
        justificativa_forca = COALESCE(p_justificativa, justificativa_forca)
    WHERE id_lancamento = p_id_lancamento;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: reabrir_turno
-- Reabertura exclusiva da gestão (RF-06 / RF-21). Quando p_id_setor é
-- informado, reabre só aquele setor (apaga as contagens gravadas para os
-- produtos daquele setor dentro do lançamento, devolvendo-os ao estado "não
-- contado"). Quando p_id_setor é NULL, reabre o turno inteiro.
CREATE OR REPLACE FUNCTION reabrir_turno(p_id_lancamento UUID, p_id_setor UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    IF NOT is_gestor() THEN
        RAISE EXCEPTION 'Apenas gestores podem reabrir turnos ou setores.';
    END IF;

    IF p_id_setor IS NOT NULL THEN
        DELETE FROM lancamentos_itens li
        USING produtos p
        WHERE li.id_produto = p.id_produto
          AND li.id_lancamento = p_id_lancamento
          AND p.id_setor = p_id_setor;
    END IF;

    UPDATE lancamentos_op
    SET status = 'EM ANDAMENTO',
        justificativa_forca = COALESCE(justificativa_forca, '') ||
            format(E'\n[Reaberto pela gestão em %s%s]',
                   to_char(now(), 'YYYY-MM-DD HH24:MI'),
                   CASE WHEN p_id_setor IS NOT NULL THEN ' — setor específico' ELSE ' — turno completo' END)
    WHERE id_lancamento = p_id_lancamento;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: consultar_estoque
-- Consulta pública de estoque (RF-10), payload reduzido: produto, unidade,
-- quantidade consolidada (loja + retaguarda) e mínimo. Acessível a qualquer
-- sessão autenticada da área operacional (SECURITY DEFINER contorna as
-- policies de SELECT restritas por linha, mas o retorno já é deliberadamente
-- enxuto — sem setor nem indicadores gerenciais, que ficam só no dashboard
-- de gestão).
CREATE OR REPLACE FUNCTION consultar_estoque()
RETURNS TABLE (
    id_produto UUID,
    nome_produto VARCHAR,
    unidade_medida VARCHAR,
    estoque_atual NUMERIC,
    estoque_minimo NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id_produto, p.nome_produto, p.unidade_medida, get_estoque_atual(p.id_produto), p.estoque_minimo
    FROM produtos p
    WHERE p.ativo = 'SIM'
    ORDER BY p.nome_produto;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. view_dashboard_estoques: fornecedor sugerido real (RF-16)
-- A versão original desta view (20260812211500_wms_calculations.sql) não
-- trazia fornecedor nem preço — o frontend (WmsDashboard.tsx) preenchia isso
-- com dados fictícios ("Mocking supplier binding since view doesn't have it
-- directly"), o que tornava a simulação de compra inútil para gerar pedidos
-- reais. Esta versão faz o LEFT JOIN LATERAL em produtos_fornecedores e
-- escolhe o fornecedor de menor preço por padrão (RF-16).
CREATE OR REPLACE VIEW view_dashboard_estoques WITH (security_invoker = true) AS
SELECT
    p.id_produto,
    p.nome_produto,
    s.nome_setor,
    p.unidade_medida,
    p.estoque_minimo,
    get_estoque_atual(p.id_produto) AS estoque_atual,
    get_consumo_periodo(p.id_produto) AS consumo_periodo,
    get_sugestao_compra(p.id_produto) AS quantidade_sugerida,
    melhor.id_fornecedor AS id_fornecedor_sugerido,
    melhor.nome AS fornecedor_sugerido,
    melhor.valor_unitario AS valor_unitario_sugerido
FROM produtos p
JOIN setores s ON p.id_setor = s.id_setor
LEFT JOIN LATERAL (
    SELECT pf.id_fornecedor, f.nome, pf.valor_unitario
    FROM produtos_fornecedores pf
    JOIN fornecedores f ON f.id_fornecedor = pf.id_fornecedor AND f.ativo = 'SIM'
    WHERE pf.id_produto = p.id_produto
    ORDER BY pf.valor_unitario ASC
    LIMIT 1
) melhor ON true
WHERE p.ativo = 'SIM';

-- 6. RPC: conferir_recebimento (RF-09 / RF-17)
-- Classifica cada item recebido comparando com o esperado (quando vinculado
-- a um pedido) e grava os registros em recebimentos_itens. Atualiza o status
-- do pedido para 'Recebido' ou 'Recebido com Divergências' quando vinculado.
-- p_itens é um array JSON: [{"id_produto": "...", "qtd_recebida": 10}, ...]
CREATE OR REPLACE FUNCTION conferir_recebimento(p_id_pedido UUID, p_itens JSONB)
RETURNS VOID AS $$
DECLARE
    v_item JSONB;
    v_id_produto UUID;
    v_qtd_recebida NUMERIC;
    v_qtd_esperada NUMERIC;
    v_divergencia divergencia_enum;
    v_tem_divergencia BOOLEAN := false;
    v_produtos_recebidos UUID[] := '{}';
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_id_produto := (v_item->>'id_produto')::UUID;
        v_qtd_recebida := (v_item->>'qtd_recebida')::NUMERIC;
        v_produtos_recebidos := array_append(v_produtos_recebidos, v_id_produto);

        IF p_id_pedido IS NULL THEN
            -- Recebimento avulso: não há pedido para comparar.
            v_qtd_esperada := v_qtd_recebida;
            v_divergencia := 'Conforme';
        ELSE
            SELECT quantidade INTO v_qtd_esperada
            FROM pedidos_itens
            WHERE id_pedido = p_id_pedido AND id_produto = v_id_produto;

            IF NOT FOUND THEN
                v_qtd_esperada := 0;
                v_divergencia := 'Veio trocado';
                v_tem_divergencia := true;
            ELSIF v_qtd_recebida = v_qtd_esperada THEN
                v_divergencia := 'Conforme';
            ELSIF v_qtd_recebida < v_qtd_esperada THEN
                v_divergencia := 'Faltou';
                v_tem_divergencia := true;
            ELSE
                v_divergencia := 'Veio a mais';
                v_tem_divergencia := true;
            END IF;
        END IF;

        INSERT INTO recebimentos_itens (id_pedido, id_produto, qtd_esperada, qtd_recebida, divergencia)
        VALUES (p_id_pedido, v_id_produto, v_qtd_esperada, v_qtd_recebida, v_divergencia);
    END LOOP;

    IF p_id_pedido IS NOT NULL THEN
        -- Itens do pedido que não constaram na conferência: "Faltou" com
        -- observação automática (regra explícita do RF-17).
        INSERT INTO recebimentos_itens (id_pedido, id_produto, qtd_esperada, qtd_recebida, divergencia, observacao)
        SELECT p_id_pedido, pi.id_produto, pi.quantidade, 0, 'Faltou', 'Item do pedido não conferido no recebimento'
        FROM pedidos_itens pi
        WHERE pi.id_pedido = p_id_pedido
          AND NOT (pi.id_produto = ANY(v_produtos_recebidos));

        IF FOUND THEN
            v_tem_divergencia := true;
        END IF;

        UPDATE pedidos_compra
        SET status = CASE WHEN v_tem_divergencia THEN 'Recebido com Divergências' ELSE 'Recebido' END
        WHERE id_pedido = p_id_pedido;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
