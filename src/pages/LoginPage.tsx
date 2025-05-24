import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, signUp, state } = useAuth();

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sign up form state
  const [showSignUp, setShowSignUp] = useState(false);
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpFullName, setSignUpFullName] = useState('');
  const [signUpRole, setSignUpRole] = useState('csi_field_worker');

  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const handleLogin = async (destination: '/field-worker' | '/admin') => {
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(destination);
    } catch (err: unknown) {
      let message = 'Login failed.';
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === 'object' && err && 'message' in err) {
        message = String((err as any).message);
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setSignUpError(null);
    setSignUpLoading(true);
    setSignUpSuccess(false);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await signUp(signUpEmail, signUpPassword, {
        fullName: signUpFullName,
        role: signUpRole as 'csi_field_worker' | 'thfc_production_operator' | 'production_operator' | 'dispatch_coordinator' | 'zoho_admin',
      });
      setSignUpSuccess(true);
      setShowSignUp(false);
      setEmail(signUpEmail);
      setPassword(signUpPassword);
    } catch (err: unknown) {
      let message = 'Sign up failed.';
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === 'object' && err && 'message' in err) {
        message = String((err as any).message);
      }
      setSignUpError(message);
    } finally {
      setSignUpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-sm flex flex-col gap-4">
        {showSignUp ? (
          <>
            <h2 className="text-xl font-semibold mb-2">Sign Up</h2>
            <input
              type="email"
              placeholder="Email"
              value={signUpEmail}
              onChange={e => setSignUpEmail(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              autoComplete="username"
            />
            <input
              type="password"
              placeholder="Password"
              value={signUpPassword}
              onChange={e => setSignUpPassword(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              autoComplete="new-password"
            />
            <input
              type="text"
              placeholder="Full Name"
              value={signUpFullName}
              onChange={e => setSignUpFullName(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
            <select
              value={signUpRole}
              onChange={e => setSignUpRole(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              <option value="csi_field_worker">CSI Field Worker</option>
              <option value="thfc_production_operator">THFC Production Operator</option>
              <option value="production_operator">Production Operator</option>
              <option value="dispatch_coordinator">Dispatch Coordinator</option>
              <option value="zoho_admin">Zoho Admin</option>
            </select>

            {signUpError && <div className="text-red-600 text-sm">{signUpError}</div>}
            <button
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              onClick={handleSignUp}
              disabled={signUpLoading}
            >
              {signUpLoading ? 'Signing up...' : 'Sign Up'}
            </button>
            <button
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              onClick={() => setShowSignUp(false)}
              disabled={signUpLoading}
            >
              Back to Login
            </button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-2">Login</h2>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              autoComplete="username"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              autoComplete="current-password"
            />
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {state.error && <div className="text-red-600 text-sm">{state.error}</div>}
            {signUpSuccess && <div className="text-green-600 text-sm">Sign up successful! Please check your email to verify your account before logging in.</div>}
            <div className="flex gap-4 mt-2">
              <button
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={() => handleLogin('/field-worker')}
                disabled={loading}
              >
                THFC Scan (Field Worker View)
              </button>
              <button
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                onClick={() => handleLogin('/admin')}
                disabled={loading}
              >
                Admin Portal (Admin View)
              </button>
            </div>
            {loading && <div className="text-gray-500 text-sm mt-2">Logging in...</div>}
            <button
              className="mt-4 px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              onClick={() => setShowSignUp(true)}
              disabled={loading}
            >
              Sign Up
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;