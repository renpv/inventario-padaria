// supabase/functions/enviar-email-fechamento/index.ts
//
// RF-18 — Alertas de fechamento por e-mail.
//
// Envia um e-mail resumindo os turnos do dia (status de cada turno e
// destaque para os fechamentos que tiveram justificativa/forçados) quando o
// último turno ativo do dia é confirmado. É chamada automaticamente pelo
// trigger Postgres `trg_notificar_fechamento_dia`
// (supabase/migrations/20260813160000_email_fechamento.sql), mas também pode
// ser chamada manualmente para testes (ver "Como testar" abaixo).
//
// =====================================================================
// COMO FAZER O DEPLOY (não foi possível executar estes passos aqui, pois
// esta sessão não tem acesso ao Supabase CLI nem às credenciais do projeto)
// =====================================================================
//
// 1. Pré-requisitos: Supabase CLI instalado e logado (`supabase login`), e o
//    projeto já linkado (`supabase link --project-ref <seu-project-ref>`).
//
// 2. Escolha um provedor de e-mail transacional. O código abaixo usa a API
//    da Resend (https://resend.com) por ser simples de integrar num Edge
//    Function Deno, mas pode trocar por qualquer outro (SendGrid, Postmark,
//    etc.) ajustando a função `enviarEmail`. Crie uma conta e gere uma API
//    key em https://resend.com/api-keys, e verifique um domínio/remetente.
//
// 3. Gere um segredo aleatório para autenticar as chamadas do trigger
//    Postgres a esta função (evita que qualquer pessoa na internet dispare
//    e-mails chamando a URL da função). Exemplo:
//      openssl rand -hex 24
//
// 4. Configure os secrets da função:
//      supabase secrets set RESEND_API_KEY=coloque_sua_key_aqui
//      supabase secrets set RESEND_FROM="Padaria WMS <fechamento@seudominio.com>"
//      supabase secrets set FECHAMENTO_WEBHOOK_SECRET=coloque_o_segredo_do_passo_3
//
// 5. Deploy da função:
//      supabase functions deploy enviar-email-fechamento --no-verify-jwt
//
//    (--no-verify-jwt porque quem chama é o trigger do Postgres via pg_net,
//    não um usuário autenticado do app; a autenticação é feita pelo header
//    x-webhook-secret comparado ao FECHAMENTO_WEBHOOK_SECRET.)
//
// 6. Depois do deploy, o Supabase mostra a URL pública da função (algo como
//    https://<project-ref>.supabase.co/functions/v1/enviar-email-fechamento).
//    Grave essa URL e o MESMO segredo do passo 3 na tabela `configuracoes`:
//
//      UPDATE configuracoes SET valor = 'https://<project-ref>.supabase.co/functions/v1/enviar-email-fechamento'
//        WHERE chave = 'edge_function_fechamento_url';
//      UPDATE configuracoes SET valor = 'coloque_o_segredo_do_passo_3'
//        WHERE chave = 'edge_function_fechamento_secret';
//
// 7. Confirme que o envio está ligado e os destinatários configurados na
//    tela de Configurações do app de gestão (Notificações de Fechamento).
//
// Como testar manualmente (sem esperar o último turno do dia):
//   curl -X POST 'https://<project-ref>.supabase.co/functions/v1/enviar-email-fechamento' \
//     -H 'Content-Type: application/json' \
//     -H 'x-webhook-secret: coloque_o_segredo_do_passo_3' \
//     -d '{"data_operacional": "2026-08-13"}'
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('FECHAMENTO_WEBHOOK_SECRET') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'Padaria WMS <onboarding@resend.dev>';

interface TurnoResumo {
  nome_turno: string;
  ordem: number;
  status: string;
  justificativa_forca: string | null;
}

