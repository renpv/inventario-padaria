import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Testes de integração contra o Supabase REAL (não mockado), validando que
 * as políticas de RLS da área gerencial (`gestao_all_*`, ver
 * supabase/migrations/20260812205500_security_and_rpc.sql) bloqueiam
 * corretamente uma sessão operacional (anônima) — o caminho negativo.
 *
 * O caminho feliz (uma sessão real `role=gestao` conseguindo de fato ler/
 * escrever essas tabelas) não é coberto aqui: exigiria autenticar via Google
 * OAuth ou uma service_role key para criar uma sessão de teste, nenhuma das
 * duas disponível neste ambiente de execução dos testes.
 *
 * Roda separado da suíte de unit tests (`npm test`) via `npm run test:integration`,
 * pois depende de rede e do estado real do projeto Supabase.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

let supabase: SupabaseClient;
const cleanupIds: { table: string; column: string; value: string }[] = [];

beforeAll(async () => {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw new Error(
      `Não foi possível criar a sessão anônima operacional para os testes de integração: ${error.message}. ` +
        'Se for rate limit (over_request_rate_limit), aguarde a janela do Supabase resetar.'
    );
  }
});

afterAll(async () => {
  for (const { table, column, value } of cleanupIds) {
    await supabase.from(table).delete().eq(column, value);
  }
});

describe('RLS — sessão operacional NÃO pode escrever em tabelas de gestão', () => {
  it('bloqueia INSERT em setores', async () => {
    const { error } = await supabase.from('setores').insert({ nome_setor: 'RLS Test Setor', ativo: 'SIM' });
    expect(error).not.toBeNull();
  });

  it('bloqueia INSERT em produtos', async () => {
    const { error } = await supabase
      .from('produtos')
      .insert({ nome_produto: 'RLS Test Produto', unidade_medida: 'un', ativo: 'SIM' });
    expect(error).not.toBeNull();
  });

  it('bloqueia INSERT em turnos', async () => {
    const { error } = await supabase.from('turnos').insert({ nome_turno: 'RLS Test Turno', ordem: 999, ativo: 'SIM' });
    expect(error).not.toBeNull();
  });

  it('bloqueia INSERT em fornecedores', async () => {
    const { error } = await supabase.from('fornecedores').insert({ nome: 'RLS Test Fornecedor', ativo: 'SIM' });
    expect(error).not.toBeNull();
  });

  it('bloqueia INSERT em funcionarios', async () => {
    const { error } = await supabase.from('funcionarios').insert({ nome: 'RLS Test Funcionario', ativo: 'SIM' });
    expect(error).not.toBeNull();
  });

  it('bloqueia UPDATE em configuracoes (ex.: trocar o PIN operacional)', async () => {
    // A policy USING(is_gestor()) torna a linha invisível para a sessão
    // operacional: o UPDATE não retorna erro, só afeta 0 linhas. Por isso
    // conferimos o retorno (.select()) em vez de só o campo error.
    const { data, error } = await supabase
      .from('configuracoes')
      .update({ valor: '0000' })
      .eq('chave', 'pin_operacional')
      .select('chave');

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: check } = await supabase.rpc('validar_pin', { pin_input: '0000' });
    expect(check).toBe(false);
  });

  it('bloqueia INSERT em usuarios (auto-promoção de role)', async () => {
    const { error } = await supabase.from('usuarios').insert({
      nome: 'RLS Test Usuario',
      email: `rls-test-${Date.now()}@example.com`,
      role: 'gestao',
      ativo: 'SIM',
    });
    expect(error).not.toBeNull();
  });

  it('bloqueia INSERT em pedidos_compra', async () => {
    const { data: fornecedores } = await supabase.from('fornecedores').select('id_fornecedor').limit(1);
    if (!fornecedores || fornecedores.length === 0) {
      // Não conseguimos nem ler um fornecedor (esperado se também vazio) —
      // usamos um UUID qualquer, o bloqueio deve ocorrer antes de qualquer
      // validação de FK.
    }
    const { error } = await supabase.from('pedidos_compra').insert({
      id_fornecedor: fornecedores?.[0]?.id_fornecedor ?? '00000000-0000-0000-0000-000000000000',
      status: 'Simulado',
      valor_produtos: 0,
      taxa_entrega: 0,
      valor_total: 0,
    });
    expect(error).not.toBeNull();
  });

  it('bloqueia INSERT em produtos_fornecedores', async () => {
    const { error } = await supabase.from('produtos_fornecedores').insert({
      id_produto: '00000000-0000-0000-0000-000000000000',
      id_fornecedor: '00000000-0000-0000-0000-000000000000',
      valor_unitario: 1,
    });
    expect(error).not.toBeNull();
  });
});

