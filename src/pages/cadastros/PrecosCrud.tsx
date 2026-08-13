import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Preco {
  id_produto: string;
  id_fornecedor: string;
  valor_unitario: number;
  produtos?: { nome_produto: string };
  fornecedores?: { nome: string };
}

interface Option {
  id: string;
  nome: string;
}

export const PrecosCrud: React.FC = () => {
  const [precos, setPrecos] = useState<Preco[]>([]);
  const [produtos, setProdutos] = useState<Option[]>([]);
  const [fornecedores, setFornecedores] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [idProduto, setIdProduto] = useState('');
  const [idFornecedor, setIdFornecedor] = useState('');
  const [valor, setValor] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [resProd, resForn, resPrecos] = await Promise.all([
      supabase.from('produtos').select('id_produto, nome_produto').eq('ativo', 'SIM').order('nome_produto'),
      supabase.from('fornecedores').select('id_fornecedor, nome').eq('ativo', 'SIM').order('nome'),
      supabase.from('produtos_fornecedores').select(`
        *,
        produtos ( nome_produto ),
        fornecedores ( nome )
      `)
    ]);

    if (resProd.data) {
      setProdutos(resProd.data.map(p => ({ id: p.id_produto, nome: p.nome_produto })));
      if (resProd.data.length > 0 && !idProduto) setIdProduto(resProd.data[0].id_produto);
    }

    if (resForn.data) {
      setFornecedores(resForn.data.map(f => ({ id: f.id_fornecedor, nome: f.nome })));
      if (resForn.data.length > 0 && !idFornecedor) setIdFornecedor(resForn.data[0].id_fornecedor);
    }

    if (resPrecos.data) {
      setPrecos(resPrecos.data as Preco[]);
    }

    setLoading(false);
    // idProduto/idFornecedor lidos só para um default "se ainda não setado" — não deve
    // re-disparar o fetch quando eles mudam (evita refetch redundante a cada seleção).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idProduto || !idFornecedor) return alert('Selecione produto e fornecedor!');
    
    // Using upsert to handle both insert and update (since it's a composite PK)
    const { error } = await supabase.from('produtos_fornecedores').upsert({
      id_produto: idProduto,
      id_fornecedor: idFornecedor,
      valor_unitario: valor
    });
    
    if (error) alert(error.message);
    else {
      setValor(0);
      fetchData();
    }
  };

  const deleteItem = async (id_p: string, id_f: string) => {
    if (!confirm('Deseja realmente apagar este preço?')) return;
    await supabase.from('produtos_fornecedores').delete().match({ id_produto: id_p, id_fornecedor: id_f });
    fetchData();
  };

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      <div className="flex items-center gap-4 bg-stone-850 p-4 rounded-xl border border-stone-800 sticky top-0 z-10">
        <Link to="/config" className="p-2 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-stone-300" />
        </Link>
        <h2 className="text-lg font-bold text-amber-500">Tabela de Preços</h2>
      </div>

      <form onSubmit={handleSave} className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-4">
        {produtos.length === 0 && <div className="text-xs text-rose-400 bg-rose-400/10 p-2 rounded">⚠️ Cadastre pelo menos um Produto primeiro.</div>}
        {fornecedores.length === 0 && <div className="text-xs text-rose-400 bg-rose-400/10 p-2 rounded">⚠️ Cadastre pelo menos um Fornecedor primeiro.</div>}
        
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Fornecedor</label>
          <select required disabled={fornecedores.length === 0} value={idFornecedor} onChange={e => setIdFornecedor(e.target.value)} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none disabled:opacity-50">
            {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            {fornecedores.length === 0 && <option value="">Nenhum fornecedor disponível</option>}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Produto</label>
          <select required disabled={produtos.length === 0} value={idProduto} onChange={e => setIdProduto(e.target.value)} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none disabled:opacity-50">
            {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            {produtos.length === 0 && <option value="">Nenhum produto disponível</option>}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Valor Unitário (R$)</label>
          <input type="number" step="0.01" required disabled={produtos.length === 0 || fornecedores.length === 0} value={valor} onChange={e => setValor(parseFloat(e.target.value))} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none disabled:opacity-50" />
        </div>
        
        <button type="submit" disabled={produtos.length === 0 || fornecedores.length === 0} className="w-full py-3 bg-amber-600/20 text-amber-500 border border-amber-600/50 rounded-lg font-bold flex justify-center items-center gap-2 disabled:opacity-50">
          <Plus size={18} /> Salvar Preço (Substituir)
        </button>
      </form>

      <div className="space-y-3">
        {loading ? <div className="text-center text-stone-400">Carregando...</div> : precos.map(p => (
          <div key={`${p.id_produto}-${p.id_fornecedor}`} className="bg-stone-850 p-4 rounded-xl border border-stone-800 flex justify-between items-center">
            <div className="flex-1">
              <p className="font-bold text-stone-200">{p.produtos?.nome_produto}</p>
              <div className="flex items-center justify-between pr-3 mt-1">
                <span className="text-[10px] font-bold uppercase bg-stone-800 text-stone-400 px-2 py-0.5 rounded">{p.fornecedores?.nome}</span>
                <span className="text-emerald-400 font-bold">R$ {p.valor_unitario.toFixed(2)}</span>
              </div>
            </div>
            <button onClick={() => deleteItem(p.id_produto, p.id_fornecedor)} className="p-2 rounded-lg text-rose-400 bg-rose-400/10">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {precos.length === 0 && <div className="text-center text-stone-500 text-sm p-4">Nenhum preço cadastrado.</div>}
      </div>
    </div>
  );
};
