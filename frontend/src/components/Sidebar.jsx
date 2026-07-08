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
  { path: '/about',        icon: '👨‍💻', label: 'About Us' },
];

const adminNavItems = [
  { icon: '📊', label: 'Overview',     tab: 'overview' },
  { icon: '👥', label: 'Users',        tab: 'users' },
  { icon: '💸', label: 'Transactions', tab: 'transactions' },
  { icon: '🏛️', label: 'Loans',        tab: 'loans' },
  { icon: '🕐', label: 'Pending',      tab: 'pending' },
  { icon: '⛔', label: 'Closures',     tab: 'closures' },
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    // Poll notifications every 30s
    const fetchNotifications = async () => {
      try {
        const res = await notificationAPI.getAll();
        const { notifications: notifs, unread_count } = res.data.data;
        setLocalNotifications(notifs || []);
        setNotifications(notifs || [], unread_count);
      } catch { /* empty */ }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try { await notificationAPI.getAll(); } catch { /* empty */ }
    logout();
    navigate('/login');
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setLocalNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setNotifications(notifications.map(n => ({ ...n, is_read: true })), 0);
    } catch { /* empty */ }
  };

  const handleClearAll = async () => {
    try {
      await notificationAPI.clearAll();
      setLocalNotifications([]);
      setNotifications([], 0);
    } catch { /* empty */ }
  };

  const isAdmin = user?.role === 'admin';
  const avatarEmoji = AVATARS[(user?.avatar_id || 1) - 1] || '🦊';

  const notifTypeIcon = (type) => {
    const icons = { transaction: '💸', bill: '📄', loan: '🏦', security: '🔒', info: 'ℹ️' };
    return icons[type] || '🔔';
  };

  const renderNotificationDropdown = (isMobile) => {
    if (!showNotifications) return null;
    return (
      <div style={{
        position: isMobile ? 'fixed' : 'absolute',
        left: isMobile ? 16 : 0, 
        right: isMobile ? 16 : 0,
        width: isMobile ? 'auto' : '100%',
        top: isMobile ? 85 : 'calc(100% + 10px)',
        background: 'linear-gradient(180deg, #16163a 0%, #13132a 100%)',
        border: '1px solid rgba(108,99,255,0.3)',
        borderRadius: 14,
        maxHeight: '60vh',
        display: 'flex', flexDirection: 'column',
        zIndex: 1000,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(108,99,255,0.1)',
        overflow: 'hidden',
        animation: 'dropIn 0.18s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 14px', flexShrink: 0,
          background: 'rgba(108,99,255,0.08)',
          borderBottom: '1px solid rgba(108,99,255,0.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15 }}>🔔</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Notifications</span>
            {unreadCount > 0 && (
              <span style={{
                background: 'linear-gradient(135deg,#FF6B9D,#FF3A6E)',
                color: 'white', borderRadius: 999, fontSize: 10,
                fontWeight: 800, padding: '1px 7px',
              }}>{unreadCount}</span>
            )}
          </div>
          <button onClick={() => setShowNotifications(false)} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 2px',
            borderRadius: 6, transition: 'color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >×</button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
              <div style={{ fontWeight: 600 }}>You're all caught up!</div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>No new notifications</div>
            </div>
          ) : notifications.slice(0, 10).map((n, i) => (
            <div key={n.id}
              style={{
                padding: '11px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: n.is_read ? 'transparent' : 'rgba(108,99,255,0.07)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
                cursor: 'default', transition: 'background 0.15s',
                borderLeft: n.is_read ? '3px solid transparent' : '3px solid rgba(108,99,255,0.6)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(108,99,255,0.07)'}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: n.is_read ? 'rgba(255,255,255,0.06)' : 'rgba(108,99,255,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, marginTop: 1,
              }}>
                {notifTypeIcon(n.type)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 12, fontWeight: n.is_read ? 500 : 700,
                  marginBottom: 2, color: n.is_read ? 'var(--text-secondary)' : 'var(--text-primary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{n.title}</div>
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{n.body}</div>
              </div>
              {!n.is_read && (
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg,#6C63FF,#FF6B9D)',
                  marginTop: 4, boxShadow: '0 0 6px rgba(108,99,255,0.6)',
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        {notifications.length > 0 && (
          <div style={{
            padding: '10px 12px', borderTop: '1px solid rgba(108,99,255,0.15)',
            display: 'flex', gap: 8, flexShrink: 0,
            background: 'rgba(0,0,0,0.2)',
          }}>
            <button onClick={handleMarkAllRead} style={{
              flex: 1, background: 'rgba(108,99,255,0.15)',
              border: '1px solid rgba(108,99,255,0.3)', borderRadius: 9,
              padding: '8px 6px', color: '#a99fff',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(108,99,255,0.3)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(108,99,255,0.15)'; e.currentTarget.style.color = '#a99fff'; }}
            >✅ Mark All Read</button>
            <button onClick={handleClearAll} style={{
              flex: 1, background: 'rgba(255,87,87,0.1)',
              border: '1px solid rgba(255,87,87,0.25)', borderRadius: 9,
              padding: '8px 6px', color: '#FF5757',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,87,87,0.25)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,87,87,0.1)'; e.currentTarget.style.color = '#FF5757'; }}
            >🗑️ Clear All</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* ── Mobile Top Bar ── */}
      <div className="mobile-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="Logo" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.5px' }}>
            <span className="text-gradient">Money</span> <span style={{ color: 'var(--text-primary)' }}>Mitra</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNotifications(!showNotifications)} style={{ background: 'none', border: 'none', position: 'relative', fontSize: 20 }}>
              🔔
              {unreadCount > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--accent)', color: 'white', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 5px', minWidth: 16, textAlign: 'center' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {renderNotificationDropdown(true)}
            {/* Click-outside backdrop for mobile */}
            {showNotifications && (
              <div
                onClick={() => setShowNotifications(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 999 }}
              />
            )}
          </div>
          {!isAdmin && (
            <button onClick={() => setIsMobileOpen(true)} style={{ background: 'none', border: 'none', fontSize: 24, color: 'white' }}>
              <i className="fa-solid fa-bars"></i>
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setIsMobileOpen(true)} style={{ background: 'none', border: 'none', fontSize: 24, color: 'white' }}>
              ☰
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile Overlay ── */}
      {isMobileOpen && (
        <div className="mobile-overlay" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* ── Mobile Bottom Nav (User Only) ── */}
      {!isAdmin && (
        <nav className="mobile-bottom-nav">
          {userNavItems.slice(0, 4).map(item => (
            <button key={item.path} className={`mob-nav-item ${location.pathname === item.path ? 'active' : ''}`} onClick={() => navigate(item.path)}>
              <span style={{ fontSize: 24, marginBottom: 4 }}>{item.icon}</span>
              <span style={{ fontSize: 12, fontWeight: location.pathname === item.path ? 700 : 500 }}>{item.label.split(' ')[0]}</span>
            </button>
          ))}
          <button className="mob-nav-item" onClick={() => setIsMobileOpen(true)}>
            <span style={{ fontSize: 24, marginBottom: 4 }}>☰</span>
            <span style={{ fontSize: 12, fontWeight: 500 }}>Menu</span>
          </button>
        </nav>
      )}

      {/* ── Desktop/Overlay Sidebar ── */}
      <aside className={`sidebar ${isMobileOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo" style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          {/* Mobile close button inside sidebar */}
          <button className="mobile-only-close" onClick={() => setIsMobileOpen(false)} style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 24 }}>✕</button>
        </div>

        {/* User Quick Info + Notification Bell (Desktop) */}
        <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>

            {/* Profile Card */}
            <div style={{
              flex: 1, minWidth: 0,
              background: isAdmin ? 'rgba(108,99,255,0.08)' : 'var(--bg-card)',
              border: isAdmin ? '1px solid rgba(108,99,255,0.35)' : '1px solid var(--border)',
              borderRadius: 12, padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            }} onClick={() => navigate(isAdmin ? '/admin' : '/profile')}>
              <div className="avatar" style={{ width: 36, height: 36, fontSize: 18, flexShrink: 0 }}>
                {isAdmin ? '👑' : avatarEmoji}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.full_name}
                </div>
                <div style={{ fontSize: 11, color: isAdmin ? 'rgba(108,99,255,0.9)' : 'var(--text-muted)', fontWeight: isAdmin ? 700 : 400 }}>
                  {isAdmin ? '⚙️ Administrator' : user?.kyc_status === 'verified' ? '✅ Verified' : '⏳ KYC Pending'}
                </div>
              </div>
            </div>

            {/* 🔔 Bell Icon — Desktop only */}
            <div className="hide-on-mobile" style={{ flexShrink: 0 }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                title="Notifications"
                style={{
                  position: 'relative',
                  width: 40, height: 40,
                  borderRadius: '50%',
                  border: `1px solid ${showNotifications ? 'rgba(108,99,255,0.5)' : 'var(--border)'}`,
                  background: showNotifications ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, transition: 'all 0.2s',
                  boxShadow: showNotifications ? '0 0 0 3px rgba(108,99,255,0.2)' : 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(108,99,255,0.2)'; e.currentTarget.style.borderColor = 'rgba(108,99,255,0.6)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = showNotifications ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = showNotifications ? 'rgba(108,99,255,0.5)' : 'var(--border)'; }}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    background: 'linear-gradient(135deg, #FF6B9D, #FF3A6E)',
                    color: 'white', borderRadius: 999,
                    fontSize: 10, fontWeight: 800,
                    padding: '1px 5px', minWidth: 18, textAlign: 'center',
                    border: '2px solid #0d0d1f',
                    boxShadow: '0 2px 8px rgba(255,107,157,0.6)',
                    lineHeight: '14px',
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>

          </div>

          {/* Notification Dropdown — anchored to full section width (Desktop) */}
          <div className="hide-on-mobile">
            {renderNotificationDropdown(false)}
          </div>

          {/* Click-outside backdrop */}
          {showNotifications && (
            <div
              onClick={() => setShowNotifications(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            />
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
    </>
  );
}
