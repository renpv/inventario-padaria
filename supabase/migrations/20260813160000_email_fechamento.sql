-- RF-18: Alertas de fechamento por e-mail.
--
-- Estratégia: quando o último turno ativo do dia é confirmado (e todos os
-- demais turnos ativos já estão resolvidos — CONFIRMADO ou NÃO REALIZADO),
-- um trigger dispara uma chamada HTTP (via pg_net) para a Edge Function
-- `enviar-email-fechamento`, que monta o resumo do dia e envia o e-mail.
--
-- A URL da função e um segredo compartilhado (para autenticar a chamada)
-- ficam em `configuracoes` (chaves 'edge_function_fechamento_url' e
-- 'edge_function_fechamento_secret'), preenchidos manualmente após o deploy
-- da função — ver instruções no topo de
-- supabase/functions/enviar-email-fechamento/index.ts.

-- pg_net já vem habilitada por padrão na maioria dos projetos Supabase; o
-- IF NOT EXISTS torna a migration idempotente caso não esteja.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

INSERT INTO configuracoes (chave, valor, descricao) VALUES
    ('edge_function_fechamento_url', '', 'URL da Edge Function enviar-email-fechamento (preencher após o deploy)'),
    ('edge_function_fechamento_secret', '', 'Segredo compartilhado enviado no header x-webhook-secret para autenticar a chamada')
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION notificar_fechamento_dia()
RETURNS TRIGGER AS $$
DECLARE
    v_ultimo_turno_ordem INT;
    v_turno_ordem INT;
    v_pendentes INT;
    v_url TEXT;
    v_secret TEXT;
    v_email_ativo TEXT;
    v_data_op DATE;
BEGIN
    -- Só nos interessa a confirmação de um lançamento de inventário vinculado
    -- a um turno (sobras/perdas e outros tipos não disparam fechamento).
    IF NEW.status <> 'CONFIRMADO' OR NEW.tipo <> 'Inventário' OR NEW.id_turno IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT valor INTO v_email_ativo FROM configuracoes WHERE chave = 'email_alerta_ativo';
    IF v_email_ativo IS DISTINCT FROM 'true' THEN
        RETURN NEW;
    END IF;

    SELECT ordem INTO v_turno_ordem FROM turnos WHERE id_turno = NEW.id_turno;
    SELECT MAX(ordem) INTO v_ultimo_turno_ordem FROM turnos WHERE ativo = 'SIM';

    -- Só dispara quando o turno confirmado é o último turno ativo configurado.
    IF v_turno_ordem IS NULL OR v_turno_ordem <> v_ultimo_turno_ordem THEN
        RETURN NEW;
    END IF;

    v_data_op := NEW.data::date;

    -- Confirma que nenhum turno ativo do dia ficou sem resolução
    -- (EM ANDAMENTO ou nem sequer iniciado).
    SELECT COUNT(*) INTO v_pendentes
    FROM turnos t
    WHERE t.ativo = 'SIM'
      AND NOT EXISTS (
        SELECT 1 FROM lancamentos_op lo
        WHERE lo.id_turno = t.id_turno
          AND lo.tipo = 'Inventário'
          AND lo.status IN ('CONFIRMADO', 'NÃO REALIZADO')
          AND lo.data >= v_data_op::timestamptz
          AND lo.data < (v_data_op + 1)::timestamptz
      );

    IF v_pendentes > 0 THEN
        RETURN NEW;
    END IF;

    SELECT valor INTO v_url FROM configuracoes WHERE chave = 'edge_function_fechamento_url';
    SELECT valor INTO v_secret FROM configuracoes WHERE chave = 'edge_function_fechamento_secret';

    -- Edge Function ainda não configurada (deploy pendente) — não faz nada.
    IF v_url IS NULL OR v_url = '' THEN
        RETURN NEW;
    END IF;

    PERFORM extensions.net.http_post(
        url := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', COALESCE(v_secret, '')
        ),
        body := jsonb_build_object('data_operacional', v_data_op)
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Uma falha ao notificar não pode derrubar a confirmação do turno.
    RAISE WARNING 'notificar_fechamento_dia: falha ao notificar fechamento do dia %: %', v_data_op, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

DROP TRIGGER IF EXISTS trg_notificar_fechamento_dia ON lancamentos_op;
CREATE TRIGGER trg_notificar_fechamento_dia
AFTER UPDATE OF status ON lancamentos_op
FOR EACH ROW
WHEN (NEW.status = 'CONFIRMADO' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notificar_fechamento_dia();
