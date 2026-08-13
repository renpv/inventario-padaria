import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Turno {
  id_turno: string;
  nome_turno: string;
  ordem: number;
  horario_inicio: string;
  horario_fim: string;
  notificacao_tipo: 'push' | 'email' | 'nenhuma';
  ativo: 'SIM' | 'NÃO';
}

export const TurnosCrud: React.FC = () => {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form
  const [idEdit, setIdEdit] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [ordem, setOrdem] = useState(1);
  const [inicio, setInicio] = useState('00:00');
  const [fim, setFim] = useState('23:59');

  useEffect(() => {
    fetchTurnos();
  }, []);

  const fetchTurnos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('turnos')
      .select('*')
      .order('ordem');
    if (data) setTurnos(data as Turno[]);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nome_turno: nome,
      ordem,
      horario_inicio: inicio,
      horario_fim: fim,
      notificacao_tipo: 'nenhuma' as const,
      ativo: 'SIM' as const
    };

    if (idEdit) {
      await supabase.from('turnos').update(payload).eq('id_turno', idEdit);
    } else {
      await supabase.from('turnos').insert(payload);
    }
    
    resetForm();
    fetchTurnos();
  };

  const toggleAtivo = async (id: string, current: 'SIM' | 'NÃO') => {
    await supabase.from('turnos').update({ ativo: current === 'SIM' ? 'NÃO' : 'SIM' }).eq('id_turno', id);
    fetchTurnos();
  };

  const resetForm = () => {
    setIdEdit(null);
    setNome('');
    setOrdem(turnos.length > 0 ? Math.max(...turnos.map(t => t.ordem)) + 1 : 1);
    setInicio('00:00');
    setFim('23:59');
  };

  const editTurno = (t: Turno) => {
    setIdEdit(t.id_turno);
    setNome(t.nome_turno);
    setOrdem(t.ordem);
    setInicio(t.horario_inicio.substring(0, 5));
    setFim(t.horario_fim.substring(0, 5));
  };

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      <div className="flex items-center gap-4 bg-stone-850 p-4 rounded-xl border border-stone-800 sticky top-0 z-10">
        <Link to="/config" className="p-2 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-stone-300" />
        </Link>
        <h2 className="text-lg font-bold text-amber-500">Cadastro de Turnos</h2>
      </div>

      <form onSubmit={handleSave} className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-4">
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Nome do Turno</label>
          <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 focus:border-amber-500 outline-none" placeholder="Ex: Manhã - Abertura" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Ordem</label>
            <input type="number" required min="1" value={ordem} onChange={e => setOrdem(parseInt(e.target.value))} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Início</label>
            <input type="time" required value={inicio} onChange={e => setInicio(e.target.value)} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Fim</label>
            <input type="time" required value={fim} onChange={e => setFim(e.target.value)} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none" />
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
        {loading ? <div className="text-center text-stone-400">Carregando...</div> : turnos.map(t => (
          <div key={t.id_turno} className={`bg-stone-850 p-4 rounded-xl border border-stone-800 flex justify-between items-center ${t.ativo === 'NÃO' ? 'opacity-50' : ''}`}>
            <div className="flex-1" onClick={() => editTurno(t)}>
              <div className="flex items-center gap-2">
                <span className="bg-stone-800 text-amber-500 text-xs font-bold px-2 py-1 rounded">#{t.ordem}</span>
                <p className="font-bold text-stone-200">{t.nome_turno}</p>
              </div>
              <p className="text-xs text-stone-400 mt-1">{t.horario_inicio.substring(0, 5)} até {t.horario_fim.substring(0, 5)}</p>
            </div>
            <button onClick={() => toggleAtivo(t.id_turno, t.ativo)} className={`p-2 rounded-lg ${t.ativo === 'SIM' ? 'text-rose-400 bg-rose-400/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
