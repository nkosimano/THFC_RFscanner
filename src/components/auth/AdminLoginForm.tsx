import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';


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
    // ========================================================================
    // CONSOLE LOG FOR DEBUGGING THE PASSWORD CAPTURED BY THE UI
    // ========================================================================
    // WARNING: This is for temporary local debugging ONLY.
    // NEVER commit code that logs passwords or deploy it to production.
    // Remove or comment out this line after you're done debugging.
    console.log('[UI DEBUG] Password captured by form state:', password);
    // ========================================================================

    try {
      await login(email, password);
    } catch (error: any) {
      setFormError(error?.message || 'An unexpected error occurred. Please try again.');
    }
  };

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
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2 mt-4 w-full hover:bg-blue-700 transition" disabled={state.isLoading}>
          {state.isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default AdminLoginForm;
