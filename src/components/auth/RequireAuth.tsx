import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useAuth();
  const location = useLocation();

  if (!state.isAuthenticated) {
    // Redirect unauthenticated users to login, preserving intended destination
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
