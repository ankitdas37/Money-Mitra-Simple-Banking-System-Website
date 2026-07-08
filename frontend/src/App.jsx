import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
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

import AboutUs from './pages/AboutUs';
import PublicInfoPage from './pages/PublicInfoPage';

// Components
import Sidebar from './components/Sidebar';

// Strict 10-minute session auto-logout
const StrictAutoLogout = () => {
  const { isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;

    // Set timer for 2 hours (matches JWT_EXPIRY)
    const timer = setTimeout(() => {
      logout();
      toast.error('Session expired after 2 hours for security reasons. Please log in again.', { duration: 6000 });
    }, 2 * 60 * 60 * 1000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, logout]);

  return null;
};

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
  
  useEffect(() => {
    if (!isAuthenticated) {
      window.location.replace('/home.html');
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;
  return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />;
};

const DemoBanner = () => (
  <div style={{ background: '#ffb84c', color: '#07071a', textAlign: 'center', padding: '10px 20px', fontWeight: 700, fontSize: '14px', position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 99999 }}>
    ⚠️ This is a student educational project, not a real bank. Do not enter real financial details.
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <DemoBanner />
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

      <StrictAutoLogout />

      <Routes>
        {/* Public routes */}
        <Route path="/login"    element={<AuthRoute><Login /></AuthRoute>} />
        <Route path="/register" element={<AuthRoute><Register /></AuthRoute>} />
        
        {/* About Us (Public standalone page) */}
        <Route path="/about" element={<AboutUs />} />

        {/* Public Information Pages — use /info/ prefix to avoid conflicts with authenticated app routes */}
        <Route path="/info/savings" element={<PublicInfoPage />} />
        <Route path="/info/current" element={<PublicInfoPage />} />
        <Route path="/info/upi"     element={<PublicInfoPage />} />
        <Route path="/info/loans"   element={<PublicInfoPage />} />
        <Route path="/info/cards"   element={<PublicInfoPage />} />
        <Route path="/info/privacy"  element={<PublicInfoPage />} />
        <Route path="/info/terms"    element={<PublicInfoPage />} />
        <Route path="/info/cookies"  element={<PublicInfoPage />} />
        <Route path="/info/security" element={<PublicInfoPage />} />
        <Route path="/info/blog"     element={<PublicInfoPage />} />
        <Route path="/info/press"    element={<PublicInfoPage />} />
        {/* Legacy redirects — keep old paths working for any bookmarks */}
        <Route path="/savings"  element={<PublicInfoPage />} />
        <Route path="/current"  element={<PublicInfoPage />} />
        <Route path="/privacy"  element={<PublicInfoPage />} />
        <Route path="/terms"    element={<PublicInfoPage />} />
        <Route path="/cookies"  element={<PublicInfoPage />} />
        <Route path="/security" element={<PublicInfoPage />} />
        <Route path="/blog"     element={<PublicInfoPage />} />
        <Route path="/press"    element={<PublicInfoPage />} />


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
