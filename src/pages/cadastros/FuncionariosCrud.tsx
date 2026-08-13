import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Funcionario {
  id_funcionario: string;
  nome: string;
  ativo: 'SIM' | 'NÃO';
}

export const FuncionariosCrud: React.FC = () => {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [idEdit, setIdEdit] = useState<string | null>(null);
  const [nome, setNome] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('funcionarios').select('*').order('nome');
    if (data) setFuncionarios(data as Funcionario[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { nome, ativo: 'SIM' as const };

    if (idEdit) {
      await supabase.from('funcionarios').update(payload).eq('id_funcionario', idEdit);
    } else {
      await supabase.from('funcionarios').insert(payload);
    }
    
    resetForm();
    fetchData();
  };

  const toggleAtivo = async (id: string, current: 'SIM' | 'NÃO') => {
    await supabase.from('funcionarios').update({ ativo: current === 'SIM' ? 'NÃO' : 'SIM' }).eq('id_funcionario', id);
    fetchData();
  };

  const resetForm = () => {
    setIdEdit(null);
    setNome('');
  };

  const editItem = (f: Funcionario) => {
    setIdEdit(f.id_funcionario);
    setNome(f.nome);
  };

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      <div className="flex items-center gap-4 bg-stone-850 p-4 rounded-xl border border-stone-800 sticky top-0 z-10">
        <Link to="/config" className="p-2 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-stone-300" />
        </Link>
        <h2 className="text-lg font-bold text-amber-500">Cadastro de Funcionários</h2>
      </div>

      <form onSubmit={handleSave} className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-4">
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Nome Completo</label>
          <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none" />
        </div>
        <div className="flex gap-2 pt-2">
          {idEdit && <button type="button" onClick={resetForm} className="flex-1 py-3 bg-stone-800 text-stone-300 rounded-lg font-bold">Cancelar</button>}
          <button type="submit" className="flex-[2] py-3 bg-amber-600/20 text-amber-500 border border-amber-600/50 rounded-lg font-bold flex justify-center items-center gap-2">
            {idEdit ? <><Save size={18} /> Atualizar</> : <><Plus size={18} /> Adicionar</>}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {loading ? <div className="text-center text-stone-400">Carregando...</div> : funcionarios.map(f => (
          <div key={f.id_funcionario} className={`bg-stone-850 p-4 rounded-xl border border-stone-800 flex justify-between items-center ${f.ativo === 'NÃO' ? 'opacity-50' : ''}`}>
            <div className="flex-1" onClick={() => editItem(f)}>
              <p className="font-bold text-stone-200">{f.nome}</p>
            </div>
            <button onClick={() => toggleAtivo(f.id_funcionario, f.ativo)} className={`p-2 rounded-lg ${f.ativo === 'SIM' ? 'text-rose-400 bg-rose-400/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
