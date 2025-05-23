import React from 'react';
import Header from '../components/layout/Header';
import BarcodeScanner from '../components/field-worker/BarcodeScanner';

const FieldWorkerPage: React.FC = () => {
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