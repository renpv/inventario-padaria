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
import { WmsDashboard } from './pages/WmsDashboard';
import { CreditManagement } from './pages/CreditManagement';
import { TurnosCrud } from './pages/cadastros/TurnosCrud';
import { SetoresCrud } from './pages/cadastros/SetoresCrud';
import { ProdutosCrud } from './pages/cadastros/ProdutosCrud';
import { FornecedoresCrud } from './pages/cadastros/FornecedoresCrud';
import { FuncionariosCrud } from './pages/cadastros/FuncionariosCrud';
import { PrecosCrud } from './pages/cadastros/PrecosCrud';
import { UsuariosCrud } from './pages/cadastros/UsuariosCrud';

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
          <Route path="/wms" element={<ProtectedRoute allowedRoles={['gestao']}><WmsDashboard /></ProtectedRoute>} />
          <Route path="/gestao/fiados" element={<ProtectedRoute allowedRoles={['gestao']}><CreditManagement /></ProtectedRoute>} />
          <Route path="/config" element={<ProtectedRoute allowedRoles={['gestao']}><Config /></ProtectedRoute>} />
          
          {/* Rotas de Cadastros */}
          <Route path="/gestao/cadastros/turnos" element={<ProtectedRoute allowedRoles={['gestao']}><TurnosCrud /></ProtectedRoute>} />
          <Route path="/gestao/cadastros/setores" element={<ProtectedRoute allowedRoles={['gestao']}><SetoresCrud /></ProtectedRoute>} />
          <Route path="/gestao/cadastros/produtos" element={<ProtectedRoute allowedRoles={['gestao']}><ProdutosCrud /></ProtectedRoute>} />
          <Route path="/gestao/cadastros/fornecedores" element={<ProtectedRoute allowedRoles={['gestao']}><FornecedoresCrud /></ProtectedRoute>} />
          <Route path="/gestao/cadastros/funcionarios" element={<ProtectedRoute allowedRoles={['gestao']}><FuncionariosCrud /></ProtectedRoute>} />
          <Route path="/gestao/cadastros/precos" element={<ProtectedRoute allowedRoles={['gestao']}><PrecosCrud /></ProtectedRoute>} />
          <Route path="/gestao/cadastros/usuarios" element={<ProtectedRoute allowedRoles={['gestao']}><UsuariosCrud /></ProtectedRoute>} />

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
