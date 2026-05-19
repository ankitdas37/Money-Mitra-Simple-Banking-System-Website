import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store';

export default function Home() {
  const { isAuthenticated, user } = useAuthStore();

  // Redirect authenticated users to their dashboard
  if (isAuthenticated) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  // Redirect unauthenticated users to login
  return <Navigate to="/login" replace />;
}