const buildEmailHtml = (dataOperacional: string, turnos: TurnoResumo[]) => {
  const linhas = turnos
    .sort((a, b) => a.ordem - b.ordem)
    .map((t) => {
      const forcado = !!t.justificativa_forca;
      const corStatus =
        t.status === 'CONFIRMADO' ? '#10b981' : t.status === 'NÃO REALIZADO' ? '#f43f5e' : '#f59e0b';
      return `
        <tr style="border-bottom:1px solid #292524;">
          <td style="padding:8px 12px;color:#e7e5e4;">${t.nome_turno}</td>
          <td style="padding:8px 12px;color:${corStatus};font-weight:bold;">${t.status}</td>
          <td style="padding:8px 12px;color:${forcado ? '#f59e0b' : '#78716c'};">
            ${forcado ? `⚠ Fechamento forçado: ${escapeHtml(t.justificativa_forca!)}` : '—'}
          </td>
        </tr>`;
    })
    .join('');

  return `
    <div style="font-family:sans-serif;background:#1c1917;padding:24px;color:#e7e5e4;">
      <h2 style="color:#f59e0b;margin-bottom:4px;">Fechamento do dia — ${dataOperacional}</h2>
      <p style="color:#a8a29e;font-size:13px;margin-top:0;">Resumo automático de todos os turnos do dia operacional.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead>
          <tr style="text-align:left;color:#a8a29e;font-size:12px;text-transform:uppercase;">
            <th style="padding:8px 12px;">Turno</th>
            <th style="padding:8px 12px;">Status</th>
            <th style="padding:8px 12px;">Observação</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const enviarEmail = async (destinatarios: string[], subject: string, html: string) => {
  if (destinatarios.length === 0) return { skipped: true, reason: 'Nenhum destinatário configurado' };
  if (!RESEND_API_KEY) return { skipped: true, reason: 'RESEND_API_KEY não configurada' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: destinatarios,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao enviar e-mail (${res.status}): ${body}`);
  }

  return await res.json();
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const receivedSecret = req.headers.get('x-webhook-secret') ?? '';
  if (!WEBHOOK_SECRET || receivedSecret !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dataOperacional: string = body.data_operacional || new Date().toISOString().slice(0, 10);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [configRes, turnosRes] = await Promise.all([
      supabase.from('configuracoes').select('chave, valor').in('chave', ['email_alerta_ativo', 'email_alerta_destinos']),
      supabase.from('turnos').select('id_turno, nome_turno, ordem').eq('ativo', 'SIM').order('ordem'),
    ]);

    const configMap: Record<string, string> = {};
    (configRes.data || []).forEach((c) => (configMap[c.chave] = c.valor));

    if (configMap['email_alerta_ativo'] !== 'true') {
      return new Response(JSON.stringify({ skipped: true, reason: 'Alertas por e-mail desativados' }), { status: 200 });
    }

    let destinatarios: string[] = [];
    try {
      destinatarios = JSON.parse(configMap['email_alerta_destinos'] || '[]');
    } catch {
      destinatarios = [];
    }

    const turnos = turnosRes.data || [];
    const idsTurnos = turnos.map((t) => t.id_turno);

    const { data: lancamentos } = await supabase
      .from('lancamentos_op')
      .select('id_turno, status, justificativa_forca, data')
      .eq('tipo', 'Inventário')
      .in('id_turno', idsTurnos)
      .gte('data', `${dataOperacional}T00:00:00Z`)
      .lt('data', `${dataOperacional}T23:59:59.999Z`);

    const resumo: TurnoResumo[] = turnos.map((t) => {
      const lanc = (lancamentos || []).find((l) => l.id_turno === t.id_turno);
      return {
        nome_turno: t.nome_turno,
        ordem: t.ordem,
        status: lanc?.status || 'NÃO REALIZADO',
        justificativa_forca: lanc?.justificativa_forca || null,
      };
    });

    const html = buildEmailHtml(dataOperacional, resumo);
    const resultado = await enviarEmail(destinatarios, `Fechamento do dia — ${dataOperacional}`, html);

    return new Response(JSON.stringify({ ok: true, resultado, resumo }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('enviar-email-fechamento error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
