import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Produto {
  id_produto: string;
  id_setor: string;
  nome_produto: string;
  unidade_medida: string;
  estoque_minimo: number;
  periodicidade_compra: number;
  ativo: 'SIM' | 'NÃO';
  setores?: { nome_setor: string };
}

interface Setor {
  id_setor: string;
  nome_setor: string;
}

export const ProdutosCrud: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [idEdit, setIdEdit] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [idSetor, setIdSetor] = useState('');
  const [unidade, setUnidade] = useState('UN');
  const [minimo, setMinimo] = useState(0);
  const [periodicidade, setPeriodicidade] = useState(7); // dias

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch Setores for select
    const resSetores = await supabase.from('setores').select('*').eq('ativo', 'SIM').order('nome_setor');
    if (resSetores.data) {
      setSetores(resSetores.data);
      if (resSetores.data.length > 0 && !idSetor) {
        setIdSetor(resSetores.data[0].id_setor);
      }
    }

    const resProdutos = await supabase
      .from('produtos')
      .select(`
        *,
        setores ( nome_setor )
      `)
      .order('nome_produto');

    if (resProdutos.data) setProdutos(resProdutos.data as Produto[]);
    setLoading(false);
    // idSetor lido só para um default "se ainda não setado" — não deve re-disparar o
    // fetch quando ele muda (evita refetch redundante a cada seleção).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idSetor) return alert('Cadastre um setor primeiro!');
    
    const payload = { 
      nome_produto: nome, 
      id_setor: idSetor,
      unidade_medida: unidade,
      estoque_minimo: minimo,
      periodicidade_compra: periodicidade,
      ativo: 'SIM' as const 
    };

    if (idEdit) {
      await supabase.from('produtos').update(payload).eq('id_produto', idEdit);
    } else {
      await supabase.from('produtos').insert(payload);
    }
    
    resetForm();
    fetchData();
  };

  const toggleAtivo = async (id: string, current: 'SIM' | 'NÃO') => {
    await supabase.from('produtos').update({ ativo: current === 'SIM' ? 'NÃO' : 'SIM' }).eq('id_produto', id);
    fetchData();
  };

  const resetForm = () => {
    setIdEdit(null);
    setNome('');
    setMinimo(0);
    setUnidade('UN');
    setPeriodicidade(7);
  };

  const editItem = (p: Produto) => {
    setIdEdit(p.id_produto);
    setNome(p.nome_produto);
    setIdSetor(p.id_setor);
    setUnidade(p.unidade_medida);
    setMinimo(p.estoque_minimo);
    setPeriodicidade(p.periodicidade_compra);
  };

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      <div className="flex items-center gap-4 bg-stone-850 p-4 rounded-xl border border-stone-800 sticky top-0 z-10">
        <Link to="/config" className="p-2 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-stone-300" />
        </Link>
        <h2 className="text-lg font-bold text-amber-500">Cadastro de Produtos</h2>
      </div>

      <form onSubmit={handleSave} className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-4">
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Nome do Produto</label>
          <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none" />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Setor</label>
            <select required value={idSetor} onChange={e => setIdSetor(e.target.value)} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none">
              {setores.map(s => <option key={s.id_setor} value={s.id_setor}>{s.nome_setor}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Unidade</label>
            <input type="text" required value={unidade} onChange={e => setUnidade(e.target.value)} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none" placeholder="UN, KG, CX" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Estoque Mín.</label>
            <input type="number" step="0.01" required value={minimo} onChange={e => setMinimo(parseFloat(e.target.value))} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Frequência (Dias)</label>
            <input type="number" required value={periodicidade} onChange={e => setPeriodicidade(parseInt(e.target.value))} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none" />
          </div>
        </div>
        
        <div className="flex gap-2 pt-2">
          {idEdit && <button type="button" onClick={resetForm} className="flex-1 py-3 bg-stone-800 text-stone-300 rounded-lg font-bold">Cancelar</button>}
          <button type="submit" className="flex-[2] py-3 bg-amber-600/20 text-amber-500 border border-amber-600/50 rounded-lg font-bold flex justify-center items-center gap-2">
            {idEdit ? <><Save size={18} /> Atualizar</> : <><Plus size={18} /> Adicionar</>}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {loading ? <div className="text-center text-stone-400">Carregando...</div> : produtos.map(p => (
          <div key={p.id_produto} className={`bg-stone-850 p-4 rounded-xl border border-stone-800 flex justify-between items-center ${p.ativo === 'NÃO' ? 'opacity-50' : ''}`}>
            <div className="flex-1" onClick={() => editItem(p)}>
              <div className="flex justify-between items-start">
                <p className="font-bold text-stone-200">{p.nome_produto}</p>
                <span className="text-[10px] font-bold uppercase bg-stone-800 text-stone-400 px-2 py-0.5 rounded mr-3">{p.setores?.nome_setor}</span>
              </div>
              <p className="text-xs text-stone-400 mt-1">
                Mín: {p.estoque_minimo} {p.unidade_medida} | Compra a cada {p.periodicidade_compra} dias
              </p>
            </div>
            <button onClick={() => toggleAtivo(p.id_produto, p.ativo)} className={`p-2 rounded-lg ${p.ativo === 'SIM' ? 'text-rose-400 bg-rose-400/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
