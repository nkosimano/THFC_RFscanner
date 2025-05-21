import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import FieldWorkerPage from './pages/FieldWorkerPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUserPage from './pages/AdminUserPage';

const AdminCrateManagementPage = lazy(() => import('./pages/AdminCrateManagementPage'));

function App() {
  // Temporary bypass for development
  const bypassAuth = process.env.NODE_ENV === 'development' || localStorage.getItem('thfc_user') !== null;

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LoginPage />} />
          
          {/* Protected routes - Field Worker */}
          <Route path="/field-worker" element={<FieldWorkerPage />} />
          
          {/* Protected routes - Admin */}
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route 
            path="/admin/users" 
            element={
              bypassAuth ? (
                <AdminUserPage />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route
            path="/admin/crates"
            element={
              bypassAuth ? (
                <Suspense fallback={null}>
                  <AdminCrateManagementPage />
                </Suspense>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;