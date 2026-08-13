import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Setor {
  id_setor: string;
  nome_setor: string;
  ativo: 'SIM' | 'NÃO';
}

export const SetoresCrud: React.FC = () => {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [idEdit, setIdEdit] = useState<string | null>(null);
  const [nome, setNome] = useState('');

  useEffect(() => {
    fetchSetores();
  }, []);

  const fetchSetores = async () => {
    setLoading(true);
    const { data } = await supabase.from('setores').select('*').order('nome_setor');
    if (data) setSetores(data as Setor[]);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { nome_setor: nome, ativo: 'SIM' as const };

    if (idEdit) {
      await supabase.from('setores').update(payload).eq('id_setor', idEdit);
    } else {
      await supabase.from('setores').insert(payload);
    }
    
    resetForm();
    fetchSetores();
  };

  const toggleAtivo = async (id: string, current: 'SIM' | 'NÃO') => {
    await supabase.from('setores').update({ ativo: current === 'SIM' ? 'NÃO' : 'SIM' }).eq('id_setor', id);
    fetchSetores();
  };

  const resetForm = () => {
    setIdEdit(null);
    setNome('');
  };

  const editSetor = (s: Setor) => {
    setIdEdit(s.id_setor);
    setNome(s.nome_setor);
  };

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      <div className="flex items-center gap-4 bg-stone-850 p-4 rounded-xl border border-stone-800 sticky top-0 z-10">
        <Link to="/config" className="p-2 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-stone-300" />
        </Link>
        <h2 className="text-lg font-bold text-amber-500">Cadastro de Setores</h2>
      </div>

      <form onSubmit={handleSave} className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-4">
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Nome do Setor</label>
          <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 focus:border-amber-500 outline-none" placeholder="Ex: Frios, Padaria, Depósito" />
        </div>
        <div className="flex gap-2 pt-2">
          {idEdit && <button type="button" onClick={resetForm} className="flex-1 py-3 bg-stone-800 text-stone-300 rounded-lg font-bold">Cancelar</button>}
          <button type="submit" className="flex-[2] py-3 bg-amber-600/20 text-amber-500 border border-amber-600/50 rounded-lg font-bold flex justify-center items-center gap-2">
            {idEdit ? <><Save size={18} /> Atualizar</> : <><Plus size={18} /> Adicionar</>}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {loading ? <div className="text-center text-stone-400">Carregando...</div> : setores.map(s => (
          <div key={s.id_setor} className={`bg-stone-850 p-4 rounded-xl border border-stone-800 flex justify-between items-center ${s.ativo === 'NÃO' ? 'opacity-50' : ''}`}>
            <div className="flex-1" onClick={() => editSetor(s)}>
              <p className="font-bold text-stone-200">{s.nome_setor}</p>
            </div>
            <button onClick={() => toggleAtivo(s.id_setor, s.ativo)} className={`p-2 rounded-lg ${s.ativo === 'SIM' ? 'text-rose-400 bg-rose-400/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
