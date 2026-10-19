import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      setLoading(true);
      const data = await api('/api/auth/me');
      setUser(data);
      setError(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    setError(null);
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      setUser(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setUser(null);
    }
  }

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'owner';
  const isInventoryManager = user?.role === 'inventory_manager' || isSuperAdmin;
  const isMarketingManager = user?.role === 'marketing_manager' || isSuperAdmin;

  return (
    <AdminAuthContext.Provider value={{
      user,
      loading,
      error,
      login,
      logout,
      checkAuth,
      isSuperAdmin,
      isInventoryManager,
      isMarketingManager
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return context;
}
