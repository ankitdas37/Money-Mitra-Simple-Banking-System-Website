import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore, useNotificationStore } from '../store';
import { notificationAPI } from '../services/api';
import { AVATARS } from '../utils/helpers';

// Read ?tab= from the URL
const getTabParam = (search) => new URLSearchParams(search).get('tab') || 'overview';

const userNavItems = [
  { path: '/dashboard',    icon: '🏠', label: 'Dashboard' },
  { path: '/transfer',     icon: '💸', label: 'Transfer' },
  { path: '/upi',          icon: '⚡', label: 'UPI Pay' },
  { path: '/cards',        icon: '💳', label: 'Cards' },
  { path: '/bills',        icon: '📄', label: 'Bills' },
  { path: '/loans',        icon: '🏦', label: 'Loans' },
  { path: '/transactions', icon: '📊', label: 'Transactions' },
  { path: '/support',      icon: '🎧', label: 'Help & Support' },
];

const adminNavItems = [
  { icon: '📊', label: 'Overview',     tab: 'overview' },
  { icon: '👥', label: 'Users',        tab: 'users' },
  { icon: '💸', label: 'Transactions', tab: 'transactions' },
  { icon: '🏛️', label: 'Loans',        tab: 'loans' },
  { icon: '🕐', label: 'Pending',      tab: 'pending' },
  { icon: '🎧', label: 'Support',      tab: 'support' },
  { icon: '❓', label: 'FAQ',          tab: 'faq' },
  { icon: '📢', label: 'Broadcast',    tab: 'broadcast' },
  { icon: '🗄️', label: 'Database',     tab: 'database' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { unreadCount, setNotifications } = useNotificationStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setLocalNotifications] = useState([]);

  useEffect(() => {
    // Poll notifications every 30s
    const fetchNotifications = async () => {
      try {
        const res = await notificationAPI.getAll();
        const { notifications: notifs, unread_count } = res.data.data;
        setLocalNotifications(notifs || []);
        setNotifications(notifs || [], unread_count);
      } catch {}
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try { await notificationAPI.getAll(); } catch {}
    logout();
    navigate('/login');
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setLocalNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setNotifications(notifications.map(n => ({ ...n, is_read: true })), 0);
    } catch {}
  };

  const handleClearAll = async () => {
    try {
      await notificationAPI.clearAll();
      setLocalNotifications([]);
      setNotifications([], 0);
    } catch {}
  };

  const isAdmin = user?.role === 'admin';
  const avatarEmoji = AVATARS[(user?.avatar_id || 1) - 1] || '🦊';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo" style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="/logo.png"
            alt="Money Mitra Logo"
            style={{
              width: 52, height: 52, borderRadius: 12, objectFit: 'cover',
              boxShadow: '0 4px 16px rgba(108,99,255,0.3)',
              border: '2px solid rgba(108,99,255,0.3)',
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              <span className="text-gradient">Money</span>
              <span style={{ color: 'var(--text-primary)' }}> Mitra</span>
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 1 }}>
              {isAdmin ? 'Admin Console' : 'Digital Bank'}
            </div>
          </div>
        </div>
      </div>

      {/* User Quick Info */}
      <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          background: isAdmin ? 'rgba(108,99,255,0.08)' : 'var(--bg-card)',
          border: isAdmin ? '1px solid rgba(108,99,255,0.35)' : '1px solid var(--border)',
          borderRadius: 12, padding: '12px',
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer'
        }} onClick={() => navigate(isAdmin ? '/admin' : '/profile')}>
          <div className="avatar" style={{ width: 36, height: 36, fontSize: 18 }}>
            {isAdmin ? '👑' : avatarEmoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.full_name}
            </div>
            <div style={{ fontSize: 11, color: isAdmin ? 'rgba(108,99,255,0.9)' : 'var(--text-muted)', fontWeight: isAdmin ? 700 : 400 }}>
              {isAdmin ? '⚙️ Administrator' : user?.kyc_status === 'verified' ? '✅ Verified' : '⏳ KYC Pending'}
            </div>
          </div>
          {/* Notification Bell */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowNotifications(!showNotifications); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: 4 }}
          >
            <span style={{ fontSize: 18 }}>🔔</span>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -2,
                background: 'var(--accent)', color: 'white',
                borderRadius: 999, fontSize: 10, fontWeight: 700,
                padding: '1px 5px', minWidth: 16, textAlign: 'center'
              }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>
        </div>

        {/* Notification Dropdown */}
        {showNotifications && (
          <div style={{
            position: 'absolute', left: 16, right: 16, top: 130,
            background: '#13132a', border: '1px solid var(--border)',
            borderRadius: 12, maxHeight: 340, display: 'flex', flexDirection: 'column', zIndex: 200,
            boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>🔔 Notifications</span>
              <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>No notifications
                </div>
              ) : notifications.slice(0, 8).map(n => (
                <div key={n.id} style={{
                  padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: n.is_read ? 'transparent' : 'rgba(108,99,255,0.06)'
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{n.body}</div>
                </div>
              ))}
            </div>
            {notifications.length > 0 && (
              <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={handleMarkAllRead} style={{ flex: 1, background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.25)', borderRadius: 8, padding: '7px 4px', color: 'var(--primary-light)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>✅ Mark All Read</button>
                <button onClick={handleClearAll} style={{ flex: 1, background: 'rgba(255,87,87,0.1)', border: '1px solid rgba(255,87,87,0.25)', borderRadius: 8, padding: '7px 4px', color: '#FF5757', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>🗑️ Clear All</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {isAdmin ? (
          <>
            {/* ── Admin Navigation ── */}
            <div className="nav-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚙️</span> Admin Control Panel
            </div>
            {adminNavItems.map(item => {
              const activeTab = getTabParam(location.search);
              const isActive = location.pathname === '/admin' && activeTab === item.tab;
              return (
                <button
                  key={item.tab}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => navigate(`/admin?tab=${item.tab}`)}
                  style={{ justifyContent: 'flex-start' }}
                >
                  <span className="nav-icon" style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
                  {item.label}
                </button>
              );
            })}

            <div className="nav-section-title">Account</div>
            <button className="nav-item" onClick={() => navigate('/profile')}>
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>👤</span>
              My Profile
            </button>
            <button className="nav-item" onClick={handleLogout} style={{ color: 'var(--error)' }}>
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>🚪</span>
              Logout
            </button>
          </>
        ) : (
          <>
            {/* ── User Navigation ── */}
            <div className="nav-section-title">Menu</div>
            {userNavItems.map(item => (
              <button
                key={item.path}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="nav-icon" style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}

            <div className="nav-section-title">Account</div>
            <button className={`nav-item ${location.pathname === '/profile' ? 'active' : ''}`} onClick={() => navigate('/profile')}>
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>👤</span>
              Profile
            </button>
            <button className="nav-item" onClick={handleLogout} style={{ color: 'var(--error)' }}>
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>🚪</span>
              Logout
            </button>
          </>
        )}
      </nav>

      {/* Footer */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.8 }}>
        <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11, marginBottom: 2 }}>
          Copyright © Money Mitra / 2026 · v1.0.0
        </div>
        <div>All rights reserved.</div>
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
          🎓 College Minor Project · 4th Sem · CST<br />
          Roll No: 34, 36, 37, 38, 39, 40
        </div>
      </div>
    </aside>
  );
}
