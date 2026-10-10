import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Chatbot from './Chatbot';
import { useAuthStore } from '../authStore';

const MainLayout = () => {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto h-full relative">
        <div className="p-8 pb-24">
            <Outlet />
        </div>
      </main>
      <Chatbot />
    </div>
  );
};

export default MainLayout;