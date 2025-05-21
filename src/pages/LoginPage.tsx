import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminLoginForm from '../components/auth/AdminLoginForm';
import FieldWorkerLoginForm from '../components/auth/FieldWorkerLoginForm';
import SignUpForm from '../components/auth/SignUpForm';

const LoginPage: React.FC = () => {
  const { state } = useAuth();
  
  // If user is already authenticated, redirect based on role
  if (state.isAuthenticated && state.user) {
    if (state.user.role === 'field_worker') {
      return <Navigate to="/field-worker" replace />;
    } else if (state.user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
  }
  
  const [showAdmin, setShowAdmin] = React.useState(false);
  const [showSignUp, setShowSignUp] = React.useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {showSignUp ? (
        <>
          <SignUpForm />
          <button className="mt-4 underline text-blue-600" onClick={() => setShowSignUp(false)}>
            Back to Login
          </button>
        </>
      ) : (
        <>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
            <button
              className={showAdmin ? 'font-bold underline' : ''}
              onClick={() => setShowAdmin(true)}
            >
              Admin Portal
            </button>
            <button
              className={!showAdmin ? 'font-bold underline' : ''}
              onClick={() => setShowAdmin(false)}
            >
              THFC Scan
            </button>
            <button
              className="ml-4 underline text-green-600"
              onClick={() => setShowSignUp(true)}
            >
              Sign Up
            </button>
          </div>
          {showAdmin ? <AdminLoginForm /> : <FieldWorkerLoginForm />}
        </>
      )}
    </div>
  );
};

export default LoginPage;