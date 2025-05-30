import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { routes } from './routes';

// Create router after AuthProvider is initialized
function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

// Separate component for routes to ensure AuthProvider is initialized first
function AppRoutes() {
  const router = createBrowserRouter(routes);
  return <RouterProvider router={router} />;
}

export default App;