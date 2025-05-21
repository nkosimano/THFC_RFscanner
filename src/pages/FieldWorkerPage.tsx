import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/layout/Header';
import BarcodeScanner from '../components/field-worker/BarcodeScanner';

const FieldWorkerPage: React.FC = () => {
  const { state } = useAuth();
  
  // If user is not authenticated, redirect to login
  if (!state.isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  // If user is not a field worker, redirect appropriately
  if (state.user && state.user.role !== 'field_worker') {
    return <Navigate to={state.user.role === 'admin' ? '/admin' : '/'} replace />;
  }
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <main className="flex-1 p-4 max-w-md mx-auto w-full">
        <h1 className="text-xl font-semibold text-gray-800 mb-4">Crate Scanner</h1>
        <BarcodeScanner />
      </main>
    </div>
  );
};

export default FieldWorkerPage;