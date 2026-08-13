import React from 'react';
import { useAuth } from '../context/AuthContext';

import { WmsDashboard } from './WmsDashboard';

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

      {role === 'gestao' ? (
        <WmsDashboard />
      ) : (
        <div className="bg-stone-850 p-6 rounded-xl border border-stone-800 text-center space-y-4">
          <h3 className="font-bold text-stone-200">Área Operacional</h3>
          <p className="text-xs text-stone-400">Utilize as abas inferiores para acessar as tarefas operacionais.</p>
        </div>
      )}
    </div>
  );
};
