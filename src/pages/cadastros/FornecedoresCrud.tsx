import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Fornecedor {
  id_fornecedor: string;
  nome: string;
  pedido_minimo: number;
  taxa_entrega: number;
  ativo: 'SIM' | 'NÃO';
}

export const FornecedoresCrud: React.FC = () => {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [idEdit, setIdEdit] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [minimo, setMinimo] = useState(0);
  const [frete, setFrete] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('fornecedores').select('*').order('nome');
    if (data) setFornecedores(data as Fornecedor[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { nome, pedido_minimo: minimo, taxa_entrega: frete, ativo: 'SIM' as const };

    if (idEdit) {
      await supabase.from('fornecedores').update(payload).eq('id_fornecedor', idEdit);
    } else {
      await supabase.from('fornecedores').insert(payload);
    }
    
    resetForm();
    fetchData();
  };

  const toggleAtivo = async (id: string, current: 'SIM' | 'NÃO') => {
    await supabase.from('fornecedores').update({ ativo: current === 'SIM' ? 'NÃO' : 'SIM' }).eq('id_fornecedor', id);
    fetchData();
  };

  const resetForm = () => {
    setIdEdit(null);
    setNome('');
    setMinimo(0);
    setFrete(0);
  };

  const editItem = (f: Fornecedor) => {
    setIdEdit(f.id_fornecedor);
    setNome(f.nome);
    setMinimo(f.pedido_minimo);
    setFrete(f.taxa_entrega);
  };

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      <div className="flex items-center gap-4 bg-stone-850 p-4 rounded-xl border border-stone-800 sticky top-0 z-10">
        <Link to="/config" className="p-2 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-stone-300" />
        </Link>
        <h2 className="text-lg font-bold text-amber-500">Cadastro de Fornecedores</h2>
      </div>

      <form onSubmit={handleSave} className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-4">
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Nome</label>
          <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Pedido Mín. (R$)</label>
            <input type="number" step="0.01" required value={minimo} onChange={e => setMinimo(parseFloat(e.target.value))} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Frete (R$)</label>
            <input type="number" step="0.01" required value={frete} onChange={e => setFrete(parseFloat(e.target.value))} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none" />
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
        {loading ? <div className="text-center text-stone-400">Carregando...</div> : fornecedores.map(f => (
          <div key={f.id_fornecedor} className={`bg-stone-850 p-4 rounded-xl border border-stone-800 flex justify-between items-center ${f.ativo === 'NÃO' ? 'opacity-50' : ''}`}>
            <div className="flex-1" onClick={() => editItem(f)}>
              <p className="font-bold text-stone-200">{f.nome}</p>
              <p className="text-xs text-stone-400">Mín: R$ {f.pedido_minimo.toFixed(2)} | Frete: R$ {f.taxa_entrega.toFixed(2)}</p>
            </div>
            <button onClick={() => toggleAtivo(f.id_fornecedor, f.ativo)} className={`p-2 rounded-lg ${f.ativo === 'SIM' ? 'text-rose-400 bg-rose-400/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
