-- 1. Function: get_estoque_atual
-- Calcula o estoque atual com base no último inventário confirmado mais os recebimentos posteriores
CREATE OR REPLACE FUNCTION get_estoque_atual(p_id_produto UUID)
RETURNS NUMERIC AS $$
DECLARE
    last_inv_time TIMESTAMPTZ;
    inv_stock NUMERIC := 0.0;
    recebimentos_post NUMERIC := 0.0;
BEGIN
    -- Obter data e contagem do último inventário confirmado
    SELECT l.data, COALESCE(i.qtd_total, 0.0)
    INTO last_inv_time, inv_stock
    FROM lancamentos_itens i
    JOIN lancamentos_op l ON i.id_lancamento = l.id_lancamento
    WHERE i.id_produto = p_id_produto
      AND l.tipo = 'Inventário'
      AND l.status = 'CONFIRMADO'
    ORDER BY l.data DESC
    LIMIT 1;

    IF last_inv_time IS NULL THEN
        last_inv_time := '-infinity'::timestamptz;
        inv_stock := 0.0;
    END IF;

    -- Somar recebimentos posteriores a essa data
    SELECT COALESCE(SUM(r.qtd_recebida), 0.0)
    INTO recebimentos_post
    FROM recebimentos_itens r
    WHERE r.id_produto = p_id_produto
      AND r.created_at > last_inv_time;

    RETURN inv_stock + recebimentos_post;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function: get_consumo_periodo
-- Calcula o consumo de um produto no período determinado pela sua periodicidade
CREATE OR REPLACE FUNCTION get_consumo_periodo(p_id_produto UUID)
RETURNS NUMERIC AS $$
DECLARE
    p_periodicidade periodicidade_enum;
    days_interval INT;
    start_time TIMESTAMPTZ;
    estoque_inicial NUMERIC := 0.0;
    estoque_final NUMERIC := 0.0;
    recebidos NUMERIC := 0.0;
BEGIN
    -- Obter periodicidade do produto
    SELECT periodicidade_compra INTO p_periodicidade FROM produtos WHERE id_produto = p_id_produto;
    
    CASE p_periodicidade
        WHEN 'Semanal' THEN days_interval := 7;
        WHEN 'Quinzenal' THEN days_interval := 15;
        WHEN 'Mensal' THEN days_interval := 30;
        ELSE days_interval := 0;
    END CASE;

    IF days_interval = 0 THEN
        RETURN 0.0;
    END IF;

    start_time := now() - (days_interval || ' days')::interval;

    -- Estoque Inicial: Inventário confirmado mais antigo dentro da janela
    SELECT COALESCE(i.qtd_total, 0.0) INTO estoque_inicial
    FROM lancamentos_itens i
    JOIN lancamentos_op l ON i.id_lancamento = l.id_lancamento
    WHERE i.id_produto = p_id_produto
      AND l.tipo = 'Inventário'
      AND l.status = 'CONFIRMADO'
      AND l.data >= start_time
    ORDER BY l.data ASC
    LIMIT 1;

    -- Estoque Final: Inventário confirmado mais recente dentro da janela
    SELECT COALESCE(i.qtd_total, 0.0) INTO estoque_final
    FROM lancamentos_itens i
    JOIN lancamentos_op l ON i.id_lancamento = l.id_lancamento
    WHERE i.id_produto = p_id_produto
      AND l.tipo = 'Inventário'
      AND l.status = 'CONFIRMADO'
      AND l.data >= start_time
    ORDER BY l.data DESC
    LIMIT 1;

    -- Recebidos no período
    SELECT COALESCE(SUM(r.qtd_recebida), 0.0) INTO recebidos
    FROM recebimentos_itens r
    WHERE r.id_produto = p_id_produto
      AND r.created_at >= start_time;

    RETURN GREATEST(0.0, estoque_inicial - estoque_final + recebidos);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function: get_sugestao_compra
-- Calcula a quantidade de compra sugerida usando a fórmula WMS
CREATE OR REPLACE FUNCTION get_sugestao_compra(p_id_produto UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_consumo NUMERIC;
    v_minimo NUMERIC;
    v_estoque_atual NUMERIC;
    v_pedidos_enviados NUMERIC := 0.0;
    v_sugerido NUMERIC;
BEGIN
    v_consumo := get_consumo_periodo(p_id_produto);
    
    SELECT estoque_minimo INTO v_minimo FROM produtos WHERE id_produto = p_id_produto;
    
    v_estoque_atual := get_estoque_atual(p_id_produto);

    -- Quantidade em pedidos com status 'Enviado' (pedidos de compra ainda não recebidos)
    SELECT COALESCE(SUM(pi.quantidade), 0.0) INTO v_pedidos_enviados
    FROM pedidos_itens pi
    JOIN pedidos_compra pc ON pi.id_pedido = pc.id_pedido
    WHERE pi.id_produto = p_id_produto
      AND pc.status = 'Enviado';

    v_sugerido := (v_consumo + v_minimo) - (v_estoque_atual + v_pedidos_enviados);

    RETURN GREATEST(0.0, v_sugerido);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. View: view_dashboard_estoques
-- View para exibir o painel consolidado de estoques na gestão
CREATE OR REPLACE VIEW view_dashboard_estoques AS
SELECT 
    p.id_produto,
    p.nome_produto,
    s.nome_setor,
    p.unidade_medida,
    p.estoque_minimo,
    get_estoque_atual(p.id_produto) AS estoque_atual,
    get_consumo_periodo(p.id_produto) AS consumo_periodo,
    get_sugestao_compra(p.id_produto) AS quantidade_sugerida
FROM produtos p
JOIN setores s ON p.id_setor = s.id_setor
WHERE p.ativo = 'SIM';
