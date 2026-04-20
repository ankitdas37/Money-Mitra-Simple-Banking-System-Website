import React, { useEffect, useState, useRef } from 'react';
import { supportAPI } from '../services/api';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';

// ── Tiny helpers ────────────────────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_CFG = {
  open:        { color: '#6C63FF', bg: 'rgba(108,99,255,0.15)', label: '🟣 Open' },
  in_progress: { color: '#FFB84C', bg: 'rgba(255,184,76,0.15)', label: '🟡 In Progress' },
  resolved:    { color: '#00E5A0', bg: 'rgba(0,229,160,0.15)',  label: '🟢 Resolved' },
  closed:      { color: '#888',    bg: 'rgba(136,136,136,0.15)',label: '⚫ Closed' },
};
const PRIORITY_CFG = {
  low:    { color: '#888',    label: 'Low' },
  medium: { color: '#6C63FF', label: 'Medium' },
  high:   { color: '#FFB84C', label: '⚡ High' },
  urgent: { color: '#FF5757', label: '🚨 Urgent' },
};
const CATEGORY_LABELS = {
  account:'💳 Account', payment:'💸 Payment', kyc:'📋 KYC',
  card:'💳 Card', loan:'🏦 Loan', upi:'⚡ UPI', other:'❓ Other',
};

const FAQ_ITEMS = [
  { q: 'How do I reset my UPI PIN?', a: 'Go to UPI Pay → Your UPI ID → Settings → Reset PIN. You will need to enter your registered mobile OTP.' },
  { q: 'Why was my transaction declined?', a: 'Transactions can fail due to insufficient balance, incorrect details, or bank server issues. Check your balance and try again. If the issue persists, create a support ticket.' },
  { q: 'How long does KYC verification take?', a: 'KYC verification typically takes 1–3 business days. You will receive a notification when your KYC status is updated.' },
  { q: 'How do I freeze or block my card?', a: 'Go to Cards → Select your card → Toggle Freeze. For permanent block, use the Block Card option. Frozen cards can be unfrozen anytime.' },
  { q: 'How do I add a beneficiary for transfers?', a: 'Go to Transfer → Manage Beneficiaries → Add New. Enter the account number and IFSC code. Beneficiaries are stored for quick future transfers.' },
  { q: 'What is the daily transaction limit?', a: 'Default limits: UPI ₹1,00,000/day, NEFT ₹10,00,000/day, IMPS ₹5,00,000/day. Contact support to request limit increases based on your KYC status.' },
];

// ── Status Badge ────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.open;
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

// ── Priority Dot ────────────────────────────────────────────────────────────────
function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.medium;
  return <span style={{ color: cfg.color, fontSize: 12, fontWeight: 700 }}>{cfg.label}</span>;
}

// ── FAQ Accordion Item ──────────────────────────────────────────────────────────
function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      border: `1px solid ${open ? 'rgba(108,99,255,0.4)' : 'var(--border)'}`,
      borderRadius: 12, overflow: 'hidden', transition: 'all 0.25s',
      background: open ? 'rgba(108,99,255,0.04)' : 'transparent', marginBottom: 8
    }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 18px', color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif',
        fontWeight: 600, fontSize: 14, textAlign: 'left', gap: 12,
      }}>
        <span>{q}</span>
        <span style={{ fontSize: 18, color: 'var(--primary)', transition: 'transform 0.25s', transform: open ? 'rotate(45deg)' : 'none', flexShrink: 0 }}>+</span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 16px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{a}</div>
      )}
    </div>
  );
}

