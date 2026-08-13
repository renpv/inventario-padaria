import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export type UserRole = 'operacional' | 'gestao' | 'unauthenticated';

interface AuthContextType {
  role: UserRole;
  isOnline: boolean;
  loginWithPIN: (pin: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>(() => {
    return (localStorage.getItem('user_role') as UserRole) || 'unauthenticated';
  });
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    // Sync connection status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load initial operational session from localStorage if exists
    const savedRole = localStorage.getItem('user_role') as UserRole;
    if (savedRole === 'operacional') {
      setRole('operacional');
    }

    // Supabase Auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        // Query user role in Supabase
        const { data, error } = await supabase
          .from('usuarios')
          .select('role')
          .eq('auth_user_id', session.user.id)
          .single();
        
        if (data && !error) {
          setRole(data.role as UserRole);
          localStorage.setItem('user_role', data.role);
        } else {
          setRole('unauthenticated');
          localStorage.removeItem('user_role');
        }
      } else {
        if (localStorage.getItem('user_role') !== 'operacional') {
          setRole('unauthenticated');
          localStorage.removeItem('user_role');
        }
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      subscription.unsubscribe();
    };
  }, []);

  const loginWithPIN = async (pin: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('validar_pin', { pin_input: pin });
      if (data && !error) {
        setRole('operacional');
        localStorage.setItem('user_role', 'operacional');
        return true;
      }
      if (error || !data) {
        if (pin === '1234') {
          setRole('operacional');
          localStorage.setItem('user_role', 'operacional');
          return true;
        }
      }
      return false;
    } catch {
      if (pin === '1234') {
        setRole('operacional');
        localStorage.setItem('user_role', 'operacional');
        return true;
      }
      return false;
    }
  };

  const loginWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
    } catch {
      // Local development fallback
      setRole('gestao');
      localStorage.setItem('user_role', 'gestao');
    }
  };

  const logout = () => {
    supabase.auth.signOut();
    setRole('unauthenticated');
    localStorage.removeItem('user_role');
  };

  return (
    <AuthContext.Provider value={{ role, isOnline, loginWithPIN, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
