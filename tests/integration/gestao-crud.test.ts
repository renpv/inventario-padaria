import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Testes de integração do caminho FELIZ da gestão: autentica com a conta de
 * teste dedicada (e-mail/senha, criada via scripts/setup-test-gestor.mjs —
 * necessário porque o login real é Google OAuth, não automatizável) e valida
 * que a RLS libera CRUD nas tabelas de gestão de fato, não só que bloqueia a
 * operação (isso já é coberto por rls-gestao.test.ts).
 *
 * Roda via `npm run test:integration`. Requer E2E_GESTAO_TEST_EMAIL/PASSWORD
 * em .env.local — pula a suíte inteira se não configurado.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
// Sem prefixo VITE_ de propósito (não devem ir para o bundle do cliente),
// então Vite não os expõe em import.meta.env — lidos via process.env.
const gestorEmail = process.env.E2E_GESTAO_TEST_EMAIL;
const gestorPassword = process.env.E2E_GESTAO_TEST_PASSWORD;

const hasGestorCreds = !!gestorEmail && !!gestorPassword;

let supabase: SupabaseClient;
const cleanup: (() => Promise<void>)[] = [];

beforeAll(async () => {
  if (!hasGestorCreds) return;
  supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await supabase.auth.signInWithPassword({ email: gestorEmail!, password: gestorPassword! });
  if (error) {
    throw new Error(`Falha ao autenticar a conta de teste gestão: ${error.message}`);
  }
});

afterAll(async () => {
  for (const fn of cleanup.reverse()) await fn();
});

describe.skipIf(!hasGestorCreds)('Gestão CRUD (caminho feliz, RLS liberando)', () => {
  it('cria, edita e desativa (soft delete) um setor (RF-13)', async () => {
    const nome = `Integration Test Setor ${Date.now()}`;
    const { data: created, error: insErr } = await supabase
      .from('setores')
      .insert({ nome_setor: nome, ativo: 'SIM' })
      .select('id_setor, nome_setor, ativo')
      .single();

    expect(insErr).toBeNull();
    expect(created?.nome_setor).toBe(nome);
    cleanup.push(async () => {
      await supabase.from('setores').delete().eq('id_setor', created!.id_setor);
    });

    const { error: updErr } = await supabase
      .from('setores')
      .update({ ativo: 'NÃO' })
      .eq('id_setor', created!.id_setor);
    expect(updErr).toBeNull();

    const { data: after } = await supabase.from('setores').select('ativo').eq('id_setor', created!.id_setor).single();
    expect(after?.ativo).toBe('NÃO');
  });

  it('lê e escreve em configuracoes (ex.: PIN operacional)', async () => {
    const { data: before } = await supabase.from('configuracoes').select('valor').eq('chave', 'pin_operacional').single();
    expect(before?.valor).toBeTruthy();

    const { error } = await supabase.from('configuracoes').update({ valor: before!.valor }).eq('chave', 'pin_operacional');
    expect(error).toBeNull();
  });

  it('lê a própria linha em usuarios (whitelist) e a role fica gestao/ativo', async () => {
    const { data, error } = await supabase.from('usuarios').select('email, role, ativo').eq('email', gestorEmail).single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ role: 'gestao', ativo: 'SIM' });
  });

  it('cria um fornecedor e um pedido de compra vinculado a ele (RF-13/RF-16)', async () => {
    const { data: fornecedor, error: fErr } = await supabase
      .from('fornecedores')
      .insert({ nome: `Integration Test Fornecedor ${Date.now()}`, ativo: 'SIM', pedido_minimo: 0, taxa_entrega: 0 })
      .select('id_fornecedor')
      .single();
    expect(fErr).toBeNull();
    cleanup.push(async () => {
      await supabase.from('fornecedores').delete().eq('id_fornecedor', fornecedor!.id_fornecedor);
    });

    const { data: pedido, error: pErr } = await supabase
      .from('pedidos_compra')
      .insert({
        id_fornecedor: fornecedor!.id_fornecedor,
        status: 'Simulado',
        valor_produtos: 10,
        taxa_entrega: 0,
        valor_total: 10,
      })
      .select('id_pedido, status')
      .single();

    expect(pErr).toBeNull();
    expect(pedido?.status).toBe('Simulado');
    cleanup.push(async () => {
      await supabase.from('pedidos_compra').delete().eq('id_pedido', pedido!.id_pedido);
    });
  });

  it('lança e depois quita (parcial) um débito de fiado de um funcionário (RF-23/RF-24)', async () => {
    const { data: funcionarios } = await supabase.from('funcionarios').select('id_funcionario').limit(1);
    if (!funcionarios || funcionarios.length === 0) {
      return; // Sem funcionário cadastrado neste ambiente.
    }
    const id_funcionario = funcionarios[0].id_funcionario;

    const { data: debito, error: debErr } = await supabase
      .from('credito_movimentos')
      .insert({ id_funcionario, tipo: 'Adiantamento', valor: 5 })
      .select('id_movimento')
      .single();
    expect(debErr).toBeNull();
    cleanup.push(async () => {
      await supabase.from('credito_movimentos').delete().eq('id_movimento', debito!.id_movimento);
    });

    // Quitação parcial: exclusiva da gestão (bloqueada para a operação — ver rls-gestao.test.ts).
    const { data: quitacao, error: quitErr } = await supabase
      .from('credito_movimentos')
      .insert({ id_funcionario, tipo: 'Quitação parcial', valor: 2 })
      .select('id_movimento')
      .single();
    expect(quitErr).toBeNull();
    if (quitacao?.id_movimento) {
      cleanup.push(async () => {
        await supabase.from('credito_movimentos').delete().eq('id_movimento', quitacao.id_movimento);
      });
    }
  });
});

describe.skipIf(!hasGestorCreds)('Gestão RPCs — dependem da migração 20260813150000_onda2_lifecycle_and_gaps.sql', () => {
  // Estes 2 testes ficam VERMELHOS até a migração ser aplicada ao projeto —
  // ver o achado documentado na sessão de testes da área gerencial. Não são
  // falhas do teste: expressam o comportamento esperado assim que o gap for
  // corrigido.
  it('reabrir_turno funciona para gestão com um lançamento CONFIRMADO real', async () => {
    const { data: lancamento } = await supabase
      .from('lancamentos_op')
      .select('id_lancamento')
      .eq('status', 'CONFIRMADO')
      .limit(1)
      .maybeSingle();

    if (!lancamento) {
      return; // Sem lançamento confirmado neste ambiente para testar a reabertura.
    }

    const { error } = await supabase.rpc('reabrir_turno', { p_id_lancamento: lancamento.id_lancamento });
    expect(error).toBeNull();

    // Reverte para não deixar o ambiente sujo.
    await supabase.from('lancamentos_op').update({ status: 'CONFIRMADO' }).eq('id_lancamento', lancamento.id_lancamento);
  });

  it('consultar_estoque() responde sem erro para a sessão de gestão', async () => {
    const { error } = await supabase.rpc('consultar_estoque');
    expect(error).toBeNull();
  });
});
