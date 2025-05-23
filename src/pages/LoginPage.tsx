import React from 'react';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div style={{ marginBottom: '2rem', display: 'flex', gap: '2rem' }}>
        <button
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => navigate('/field-worker')}
        >
          THFC Scan (Field Worker View)
        </button>
        <button
          className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700"
          onClick={() => navigate('/admin')}
        >
          Admin Portal (Admin View)
        </button>
      </div>
      <div className="text-gray-500">No authentication required. Select a view to continue.</div>
    </div>
  );
};

export default LoginPage;