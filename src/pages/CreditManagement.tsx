import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { StaffCreditHistory } from '../components/StaffCreditHistory';
import { useAuth } from '../context/AuthContext';

export const CreditManagement: React.FC = () => {
  const { role } = useAuth();
  const [funcionarios, setFuncionarios] = useState<{ id_funcionario: string; nome: string; ativo: string; saldo?: number }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal State for Clearance
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quitacaoValor, setQuitacaoValor] = useState('');
  const [quitacaoObs, setQuitacaoObs] = useState('');
  const [quitacaoTipo, setQuitacaoTipo] = useState<'Quitação parcial' | 'Quitação total'>('Quitação parcial');

  const fetchFuncionarios = useCallback(async () => {
    setLoading(true);
    // Fetch all funcionários (active and inactive as per PRD for clearance)
    const { data: funcs, error: errFuncs } = await supabase
      .from('funcionarios')
      .select('id_funcionario, nome, ativo')
      .order('nome');

    if (errFuncs || !funcs) {
      console.error(errFuncs);
      setLoading(false);
      return;
    }

    // Fetch all movements to compute balances
    const { data: movs, error: errMovs } = await supabase
      .from('credito_movimentos')
      .select('id_funcionario, tipo, valor');

    if (errMovs) {
      console.error(errMovs);
    }

    const funcsWithSaldo = funcs.map(f => {
      let saldo = 0;
      const fMovs = (movs || []).filter(m => m.id_funcionario === f.id_funcionario);
      fMovs.forEach(m => {
        if (m.tipo === 'Adiantamento' || m.tipo === 'Retirada de produto') {
          saldo += Number(m.valor);
        } else {
          saldo -= Number(m.valor);
        }
      });
      return { ...f, saldo };
    });

    setFuncionarios(funcsWithSaldo);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFuncionarios();
  }, [fetchFuncionarios]);

  const handleQuitacao = async () => {
    if (!selectedId || !quitacaoValor || Number(quitacaoValor) <= 0) return;
    
    // Double confirmation (RF-25)
    if (!window.confirm(`Confirma a ${quitacaoTipo} no valor de R$ ${quitacaoValor}?`)) {
      return;
    }

    const { error } = await supabase.from('credito_movimentos').insert({
      id_funcionario: selectedId,
      tipo: quitacaoTipo,
      valor: Number(quitacaoValor),
      observacao: quitacaoObs || null
    });

    if (error) {
      alert('Erro ao registrar quitação: ' + error.message);
    } else {
      setIsModalOpen(false);
      setQuitacaoValor('');
      setQuitacaoObs('');
      fetchFuncionarios();
    }
  };

  if (role !== 'gestao') {
    return <div className="p-4 text-rose-500">Acesso negado. Apenas gestores podem acessar a gestão de fiados.</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-20">
      <div>
        <h2 className="text-2xl font-bold text-amber-500">Gestão de Crédito (Fiado)</h2>
        <p className="text-sm text-stone-400">Controle de saldos e quitações gerenciais.</p>
      </div>

      <div className="bg-stone-850 rounded-xl border border-stone-800 overflow-hidden">
        {loading ? (
          <div className="p-4 text-stone-400">Carregando funcionários...</div>
        ) : (
          <div className="divide-y divide-stone-800">
            {funcionarios.map(func => (
              <div key={func.id_funcionario} className="p-4 flex justify-between items-center hover:bg-stone-800 transition-colors">
                <button 
                  onClick={() => setSelectedId(selectedId === func.id_funcionario ? null : func.id_funcionario)}
                  className="flex-1 text-left flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-stone-200">{func.nome}</p>
                    {func.ativo === 'NÃO' && <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded">Desativado</span>}
                  </div>
                  <div className="text-right mr-4">
                    <p className={`font-bold ${func.saldo && func.saldo > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      R$ {func.saldo?.toFixed(2)}
                    </p>
                    <p className="text-xs text-stone-500">Saldo atual</p>
                  </div>
                </button>
                <button 
                  onClick={() => {
                    setSelectedId(func.id_funcionario);
                    setQuitacaoTipo('Quitação total');
                    setQuitacaoValor(func.saldo ? func.saldo.toString() : '0');
                    setIsModalOpen(true);
                  }}
                  disabled={!func.saldo || func.saldo <= 0}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedId && (
        <div className="mt-8">
          <StaffCreditHistory 
            funcionarioId={selectedId} 
            isGestor={role === 'gestao'} 
            onMovementUpdated={fetchFuncionarios} 
          />
        </div>
      )}

      {/* Modal for Clearance */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-stone-200 mb-4">Registrar Quitação</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 mb-1">Tipo</label>
                <select 
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2 text-stone-200"
                  value={quitacaoTipo}
                  onChange={(e) => setQuitacaoTipo(e.target.value as 'Quitação parcial' | 'Quitação total')}
                >
                  <option value="Quitação parcial">Quitação Parcial</option>
                  <option value="Quitação total">Quitação Total</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-stone-400 mb-1">Valor (R$)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2 text-stone-200 focus:outline-none focus:border-amber-500"
                  value={quitacaoValor}
                  onChange={(e) => setQuitacaoValor(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-400 mb-1">Observação (opcional)</label>
                <input 
                  type="text" 
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2 text-stone-200 focus:outline-none focus:border-amber-500"
                  value={quitacaoObs}
                  onChange={(e) => setQuitacaoObs(e.target.value)}
                  placeholder="Ex: Pago em dinheiro"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 border border-stone-700 text-stone-300 py-2 rounded-lg font-bold hover:bg-stone-800"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleQuitacao}
                  disabled={!quitacaoValor || Number(quitacaoValor) <= 0}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-500 disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
