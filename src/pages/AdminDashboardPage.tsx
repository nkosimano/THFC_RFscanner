import React from 'react';
import Header from '../components/layout/Header';
import AdminDashboard from '../components/admin/AdminDashboard';

const AdminDashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <main className="flex-1 p-4 max-w-5xl mx-auto w-full">
        <AdminDashboard />
      </main>
    </div>
  );
};

export default AdminDashboardPage;