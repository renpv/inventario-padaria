import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { SectorSelector } from './pages/SectorSelector';
import { ShiftInventory } from './pages/ShiftInventory';
import { Fiado } from './pages/Fiado';
import { Config } from './pages/Config';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { role } = useAuth();

  if (role === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

import { syncDaemon } from './services/syncDaemon';

const AppContent: React.FC = () => {
  const { role } = useAuth();

  React.useEffect(() => {
    syncDaemon.start();
    return () => syncDaemon.stop();
  }, []);
  
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/login" element={role !== 'unauthenticated' ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/inventario" element={<ProtectedRoute><SectorSelector /></ProtectedRoute>} />
          <Route path="/inventario/:id_turno/:id_setor" element={<ProtectedRoute><ShiftInventory /></ProtectedRoute>} />
          <Route path="/fiado" element={<ProtectedRoute><Fiado /></ProtectedRoute>} />
          <Route path="/config" element={<ProtectedRoute allowedRoles={['gestao']}><Config /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
