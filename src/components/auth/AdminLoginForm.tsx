import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import LogoutButton from './LogoutButton';

const AdminDashboard: React.FC = () => {
  const { state } = useAuth();
  const user = state.user;

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow p-8 flex flex-col items-center">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Welcome, {user?.fullName}</p>
      </div>
      <div className="w-full mb-8">
        <div className="bg-gray-100 p-4 rounded-lg mb-4">
          <h2 className="font-medium mb-2">Your Profile</h2>
          <div className="text-sm">
            <p><span className="font-medium">Email:</span> {user?.email}</p>
            <p><span className="font-medium">Role:</span> {user?.role}</p>

          </div>
        </div>
        
        <div className="flex justify-center mt-6">
          <LogoutButton variant="primary" />
        </div>
      </div>
    </div>
  );
};

const AdminLoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const { login, state } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!email.trim()) {
      setFormError('Email is required');
      return;
    }
    if (!password.trim()) {
      setFormError('Password is required');
      return;
    }
    // Password validation completed successfully

    try {
      await login(email, password);
    } catch (error: unknown) {
      let message = 'An unexpected error occurred. Please try again.';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'object' && error && 'message' in error) {
        message = String((error as any).message);
      }
      setFormError(message);
    }
  };

  // If user is authenticated and has admin role, show admin dashboard
  // UserRole is defined in zoho.ts as 'production_operator', 'dispatch_coordinator', etc.
// There is no 'admin', so use the correct admin role from USER_ROLES (likely 'zoho_admin')
if (state.isAuthenticated && state.user?.role === 'zoho_admin') {
    return <AdminDashboard />;
  }

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow p-8 flex flex-col items-center">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Admin Portal</h1>
        <p className="text-gray-600">Sign in to the Admin Portal</p>
      </div>
      <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
          <label htmlFor="admin-email" className="font-medium">Email</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="border rounded px-3 py-2"
            autoComplete="username"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="admin-password" className="font-medium">Password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="border rounded px-3 py-2"
            autoComplete="current-password"
          />
        </div>
        {(state.error || formError) && (
          <div className="text-red-600 text-sm mt-2">
            {state.error || formError}
          </div>
        )}
        <button 
          type="submit" 
          className={`${state.isLoading ? 'bg-blue-500' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded px-4 py-2 mt-4 w-full transition`} 
          disabled={state.isLoading}
        >
          {state.isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default AdminLoginForm;
