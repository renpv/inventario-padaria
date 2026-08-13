import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutGrid, ClipboardList, DollarSign, Settings, LogOut, Wifi, WifiOff } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, isOnline, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col font-sans max-w-md mx-auto relative shadow-2xl border-x border-stone-800">
      {/* Top Bar */}
      <header className="bg-stone-850 border-b border-stone-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <h1 className="text-lg font-bold tracking-tight text-amber-500">Padaria WMS</h1>
        <div className="flex items-center gap-3">
          {isOnline ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-900">
              <Wifi size={14} /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-rose-400 bg-rose-950/50 px-2.5 py-1 rounded-full border border-rose-900 animate-pulse">
              <WifiOff size={14} /> Offline
            </span>
          )}
          {role !== 'unauthenticated' && (
            <button onClick={handleLogout} className="p-1 hover:text-amber-500 transition-colors">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Tabs Navigation */}
      {role !== 'unauthenticated' && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-stone-900/90 backdrop-blur-md border-t border-stone-800 flex justify-around py-3 z-50">
          <Link
            to="/"
            className={`flex flex-col items-center gap-1 text-xs transition-colors ${
              isActive('/') ? 'text-amber-500 font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <LayoutGrid size={20} />
            <span>Painel</span>
          </Link>

          <Link
            to="/inventario"
            className={`flex flex-col items-center gap-1 text-xs transition-colors ${
              isActive('/inventario') ? 'text-amber-500 font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <ClipboardList size={20} />
            <span>Inventário</span>
          </Link>

          <Link
            to="/fiado"
            className={`flex flex-col items-center gap-1 text-xs transition-colors ${
              isActive('/fiado') ? 'text-amber-500 font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <DollarSign size={20} />
            <span>Fiados</span>
          </Link>

          {role === 'gestao' && (
            <Link
              to="/config"
              className={`flex flex-col items-center gap-1 text-xs transition-colors ${
                isActive('/config') ? 'text-amber-500 font-semibold' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Settings size={20} />
              <span>Ajustes</span>
            </Link>
          )}
        </nav>
      )}
    </div>
  );
};
