import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import FieldWorkerPage from './pages/FieldWorkerPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUserPage from './pages/AdminUserPage';
import DispatchPage from './pages/DispatchPage';
import RequireAuth from './components/auth/RequireAuth';

const AdminCrateManagementPage = lazy(() => import('./pages/AdminCrateManagementPage'));

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public route: login/landing page */}
          <Route path="/" element={<LoginPage />} />

          {/* Protected routes: require authentication */}
          <Route path="/dispatch" element={
            <RequireAuth>
              <DispatchPage />
            </RequireAuth>
          } />
          <Route path="/field-worker" element={
            <RequireAuth>
              <FieldWorkerPage />
            </RequireAuth>
          } />
          <Route path="/admin" element={
            <RequireAuth>
              <AdminDashboardPage />
            </RequireAuth>
          } />
          <Route path="/admin/users" element={
            <RequireAuth>
              <AdminUserPage />
            </RequireAuth>
          } />
          <Route path="/admin/crates" element={
            <RequireAuth>
              <Suspense fallback={null}>
                <AdminCrateManagementPage />
              </Suspense>
            </RequireAuth>
          } />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;