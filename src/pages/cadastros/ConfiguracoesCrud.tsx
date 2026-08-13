import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ArrowLeft, Save, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ConfiguracoesCrud: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Settings states
  const [pin, setPin] = useState('1234');
  const [emailAtivo, setEmailAtivo] = useState(true);
  const [emails, setEmails] = useState('');
  const [limiteFiado, setLimiteFiado] = useState(0);
  const [pushAtivo, setPushAtivo] = useState(true);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    const { data } = await supabase.from('configuracoes').select('chave, valor');
    if (data) {
      data.forEach(item => {
        if (item.chave === 'pin_operacional') setPin(item.valor);
        if (item.chave === 'email_alerta_ativo') setEmailAtivo(item.valor === 'true');
        if (item.chave === 'email_alerta_destinos') {
          try {
            const arr = JSON.parse(item.valor);
            setEmails(arr.join(', '));
          } catch {
            setEmails('');
          }
        }
        if (item.chave === 'limite_global_fiado') setLimiteFiado(parseFloat(item.valor) || 0);
        if (item.chave === 'push_notifications') setPushAtivo(item.valor === 'true');
      });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const emailList = emails.split(',').map(e => e.trim()).filter(e => e.length > 0);
    
    const updates = [
      { chave: 'pin_operacional', valor: pin },
      { chave: 'email_alerta_ativo', valor: emailAtivo ? 'true' : 'false' },
      { chave: 'email_alerta_destinos', valor: JSON.stringify(emailList) },
      { chave: 'limite_global_fiado', valor: limiteFiado.toString() },
      { chave: 'push_notifications', valor: pushAtivo ? 'true' : 'false' }
    ];

    try {
      for (const config of updates) {
        await supabase
          .from('configuracoes')
          .update({ valor: config.valor })
          .eq('chave', config.chave);
      }
      alert('Configurações atualizadas com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar as configurações.');
    }
    
    setSaving(false);
  };

  if (loading) {
    return <div className="text-stone-400 p-8 text-center">Carregando configurações...</div>;
  }

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      <div className="flex items-center gap-4 bg-stone-850 p-4 rounded-xl border border-stone-800 sticky top-0 z-10">
        <Link to="/config" className="p-2 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-stone-300" />
        </Link>
        <h2 className="text-lg font-bold text-amber-500">Configurações Gerais</h2>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Segurança */}
        <div className="bg-stone-850 p-6 rounded-xl border border-stone-800 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="text-amber-500" size={20} />
            <h3 className="font-bold text-stone-200">Segurança</h3>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">PIN Operacional</label>
            <input 
              type="text" 
              required 
              value={pin} 
              onChange={e => setPin(e.target.value)} 
              className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 font-mono tracking-widest outline-none focus:border-amber-500" 
            />
            <p className="text-[10px] text-stone-500 mt-1">Código único usado pelos funcionários no salão da padaria.</p>
          </div>
        </div>

        {/* Notificações */}
        <div className="bg-stone-850 p-6 rounded-xl border border-stone-800 space-y-4">
          <h3 className="font-bold text-stone-200 mb-2">Notificações de Fechamento</h3>
          
          <div className="flex items-center justify-between p-3 bg-stone-900 border border-stone-700 rounded-lg">
            <span className="text-sm font-bold text-stone-300">Enviar Alertas por E-mail</span>
            <input type="checkbox" checked={emailAtivo} onChange={e => setEmailAtivo(e.target.checked)} className="w-5 h-5 accent-amber-500" />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">E-mails de Destino</label>
            <input 
              type="text" 
              disabled={!emailAtivo}
              value={emails} 
              onChange={e => setEmails(e.target.value)} 
              className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 disabled:opacity-50 outline-none focus:border-amber-500" 
              placeholder="admin@padaria.com, socio@padaria.com"
            />
            <p className="text-[10px] text-stone-500 mt-1">Separe os e-mails por vírgula.</p>
          </div>

          <div className="flex items-center justify-between p-3 bg-stone-900 border border-stone-700 rounded-lg mt-2">
            <span className="text-sm font-bold text-stone-300">Notificações Push (Celular)</span>
            <input type="checkbox" checked={pushAtivo} onChange={e => setPushAtivo(e.target.checked)} className="w-5 h-5 accent-amber-500" />
          </div>
        </div>

        {/* Fiado */}
        <div className="bg-stone-850 p-6 rounded-xl border border-stone-800 space-y-4">
          <h3 className="font-bold text-stone-200 mb-2">Regras de Crédito Loja</h3>
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Limite Global (R$)</label>
            <input 
              type="number" 
              step="0.01" 
              value={limiteFiado} 
              onChange={e => setLimiteFiado(parseFloat(e.target.value))} 
              className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-sm text-stone-200 outline-none focus:border-amber-500" 
            />
            <p className="text-[10px] text-stone-500 mt-1">Zero (0) significa que não há limite de bloqueio automático no sistema.</p>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={saving}
          className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded-xl flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
        >
          <Save size={20} />
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </form>
    </div>
  );
};
