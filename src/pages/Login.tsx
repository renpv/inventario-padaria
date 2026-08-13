import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldAlert } from 'lucide-react';

export const Login: React.FC = () => {
  const { loginWithPIN, loginWithGoogle } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handlePINSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    const success = await loginWithPIN(pin);
    if (success) {
      navigate('/');
    } else {
      setError(true);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleError(null);
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error('Login com Google falhou:', err);
      setGoogleError('Não foi possível iniciar o login com Google. Tente novamente em instantes.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full bg-stone-850 p-6 rounded-2xl border border-stone-800 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-amber-500/10 rounded-full text-amber-500">
            <KeyRound size={28} />
          </div>
          <h2 className="text-xl font-bold text-stone-100">Acesso ao Sistema</h2>
          <p className="text-sm text-stone-400">Insira o PIN operacional ou conecte como gestor</p>
        </div>

        {/* PIN Login Form */}
        <form onSubmit={handlePINSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-stone-400 font-semibold uppercase">PIN de Operação</label>
            <input
              type="password"
              maxLength={4}
              pattern="[0-9]*"
              inputMode="numeric"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-stone-900 border border-stone-800 px-4 py-3 rounded-xl text-center text-xl tracking-widest text-amber-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/30 p-3 rounded-xl border border-rose-900">
              <ShieldAlert size={16} />
              <span>PIN incorreto. Tente novamente.</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold py-3 rounded-xl transition-colors shadow-lg shadow-amber-900/10"
          >
            Entrar como Operador
          </button>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-stone-800"></div>
          <span className="flex-shrink mx-4 text-stone-500 text-xs uppercase font-bold">ou</span>
          <div className="flex-grow border-t border-stone-800"></div>
        </div>

        {/* Google OAuth Login */}
        <button
          onClick={handleGoogleLogin}
          className="w-full bg-stone-800 hover:bg-stone-750 text-stone-200 font-semibold py-3 rounded-xl transition-colors border border-stone-700 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 5.617 1 .24 6.377.24 13s5.377 12 12 12c6.917 0 11.512-4.858 11.512-11.712 0-.788-.087-1.39-.19-2h-11.32z"
            />
          </svg>
          Entrar com o Google (Gestão)
        </button>

        {googleError && (
          <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/30 p-3 rounded-xl border border-rose-900">
            <ShieldAlert size={16} />
            <span>{googleError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
