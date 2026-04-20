import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Transfer from './pages/Transfer';
import UPI from './pages/UPI';
import Cards from './pages/Cards';
import Bills from './pages/Bills';
import Loans from './pages/Loans';
import Transactions from './pages/Transactions';
import Profile from './pages/Profile';
import AdminPanel from './pages/AdminPanel';
import HelpSupport from './pages/HelpSupport';

// Components
import Sidebar from './components/Sidebar';

// Protected Route wrapper
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
};

// User-only route — redirects admin users to admin panel
const UserRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  return children;
};

// Auth Route — redirect if already logged in (validates real token, not just persisted flag)
const AuthRoute = ({ children }) => {
  const { isAuthenticated, logout } = useAuthStore();
  // Check actual token exists in localStorage — persist middleware can be stale
  const hasToken = !!localStorage.getItem('accessToken');
  if (isAuthenticated && hasToken) return <Navigate to="/dashboard" replace />;
  // If flag says authenticated but token is gone, auto-clear stale state
  if (isAuthenticated && !hasToken) { logout(); }
  return children;
};

// App Layout with sidebar
const AppLayout = ({ children }) => (
  <div className="page-layout">
    <div className="animated-bg" />
    <Sidebar />
    <main className="main-content">{children}</main>
  </div>
);

// Smart default redirect based on role
const DefaultRedirect = () => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a3e',
            color: '#F0F0FF',
            border: '1px solid rgba(108,99,255,0.3)',
            borderRadius: '12px',
            fontFamily: 'Outfit, sans-serif',
          },
          success: { iconTheme: { primary: '#00E5A0', secondary: '#1a1a3e' } },
          error:   { iconTheme: { primary: '#FF5757', secondary: '#1a1a3e' } },
        }}
      />

      <Routes>
        {/* Public routes */}
        <Route path="/login"    element={<AuthRoute><Login /></AuthRoute>} />
        <Route path="/register" element={<AuthRoute><Register /></AuthRoute>} />

        {/* User-only routes (admins are redirected to /admin) */}
        <Route path="/dashboard"    element={<UserRoute><AppLayout><Dashboard /></AppLayout></UserRoute>} />
        <Route path="/transfer"     element={<UserRoute><AppLayout><Transfer /></AppLayout></UserRoute>} />
        <Route path="/upi"          element={<UserRoute><AppLayout><UPI /></AppLayout></UserRoute>} />
        <Route path="/cards"        element={<UserRoute><AppLayout><Cards /></AppLayout></UserRoute>} />
        <Route path="/bills"        element={<UserRoute><AppLayout><Bills /></AppLayout></UserRoute>} />
        <Route path="/loans"        element={<UserRoute><AppLayout><Loans /></AppLayout></UserRoute>} />
        <Route path="/transactions" element={<UserRoute><AppLayout><Transactions /></AppLayout></UserRoute>} />
        <Route path="/support"      element={<UserRoute><AppLayout><HelpSupport /></AppLayout></UserRoute>} />

        {/* Shared — both user and admin can access profile */}
        <Route path="/profile" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />

        {/* Admin only */}
        <Route path="/admin" element={<ProtectedRoute adminOnly><AppLayout><AdminPanel /></AppLayout></ProtectedRoute>} />

        {/* Default smart redirect */}
        <Route path="/"  element={<DefaultRedirect />} />
        <Route path="*"  element={<DefaultRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
