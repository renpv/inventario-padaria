import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

export const Fiado: React.FC = () => {
  const [funcionarios, setFuncionarios] = useState<{ id_funcionario: string; nome: string }[]>([]);
  const [produtos, setProdutos] = useState<{ id_produto: string; nome_produto: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedFunc, setSelectedFunc] = useState('');
  const [tipoDebito, setTipoDebito] = useState<'Adiantamento' | 'Retirada de produto'>('Adiantamento');
  const [selectedProd, setSelectedProd] = useState('');
  const [valor, setValor] = useState('');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [funcsRes, prodsRes] = await Promise.all([
      supabase.from('funcionarios').select('id_funcionario, nome').eq('ativo', 'SIM').order('nome'),
      supabase.from('produtos').select('id_produto, nome_produto').eq('ativo', 'SIM').order('nome_produto')
    ]);

    if (funcsRes.data) setFuncionarios(funcsRes.data);
    if (prodsRes.data) setProdutos(prodsRes.data);
    setLoading(false);
  };

  const handleLancar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFunc || !valor || Number(valor) <= 0) return;
    if (tipoDebito === 'Retirada de produto' && !selectedProd) return;

    try {
      const { error } = await supabase.from('credito_movimentos').insert({
        id_funcionario: selectedFunc,
        tipo: tipoDebito,
        id_produto: tipoDebito === 'Retirada de produto' ? selectedProd : null,
        valor: Number(valor),
        observacao: observacao || null
      });

      if (error) throw error;

      alert('Lançamento realizado com sucesso!');
      setSelectedFunc('');
      setValor('');
      setObservacao('');
      setSelectedProd('');
    } catch (err: any) {
      alert('Erro ao registrar: ' + err.message);
    }
  };

  if (loading) return <div className="text-stone-400 p-4">Carregando formulário...</div>;

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      <div className="bg-stone-850 p-6 rounded-xl border border-stone-800">
        <h2 className="text-xl font-bold text-amber-500 mb-2">Lançar Débito (Fiado)</h2>
        <p className="text-sm text-stone-400 mb-6">Registre os vales e retiradas dos colaboradores.</p>

        <form onSubmit={handleLancar} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-stone-300 mb-1">Colaborador</label>
            <select
              className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-200 focus:outline-none focus:border-amber-500"
              value={selectedFunc}
              onChange={(e) => setSelectedFunc(e.target.value)}
              required
            >
              <option value="" disabled>Selecione um funcionário...</option>
              {funcionarios.map(f => (
                <option key={f.id_funcionario} value={f.id_funcionario}>{f.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-stone-300 mb-1">Tipo</label>
            <select
              className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-200 focus:outline-none focus:border-amber-500"
              value={tipoDebito}
              onChange={(e) => setTipoDebito(e.target.value as any)}
            >
              <option value="Adiantamento">Adiantamento em Espécie</option>
              <option value="Retirada de produto">Retirada de Produto</option>
            </select>
          </div>

          {tipoDebito === 'Retirada de produto' && (
            <div>
              <label className="block text-sm font-bold text-stone-300 mb-1">Produto Retirado</label>
              <select
                className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-200 focus:outline-none focus:border-amber-500"
                value={selectedProd}
                onChange={(e) => setSelectedProd(e.target.value)}
                required
              >
                <option value="" disabled>Selecione o produto...</option>
                {produtos.map(p => (
                  <option key={p.id_produto} value={p.id_produto}>{p.nome_produto}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-stone-300 mb-1">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-200 focus:outline-none focus:border-amber-500"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-stone-300 mb-1">Observação (Opcional)</label>
            <input
              type="text"
              className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-200 focus:outline-none focus:border-amber-500"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Detalhes adicionais..."
            />
          </div>

          <button
            type="submit"
            className="w-full bg-amber-600 text-white font-bold py-3 rounded-lg hover:bg-amber-500 transition-colors mt-6"
          >
            Confirmar Lançamento
          </button>
        </form>
      </div>
    </div>
  );
};
