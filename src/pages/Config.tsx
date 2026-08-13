import React from 'react';

export const Config: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="bg-stone-850 p-4 rounded-xl border border-stone-800">
        <h2 className="text-lg font-bold text-amber-500">Configurações do Gestor</h2>
        <p className="text-sm text-stone-400">Gerenciamento de turnos, e-mails de alerta e PIN operacional.</p>
      </div>
    </div>
  );
};
