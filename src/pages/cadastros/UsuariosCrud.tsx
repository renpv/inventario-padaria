import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ArrowLeft, Plus, UserX, UserCheck, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

interface UserRow {
  id_usuario: string;
  auth_user_id: string | null;
  nome: string;
  email: string;
  role: 'gestao' | 'operacional';
  ativo: 'SIM' | 'NÃO';
}

export const UsuariosCrud: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'gestao' | 'operacional'>('gestao');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('nome');
    
    if (data && !error) {
      setUsers(data as UserRow[]);
    }
    setLoading(false);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName) return;

    const { error } = await supabase.from('usuarios').insert({
      email: newEmail.trim(),
      nome: newName.trim(),
      role: newRole,
      ativo: 'SIM'
    });

    if (error) {
      alert('Erro ao adicionar usuário: ' + error.message);
    } else {
      setNewEmail('');
      setNewName('');
      fetchUsers();
    }
  };

  const toggleAtivo = async (id: string, currentAtivo: 'SIM' | 'NÃO') => {
    const newAtivo = currentAtivo === 'SIM' ? 'NÃO' : 'SIM';
    const { error } = await supabase
      .from('usuarios')
      .update({ ativo: newAtivo })
      .eq('id_usuario', id);
    
    if (!error) {
      fetchUsers();
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      <div className="flex items-center gap-4 bg-stone-850 p-4 rounded-xl border border-stone-800 sticky top-0 z-10">
        <Link to="/config" className="p-2 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-stone-300" />
        </Link>
        <h2 className="text-lg font-bold text-amber-500">Gestores & Acessos</h2>
      </div>

      {/* Adicionar Usuário */}
      <div className="bg-stone-850 p-6 rounded-xl border border-stone-800 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="text-amber-500" size={20} />
          <h3 className="font-bold text-stone-200">Adicionar à Whitelist</h3>
        </div>
        <form onSubmit={handleAddUser} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Nome Completo</label>
            <input
              type="text"
              required
              className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: João da Silva"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">E-mail (Conta Google)</label>
            <input
              type="email"
              required
              className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="joao@padaria.com.br"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Perfil de Acesso</label>
            <select
              className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
            >
              <option value="gestao">Gestão (Total)</option>
              <option value="operacional">Operacional (Restrito)</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-amber-600/20 text-amber-500 border border-amber-600/50 hover:bg-amber-600/40 transition-colors font-bold py-3 rounded-lg flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Cadastrar E-mail
          </button>
        </form>
      </div>

      {/* Lista de Usuários */}
      <div className="bg-stone-850 rounded-xl border border-stone-800 overflow-hidden">
        <div className="p-4 border-b border-stone-800 bg-stone-900/50">
          <h3 className="font-bold text-stone-200">Usuários Cadastrados</h3>
        </div>
        
        {loading ? (
          <div className="p-6 text-center text-stone-400">Carregando lista...</div>
        ) : (
          <div className="divide-y divide-stone-800">
            {users.map(u => (
              <div key={u.id_usuario} className={`p-4 flex items-center justify-between ${u.ativo === 'NÃO' ? 'opacity-50 grayscale' : ''}`}>
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm font-bold text-stone-200 truncate">{u.nome}</p>
                  <p className="text-xs text-stone-400 truncate">{u.email}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-stone-800 text-stone-300">
                      {u.role}
                    </span>
                    {u.auth_user_id ? (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-400 border border-emerald-800/50">
                        Login Google OK
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-900/30 text-amber-500 border border-amber-800/50">
                        Pendente
                      </span>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => toggleAtivo(u.id_usuario, u.ativo)}
                  className={`p-2 rounded-lg transition-colors ${
                    u.ativo === 'SIM' 
                      ? 'bg-rose-900/20 text-rose-400 hover:bg-rose-900/40' 
                      : 'bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40'
                  }`}
                  title={u.ativo === 'SIM' ? 'Bloquear Acesso' : 'Restaurar Acesso'}
                >
                  {u.ativo === 'SIM' ? <UserX size={18} /> : <UserCheck size={18} />}
                </button>
              </div>
            ))}
            {users.length === 0 && (
              <div className="p-6 text-center text-stone-400 text-sm">
                Nenhum usuário encontrado.
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
