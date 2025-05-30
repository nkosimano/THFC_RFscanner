import { Suspense, lazy } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import FieldWorkerPage from './pages/FieldWorkerPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUserPage from './pages/AdminUserPage';
import DispatchPage from './pages/DispatchPage';
import RequireAuth from './components/auth/RequireAuth';

const AdminCrateManagementPage = lazy(() => import('./pages/AdminCrateManagementPage'));
const AdminActivityLogsPage = lazy(() => import('./pages/AdminActivityLogsPage'));
const AdminSystemSettingsPage = lazy(() => import('./pages/AdminSystemSettingsPage'));

// Root layout component to ensure context is available
const RootLayout = () => {
  return <Outlet />;
};

export const routes = [
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <LoginPage />
      },
      {
        path: '/dispatch',
        element: (
          <RequireAuth>
            <DispatchPage />
          </RequireAuth>
        )
      },
      {
        path: '/field-worker',
        element: (
          <RequireAuth>
            <FieldWorkerPage />
          </RequireAuth>
        )
      },
      {
        path: '/admin',
        element: (
          <RequireAuth>
            <AdminDashboardPage />
          </RequireAuth>
        )
      },
      {
        path: '/admin/users',
        element: (
          <RequireAuth>
            <AdminUserPage />
          </RequireAuth>
        )
      },
      {
        path: '/admin/crates',
        element: (
          <RequireAuth>
            <Suspense fallback={null}>
              <AdminCrateManagementPage />
            </Suspense>
          </RequireAuth>
        )
      },
      {
        path: '/admin/logs',
        element: (
          <RequireAuth>
            <Suspense fallback={null}>
              <AdminActivityLogsPage />
            </Suspense>
          </RequireAuth>
        )
      },
      {
        path: '/admin/settings',
        element: (
          <RequireAuth>
            <Suspense fallback={null}>
              <AdminSystemSettingsPage />
            </Suspense>
          </RequireAuth>
        )
      },
      {
        path: '*',
        element: <Navigate to="/" replace />
      }
    ]
  }
]; 