describe('RLS — sessão operacional NÃO pode ler tabelas restritas à gestão', () => {
  it('retorna vazio ao consultar configuracoes (sem policy de SELECT operacional)', async () => {
    const { data, error } = await supabase.from('configuracoes').select('chave, valor');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('retorna vazio ao consultar usuarios', async () => {
    const { data, error } = await supabase.from('usuarios').select('id_usuario, email, role');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe('RLS — sessão operacional só pode escrever tipos permitidos em credito_movimentos', () => {
  it('bloqueia lançar uma Quitação (exclusiva da gestão) pela operação', async () => {
    const { data: funcionarios } = await supabase.from('funcionarios').select('id_funcionario').limit(1);
    if (!funcionarios || funcionarios.length === 0) {
      // Sem funcionário cadastrado neste ambiente para montar um payload válido.
      return;
    }

    const { error } = await supabase.from('credito_movimentos').insert({
      id_funcionario: funcionarios[0].id_funcionario,
      tipo: 'Quitação total',
      valor: 10,
    });
    expect(error).not.toBeNull();
  });

  it('permite lançar um Adiantamento (permitido para a operação)', async () => {
    const { data: funcionarios } = await supabase.from('funcionarios').select('id_funcionario').limit(1);
    if (!funcionarios || funcionarios.length === 0) {
      return;
    }

    const { data, error } = await supabase
      .from('credito_movimentos')
      .insert({ id_funcionario: funcionarios[0].id_funcionario, tipo: 'Adiantamento', valor: 0.01 })
      .select('id_movimento')
      .single();

    expect(error).toBeNull();
    expect(data?.id_movimento).toBeTruthy();
    if (data?.id_movimento) {
      cleanupIds.push({ table: 'credito_movimentos', column: 'id_movimento', value: data.id_movimento });
    }
  });
});

describe('RLS — RPCs exclusivas da gestão recusam sessão operacional', () => {
  it('reabrir_turno recusa com mensagem explícita, mesmo para um id_lancamento inexistente', async () => {
    // A checagem `is_gestor()` roda antes de qualquer lookup na função, então
    // isso vale mesmo sem um lançamento real — ver reabrir_turno() em
    // 20260813150000_onda2_lifecycle_and_gaps.sql.
    const { error } = await supabase.rpc('reabrir_turno', {
      p_id_lancamento: '00000000-0000-0000-0000-000000000000',
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain('Apenas gestores podem reabrir turnos ou setores');
  });
});

describe('RLS — leituras e RPCs públicas da operação continuam liberadas', () => {
  it('permite consultar_estoque() para a sessão operacional', async () => {
    const { error } = await supabase.rpc('consultar_estoque');
    expect(error).toBeNull();
  });

  it('permite SELECT em setores/turnos/produtos ativos', async () => {
    const [setores, turnos, produtos] = await Promise.all([
      supabase.from('setores').select('id_setor').eq('ativo', 'SIM'),
      supabase.from('turnos').select('id_turno').eq('ativo', 'SIM'),
      supabase.from('produtos').select('id_produto').eq('ativo', 'SIM'),
    ]);
    expect(setores.error).toBeNull();
    expect(turnos.error).toBeNull();
    expect(produtos.error).toBeNull();
  });
});
