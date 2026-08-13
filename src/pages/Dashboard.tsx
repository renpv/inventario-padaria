import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PackageMinus, Search, PackageCheck } from 'lucide-react';

import { WmsDashboard } from './WmsDashboard';
import { TurnosStatusPanel } from '../components/TurnosStatusPanel';

export const Dashboard: React.FC = () => {
  const { role } = useAuth();

  return (
    <div className="space-y-6">
      <div className="bg-stone-850 p-4 rounded-xl border border-stone-800">
        <h2 className="text-lg font-bold text-amber-500">Painel Principal</h2>
        <p className="text-sm text-stone-400">
          Perfil ativo: <strong className="text-stone-200 capitalize">{role === 'gestao' ? 'Gestão (WMS)' : 'Operação'}</strong>.
        </p>
      </div>

      <TurnosStatusPanel />

      <div className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-3">
        <h3 className="text-xs text-stone-400 font-bold uppercase tracking-wider">Acesso Rápido</h3>
        <div className="grid grid-cols-3 gap-3">
          <Link
            to="/sobras-perdas"
            className="bg-stone-900 border border-stone-700 p-3 rounded-lg flex flex-col items-center gap-1.5 hover:border-amber-500 transition-colors text-center"
          >
            <PackageMinus size={20} className="text-amber-500" />
            <span className="text-[11px] font-bold text-stone-300 leading-tight">Sobras / Perdas</span>
          </Link>
          <Link
            to="/consulta-estoque"
            className="bg-stone-900 border border-stone-700 p-3 rounded-lg flex flex-col items-center gap-1.5 hover:border-amber-500 transition-colors text-center"
          >
            <Search size={20} className="text-amber-500" />
            <span className="text-[11px] font-bold text-stone-300 leading-tight">Consultar Estoque</span>
          </Link>
          <Link
            to="/recebimento"
            className="bg-stone-900 border border-stone-700 p-3 rounded-lg flex flex-col items-center gap-1.5 hover:border-amber-500 transition-colors text-center"
          >
            <PackageCheck size={20} className="text-amber-500" />
            <span className="text-[11px] font-bold text-stone-300 leading-tight">Recebimento</span>
          </Link>
        </div>
      </div>

      {role === 'gestao' ? (
        <WmsDashboard />
      ) : (
        <div className="bg-stone-850 p-6 rounded-xl border border-stone-800 text-center space-y-4">
          <h3 className="font-bold text-stone-200">Área Operacional</h3>
          <p className="text-xs text-stone-400">Utilize as abas inferiores e o acesso rápido acima para as tarefas do dia.</p>
        </div>
      )}
    </div>
  );
};
