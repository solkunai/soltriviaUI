import React, { useState, useEffect, useCallback } from 'react';
import AdminLogin from './AdminLogin';
import AdminDashboardEnhanced from './AdminDashboardEnhanced';
import { adminLogin } from '../src/utils/api';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const AdminRoute: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('admin_authenticated');
    localStorage.removeItem('admin_last_activity');
    try {
      sessionStorage.removeItem('admin_secret');
    } catch (_) {}
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    // Check if already authenticated with valid session
    const authStatus = localStorage.getItem('admin_authenticated');
    const lastActivity = localStorage.getItem('admin_last_activity');
    let hasSecret = false;
    try { hasSecret = !!sessionStorage.getItem('admin_secret'); } catch (_) {}

    if (authStatus === 'true' && hasSecret) {
      // Check inactivity timeout
      if (lastActivity && Date.now() - Number(lastActivity) > INACTIVITY_TIMEOUT_MS) {
        handleLogout();
      } else {
        setIsAuthenticated(true);
      }
    } else if (authStatus === 'true' && !hasSecret) {
      // localStorage says authenticated but sessionStorage lost the secret (tab closed)
      handleLogout();
    }
    setChecking(false);
  }, [handleLogout]);

  // Track user activity for inactivity timeout
  useEffect(() => {
    if (!isAuthenticated) return;

    const updateActivity = () => {
      localStorage.setItem('admin_last_activity', String(Date.now()));
    };

    // Set initial activity
    updateActivity();

    // Listen for user interactions
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, updateActivity));

    // Check inactivity every 30 seconds
    const interval = setInterval(() => {
      const lastActivity = localStorage.getItem('admin_last_activity');
      if (lastActivity && Date.now() - Number(lastActivity) > INACTIVITY_TIMEOUT_MS) {
        handleLogout();
      }
    }, 30_000);

    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
      clearInterval(interval);
    };
  }, [isAuthenticated, handleLogout]);

  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    try {
      const { admin_secret } = await adminLogin(username, password);
      sessionStorage.setItem('admin_secret', admin_secret);
      localStorage.setItem('admin_authenticated', 'true');
      localStorage.setItem('admin_last_activity', String(Date.now()));
      setIsAuthenticated(true);
      return true;
    } catch (_) {
      return false;
    }
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
