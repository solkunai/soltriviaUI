import React, { useState, useEffect } from 'react';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';
import AdminDashboardEnhanced from './AdminDashboardEnhanced';

const AdminRoute: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if already authenticated (session stored in localStorage)
    const authStatus = localStorage.getItem('admin_authenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    setChecking(false);
  }, []);

  const handleLogin = (username: string, password: string): boolean => {
    const adminUsername = import.meta.env.VITE_ADMIN_USERNAME || 'admin';
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || '';

    // Debug: Log if env vars are missing (only in dev)
    if (import.meta.env.DEV) {
      if (!import.meta.env.VITE_ADMIN_USERNAME || !import.meta.env.VITE_ADMIN_PASSWORD) {
        console.warn('⚠️ Admin credentials not set in .env.local. Using defaults.');
      }
    }

    if (username === adminUsername && password === adminPassword) {
      localStorage.setItem('admin_authenticated', 'true');
      try {
        sessionStorage.setItem('admin_creds', JSON.stringify({ u: username, p: password }));
      } catch {
        // ignore
      }
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_authenticated');
    try {
      sessionStorage.removeItem('admin_creds');
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div>
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs font-black uppercase rounded-lg"
        >
          LOGOUT
        </button>
      </div>
      <AdminDashboardEnhanced />
    </div>
  );
};

export default AdminRoute;