// ── Conversation Message Bubble ─────────────────────────────────────────────────
function MsgBubble({ msg }) {
  const isAdmin = msg.sender_role === 'admin';
  return (
    <div style={{ display: 'flex', flexDirection: isAdmin ? 'row' : 'row-reverse', gap: 10, marginBottom: 14, alignItems: 'flex-end' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: isAdmin ? 'var(--gradient-primary)' : 'linear-gradient(135deg,#00E5A0,#00B5CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
        {isAdmin ? '👨‍💼' : '👤'}
      </div>
      <div style={{ maxWidth: '75%' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textAlign: isAdmin ? 'left' : 'right' }}>
          {msg.sender_name} · {fmtDate(msg.created_at)}
        </div>
        <div style={{
          background: isAdmin ? 'rgba(108,99,255,0.12)' : 'rgba(0,229,160,0.1)',
          border: `1px solid ${isAdmin ? 'rgba(108,99,255,0.25)' : 'rgba(0,229,160,0.25)'}`,
          borderRadius: isAdmin ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
          padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6,
        }}>
          {msg.message}
        </div>
      </div>
    </div>
  );
}

// ══ Main Page ════════════════════════════════════════════════════════════════════
export default function HelpSupport() {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null); // full ticket with messages
  const [view, setView] = useState('home'); // 'home' | 'tickets' | 'new' | 'thread'
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const msgEndRef = useRef(null);

  // New ticket form
  const [form, setForm] = useState({ subject: '', category: 'other', priority: 'medium', message: '' });

  // Poll for ticket updates every 15s when viewing a thread
  useEffect(() => {
    fetchMyTickets();
  }, []);

  useEffect(() => {
    if (view === 'thread' && activeTicket) {
      const interval = setInterval(() => refreshThread(activeTicket.id), 15000);
      return () => clearInterval(interval);
    }
  }, [view, activeTicket]);

  useEffect(() => {
    // Auto scroll to bottom of conversation
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTicket?.messages]);

  const fetchMyTickets = async () => {
    try {
      const res = await supportAPI.getMyTickets();
      setTickets(res.data.data || []);
    } catch { /* silent */ }
  };

  const openThread = async (ticketId) => {
    setLoading(true);
    try {
      const res = await supportAPI.getTicketDetail(ticketId);
      setActiveTicket(res.data.data);
      setView('thread');
    } catch { toast.error('Failed to load ticket'); }
    finally { setLoading(false); }
  };

  const refreshThread = async (ticketId) => {
    try {
      const res = await supportAPI.getTicketDetail(ticketId);
      setActiveTicket(res.data.data);
    } catch { /* silent */ }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!form.subject || !form.message) return toast.error('Fill all required fields');
    setLoading(true);
    try {
      const res = await supportAPI.createTicket(form);
      toast.success(`Ticket ${res.data.data.ticket_number} created!`);
      setForm({ subject: '', category: 'other', priority: 'medium', message: '' });
      await fetchMyTickets();
      setView('tickets');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create ticket'); }
    finally { setLoading(false); }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setLoading(true);
    try {
      await supportAPI.addMessage(activeTicket.id, { message: replyText });
      setReplyText('');
      await refreshThread(activeTicket.id);
      await fetchMyTickets();
      toast.success('Reply sent!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send reply'); }
    finally { setLoading(false); }
  };

  const handleCloseTicket = async () => {
    if (!window.confirm('Close this ticket?')) return;
    try {
      await supportAPI.closeTicket(activeTicket.id);
      toast.success('Ticket closed');
      await fetchMyTickets();
      await refreshThread(activeTicket.id);
    } catch { toast.error('Failed to close ticket'); }
  };

  const openTicketCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;

  // ── Styles ────────────────────────────────────────────────────────────────────
  const cardS = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, transition: 'all 0.25s' };
  const inputS = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const btnPrimary = { background: 'var(--gradient-primary)', color: 'white', border: 'none', borderRadius: 10, padding: '12px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s' };
  const btnSecondary = { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s' };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(108,99,255,0.2) 0%, rgba(0,229,160,0.1) 100%)',
        border: '1px solid rgba(108,99,255,0.3)', borderRadius: 20, padding: '28px 32px',
        marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 16, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(108,99,255,0.08)', pointerEvents: 'none' }} />
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 30 }}>🎧</span>
            <span className="text-gradient">Help &amp; Support</span>
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            We&apos;re here 24/7 — create tickets, chat with support &amp; track your cases
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { id: 'home',    icon: '🏠', label: 'Home' },
            { id: 'tickets', icon: '🎫', label: `My Tickets${openTicketCount > 0 ? ` (${openTicketCount})` : ''}` },
            { id: 'new',     icon: '✏️', label: 'New Ticket' },
          ].map(t => (
            <button key={t.id} onClick={() => setView(t.id)} style={{
              ...btnSecondary,
              background: view === t.id ? 'rgba(108,99,255,0.2)' : 'rgba(0,0,0,0.3)',
              borderColor: view === t.id ? 'var(--primary)' : 'var(--border)',
              color: view === t.id ? 'white' : 'var(--text-secondary)',
              backdropFilter: 'blur(8px)',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          HOME VIEW
          ══════════════════════════════════════════════════════════ */}
      {view === 'home' && (
        <div>
          {/* Quick Contact Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
            {[
              { icon: '✉️', title: 'Email Support', sub: 'Response within 2–4 business hours', action: 'Send Email', href: 'mailto:support@moneymitra.in', color: '#00E5A0', bg: 'rgba(0,229,160,0.08)' },
              { icon: '🎫', title: 'Submit a Ticket', sub: 'Track your issue step-by-step', action: 'Create Ticket', onClick: () => setView('new'), color: '#6C63FF', bg: 'rgba(108,99,255,0.08)' },
              { icon: '📞', title: 'Call Helpdesk', sub: '1800-123-4567 · Available 24/7', action: '1800-123-4567', href: 'tel:18001234567', color: '#FFB84C', bg: 'rgba(255,184,76,0.08)' },
            ].map(card => (
              <div key={card.title} style={{ ...cardS, background: card.bg, border: `1px solid ${card.color}30`, textAlign: 'center' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{card.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{card.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.5 }}>{card.sub}</div>
                {card.href ? (
                  <a href={card.href} style={{ display: 'inline-block', ...btnPrimary, background: `linear-gradient(135deg, ${card.color}cc, ${card.color}88)`, textDecoration: 'none', fontSize: 12 }}>
                    {card.action}
                  </a>
                ) : (
                  <button onClick={card.onClick} style={{ ...btnPrimary, background: `linear-gradient(135deg, ${card.color}cc, ${card.color}88)`, fontSize: 12 }}>
                    {card.action}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* FAQ + Ticket Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* FAQ */}
            <div style={cardS}>
              <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>❓</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Frequently Asked Questions</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Quick answers to common issues</div>
                </div>
              </div>
              {FAQ_ITEMS.map((item, i) => <FAQItem key={i} {...item} />)}
            </div>

            {/* Quick Stats / Ticket Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* My Recent Tickets */}
              <div style={cardS}>
                <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>🎫 Your Recent Tickets</div>
                  <button onClick={() => setView('tickets')} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }}>View All</button>
                </div>
                {tickets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
                    No support tickets yet!
                  </div>
                ) : tickets.slice(0, 4).map(t => (
                  <div key={t.id} onClick={() => openThread(t.id)} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t.subject}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.ticket_number} · {CATEGORY_LABELS[t.category]}</div>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                ))}
              </div>

              {/* Support Info Box */}
              <div style={{ ...cardS, background: 'linear-gradient(135deg,rgba(108,99,255,0.1),rgba(0,229,160,0.06))', border: '1px solid rgba(108,99,255,0.2)' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🛡️ Support Policy</div>
                {[
                  ['🕐 Response Time', 'Within 4 hours for high-priority'],
                  ['📋 Ticket Retention', '90 days conversation history'],
                  ['🔒 Data Privacy', 'All tickets are encrypted & secure'],
                  ['🌐 Availability', '24/7 email · 9AM-9PM phone'],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MY TICKETS VIEW
          ══════════════════════════════════════════════════════════ */}
      {view === 'tickets' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>🎫 My Support Tickets</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click a ticket to view conversation</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={fetchMyTickets} style={btnSecondary}>↺ Refresh</button>
              <button onClick={() => setView('new')} style={btnPrimary}>✏️ New Ticket</button>
            </div>
          </div>

          {tickets.length === 0 ? (
            <div style={{ ...cardS, textAlign: 'center', padding: '60px 24px' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No Tickets Yet</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>Got an issue? Create your first support ticket.</div>
              <button onClick={() => setView('new')} style={btnPrimary}>✏️ Create Ticket</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tickets.map(t => (
                <div key={t.id} onClick={() => openThread(t.id)} style={{
                  ...cardS, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                  borderLeft: `4px solid ${STATUS_CFG[t.status]?.color || '#6C63FF'}`,
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = STATUS_CFG[t.status]?.color || '#6C63FF'; e.currentTarget.style.background = 'rgba(108,99,255,0.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{t.subject}</span>
                      {t.unread_admin_msgs > 0 && (
                        <span style={{ background: 'var(--primary)', color: 'white', borderRadius: 999, fontSize: 10, fontWeight: 800, padding: '2px 7px' }}>
                          {t.unread_admin_msgs} new
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span>🔖 {t.ticket_number}</span>
                      <span>{CATEGORY_LABELS[t.category]}</span>
                      <span>🕐 {fmtDate(t.updated_at)}</span>
                      <span>💬 {t.message_count} messages</span>
                    </div>
                    {t.last_message && (
                      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>
                        "{t.last_message}"
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>›</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          NEW TICKET FORM VIEW
          ══════════════════════════════════════════════════════════ */}
      {view === 'new' && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24 }}>
          <div style={cardS}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>✏️ Create Support Ticket</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Describe your issue clearly — our team will respond ASAP</div>
            </div>

            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Subject *</label>
                <input style={inputS} placeholder="Brief description of your issue" value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required maxLength={200} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Category</label>
                  <select style={{ ...inputS, background: 'var(--bg-input)' }} value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                      <option key={v} value={v} style={{ background: '#13132a' }}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Priority</label>
                  <select style={{ ...inputS, background: 'var(--bg-input)' }} value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {Object.entries(PRIORITY_CFG).map(([v, c]) => (
                      <option key={v} value={v} style={{ background: '#13132a' }}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Message *</label>
                <textarea style={{ ...inputS, minHeight: 160, resize: 'vertical', lineHeight: 1.6 }}
                  placeholder="Describe your issue in detail — include any error messages, transaction IDs, or screenshots if relevant..."
                  value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" style={{ ...btnPrimary, flex: 1 }} disabled={loading}>
                  {loading ? '⏳ Submitting...' : '🚀 Submit Ticket'}
                </button>
                <button type="button" onClick={() => setView('home')} style={btnSecondary}>Cancel</button>
              </div>
            </form>
          </div>

          {/* Tips Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...cardS, background: 'rgba(108,99,255,0.07)', border: '1px solid rgba(108,99,255,0.2)' }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>💡 Tips for faster resolution</div>
              {[
                'Include the Transaction ID or Reference Number',
                'Mention the date & time of the issue',
                'Attach screenshots if possible',
                'Use "Urgent" priority only for critical issues',
                'One ticket per issue helps us help you faster',
              ].map((tip, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--success)', flexShrink: 0 }}>✓</span> {tip}
                </div>
              ))}
            </div>

            <div style={{ ...cardS, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>⚡</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Average Response</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>~2 hrs</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>During business hours<br />Max 24hrs on weekends</div>
            </div>

            <div style={{ ...cardS, background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.2)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                📧 <strong>Email:</strong> support@moneymitra.in<br />
                📞 <strong>Phone:</strong> 1800-123-4567<br />
                🕐 <strong>Hours:</strong> 9 AM – 9 PM IST
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TICKET THREAD VIEW
          ══════════════════════════════════════════════════════════ */}
      {view === 'thread' && activeTicket && (
        <div>
          {/* Thread Header */}
          <div style={{
            ...cardS, marginBottom: 16,
            borderLeft: `4px solid ${STATUS_CFG[activeTicket.status]?.color || '#6C63FF'}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14
          }}>
            <div style={{ flex: 1 }}>
              <button onClick={() => { setView('tickets'); setActiveTicket(null); }} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12, marginBottom: 10 }}>
                ← Back to Tickets
              </button>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{activeTicket.subject}</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span>🔖 {activeTicket.ticket_number}</span>
                <span>{CATEGORY_LABELS[activeTicket.category]}</span>
                <span>🕐 Created {fmtDate(activeTicket.created_at)}</span>
                <span>💬 {activeTicket.messages?.length || 0} messages</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
              <PriorityBadge priority={activeTicket.priority} />
              <StatusBadge status={activeTicket.status} />
              {activeTicket.status !== 'closed' && (
                <button onClick={handleCloseTicket} style={{ ...btnSecondary, padding: '7px 14px', fontSize: 12, color: 'var(--error)', borderColor: 'var(--error)' }}>
                  ✖ Close Ticket
                </button>
              )}
            </div>
          </div>

          {/* Conversation Thread */}
          <div style={{ ...cardS, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>💬</span> Conversation
              <button onClick={() => refreshThread(activeTicket.id)} style={{ marginLeft: 'auto', ...btnSecondary, padding: '5px 12px', fontSize: 11 }}>↺ Refresh</button>
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
              {(activeTicket.messages || []).map(msg => <MsgBubble key={msg.id} msg={msg} />)}
              <div ref={msgEndRef} />
              {(activeTicket.messages || []).length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 13 }}>No messages yet</div>
              )}
            </div>
          </div>

          {/* Reply Box */}
          {activeTicket.status !== 'closed' ? (
            <div style={cardS}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>📝 Send a Reply</div>
              <textarea
                style={{ ...inputS, minHeight: 100, resize: 'vertical', marginBottom: 12 }}
                placeholder="Type your follow-up message here..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleReply(); }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ctrl+Enter to send quickly</div>
                <button onClick={handleReply} style={btnPrimary} disabled={loading || !replyText.trim()}>
                  {loading ? '⏳ Sending...' : '📤 Send Reply'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ ...cardS, textAlign: 'center', background: 'rgba(136,136,136,0.05)', border: '1px solid rgba(136,136,136,0.2)' }}>
              <span style={{ fontSize: 36 }}>🔒</span>
              <div style={{ fontWeight: 600, marginTop: 8, color: 'var(--text-secondary)' }}>This ticket is closed</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Create a new ticket if you need further help</div>
              <button onClick={() => setView('new')} style={{ ...btnPrimary, marginTop: 14 }}>✏️ New Ticket</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
