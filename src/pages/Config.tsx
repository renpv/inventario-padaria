import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { Plus, UserX, UserCheck, ShieldAlert } from 'lucide-react';

export const Config: React.FC = () => {
  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      
      {/* Cabeçalho */}
      <div className="bg-stone-850 p-6 rounded-xl border border-stone-800">
        <h2 className="text-xl font-bold text-amber-500 mb-2">Ajustes & Segurança</h2>
        <p className="text-sm text-stone-400">
          Gerenciamento de Lista Branca (Whitelist) de acessos e configurações do sistema.
        </p>
      </div>

      {/* Hub de Cadastros */}
      <div className="bg-stone-850 p-6 rounded-xl border border-stone-800 space-y-4">
        <h3 className="font-bold text-stone-200">Módulo de Cadastros</h3>
        <p className="text-sm text-stone-400 mb-4">Gerencie os dados base do sistema.</p>
        
        <div className="grid grid-cols-2 gap-3">
          <Link to="/gestao/cadastros/turnos" className="bg-stone-900 border border-stone-700 p-4 rounded-lg flex flex-col items-center gap-2 hover:border-amber-500 transition-colors group">
            <span className="text-2xl group-hover:scale-110 transition-transform">⏰</span>
            <span className="text-xs font-bold text-stone-300">Turnos</span>
          </Link>
          <Link to="/gestao/cadastros/setores" className="bg-stone-900 border border-stone-700 p-4 rounded-lg flex flex-col items-center gap-2 hover:border-amber-500 transition-colors group">
            <span className="text-2xl group-hover:scale-110 transition-transform">🏪</span>
            <span className="text-xs font-bold text-stone-300">Setores</span>
          </Link>
          <Link to="/gestao/cadastros/produtos" className="bg-stone-900 border border-stone-700 p-4 rounded-lg flex flex-col items-center gap-2 hover:border-amber-500 transition-colors group">
            <span className="text-2xl group-hover:scale-110 transition-transform">📦</span>
            <span className="text-xs font-bold text-stone-300">Produtos</span>
          </Link>
          <Link to="/gestao/cadastros/fornecedores" className="bg-stone-900 border border-stone-700 p-4 rounded-lg flex flex-col items-center gap-2 hover:border-amber-500 transition-colors group">
            <span className="text-2xl group-hover:scale-110 transition-transform">🚚</span>
            <span className="text-xs font-bold text-stone-300">Fornecedores</span>
          </Link>
          <Link to="/gestao/cadastros/precos" className="bg-stone-900 border border-stone-700 p-4 rounded-lg flex flex-col items-center gap-2 hover:border-amber-500 transition-colors group">
            <span className="text-2xl group-hover:scale-110 transition-transform">💲</span>
            <span className="text-xs font-bold text-stone-300">Preços</span>
          </Link>
          <Link to="/gestao/cadastros/funcionarios" className="bg-stone-900 border border-stone-700 p-4 rounded-lg flex flex-col items-center gap-2 hover:border-amber-500 transition-colors group">
            <span className="text-2xl group-hover:scale-110 transition-transform">👥</span>
            <span className="text-xs font-bold text-stone-300 text-center leading-tight">Time da Loja<br/>(Fiado)</span>
          </Link>
          <Link to="/gestao/cadastros/configuracoes" className="bg-stone-900 border border-stone-700 p-4 rounded-lg flex flex-col items-center gap-2 hover:border-amber-500 transition-colors group">
            <span className="text-2xl group-hover:scale-110 transition-transform">⚙️</span>
            <span className="text-xs font-bold text-stone-300">Configurações</span>
          </Link>
          <Link to="/gestao/cadastros/usuarios" className="bg-stone-900 border border-stone-700 p-4 rounded-lg flex flex-col items-center gap-2 hover:border-amber-500 transition-colors group">
            <span className="text-2xl group-hover:scale-110 transition-transform">🛡️</span>
            <span className="text-xs font-bold text-stone-300">Gestores</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
