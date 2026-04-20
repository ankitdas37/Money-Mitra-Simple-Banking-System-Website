import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountAPI, transactionAPI } from '../services/api';
import { useAuthStore } from '../store';
import { formatINR, formatDateTime, TXN_STYLES, AVATARS } from '../utils/helpers';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';

const COLORS = ['#6C63FF', '#FF6B9D', '#00E5A0', '#FFB84C', '#5BC8FB', '#FF5757'];

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [recentTxns, setRecentTxns] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sumRes, accRes, txnRes, anaRes] = await Promise.all([
          accountAPI.getSummary(),
          accountAPI.getAll(),
          transactionAPI.getAll({ limit: 5 }),
          transactionAPI.getAnalytics()
        ]);
        setSummary(sumRes.data.data);
        setAccounts(accRes.data.data);
        setRecentTxns(txnRes.data.data || []);
        setAnalytics(anaRes.data.data);
      } catch (err) {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const avatar = AVATARS[(user?.avatar_id || 1) - 1];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <div className="spinner" style={{ width: 48, height: 48, borderWidth: 4 }} />
      <p style={{ color: 'var(--text-muted)' }}>Loading your dashboard...</p>
    </div>
  );

  const monthlyChartData = analytics?.monthly?.map(m => ({
    month: m.month?.slice(-2) ? new Date(m.month + '-01').toLocaleString('en-IN', { month: 'short' }) : m.month,
    income: parseFloat(m.income || 0),
    expenses: parseFloat(m.expenses || 0)
  })) || [];

  const categoryData = analytics?.categories?.slice(0, 5) || [];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>{greeting} 👋</div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>
            <span style={{ fontSize: 24 }}>{avatar}</span>{' '}
            <span className="text-gradient">{user?.full_name}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            {user?.kyc_status === 'verified' ? '✅ KYC Verified' : '⏳ KYC Pending'} · {accounts.length} Account{accounts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/transfer')} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          💸 Send Money
        </button>
      </div>

      {/* Balance Card */}
      <div className="balance-card" style={{ marginBottom: 24 }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>Total Net Worth</div>
          <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 4, letterSpacing: '-1px' }}>
            {formatINR(summary?.total_balance || 0)}
          </div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Across {summary?.account_count || 0} account{summary?.account_count !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 20 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 2 }}>↑ This Month Credited</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {formatINR(summary?.this_month?.total_credits || 0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 2 }}>↓ This Month Spent</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {formatINR(summary?.this_month?.total_debits || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { icon: '💸', label: 'Transfer', path: '/transfer' },
          { icon: '⚡', label: 'UPI Pay', path: '/upi' },
          { icon: '📄', label: 'Pay Bills', path: '/bills' },
          { icon: '💳', label: 'Cards', path: '/cards' },
          { icon: '🏦', label: 'Loans', path: '/loans' },
        ].map(action => (
          <button key={action.label} onClick={() => navigate(action.path)} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '16px 8px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            transition: 'all 0.2s', color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif'
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(108,99,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(108,99,255,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
          >
            <span style={{ fontSize: 28 }}>{action.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Charts + Accounts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 24 }}>
        {/* Area Chart */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Income vs Expenses</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last 6 months overview</div>
          </div>
          {monthlyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyChartData}>
                <defs>
                  <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E5A0" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00E5A0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 12 }} />
                <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 12 }} tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'K' : v}`} />
                <Tooltip
                  contentStyle={{ background: '#1a1a3e', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 8, fontSize: 13 }}
                  formatter={(val) => [formatINR(val)]}
                />
                <Area type="monotone" dataKey="income" stroke="#00E5A0" fill="url(#income)" strokeWidth={2} name="Income" />
                <Area type="monotone" dataKey="expenses" stroke="#6C63FF" fill="url(#expenses)" strokeWidth={2} name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><div className="empty-state-icon">📊</div><p>No chart data yet</p></div>
          )}
        </div>

        {/* Accounts */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>My Accounts</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {accounts.map(acc => (
              <div key={acc.id} style={{
                background: 'linear-gradient(135deg, rgba(108,99,255,0.08) 0%, rgba(255,107,157,0.05) 100%)',
                borderRadius: 14, padding: '16px',
                border: '1px solid rgba(108,99,255,0.2)',
                position: 'relative', overflow: 'hidden'
              }}>
                {/* Account type + status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-light)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    🏦 {acc.account_type} Account
                  </span>
                  <span className={`badge ${acc.status === 'active' ? 'badge-success' : 'badge-error'}`}>{acc.status}</span>
                </div>

                {/* Balance */}
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.5px' }}>
                  {formatINR(acc.balance)}
                </div>

                {/* Account Number with copy */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Account Number
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 1.5 }}>
                      {acc.account_number.replace(/(\d{4})/g, '$1 ').trim()}
                    </span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(acc.account_number); toast.success('Account number copied!'); }}
                      title="Copy account number"
                      style={{
                        background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.25)',
                        borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11,
                        color: 'var(--primary-light)', fontFamily: 'Outfit, sans-serif', fontWeight: 600,
                        transition: 'all 0.18s', whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(108,99,255,0.25)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(108,99,255,0.12)'}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>

                {/* IFSC Code with copy */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      IFSC Code
                    </div>
                    <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: 'var(--success)', letterSpacing: 1 }}>
                      {acc.ifsc_code}
                    </span>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(acc.ifsc_code); toast.success('IFSC code copied!'); }}
                    title="Copy IFSC code"
                    style={{
                      background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)',
                      borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11,
                      color: 'var(--success)', fontFamily: 'Outfit, sans-serif', fontWeight: 600,
                      transition: 'all 0.18s', whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,160,0.18)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,229,160,0.08)'}
                  >
                    📋 Copy
                  </button>
                </div>

                {acc.primary_upi && (
                  <div style={{ fontSize: 11, color: 'var(--primary-light)', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    ⚡ UPI: {acc.primary_upi}
                  </div>
                )}
              </div>
            ))}
            {accounts.length === 0 && <div className="empty-state" style={{ padding: 20 }}>No accounts yet</div>}
          </div>
        </div>
      </div>

      {/* Recent Transactions + Category Pie */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        {/* Recent Txns */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Recent Transactions</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Your latest activity</div>
            </div>
            <button className="btn-secondary" onClick={() => navigate('/transactions')} style={{ fontSize: 12, padding: '8px 14px' }}>View All →</button>
          </div>
          {recentTxns.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">💸</div><p>No transactions yet</p></div>
          ) : recentTxns.map(txn => {
            const style = TXN_STYLES[txn.type] || TXN_STYLES.debit;
            const isCredit = ['credit', 'upi_receive', 'loan_credit', 'refund'].includes(txn.type);
            return (
              <div key={txn.id} className="txn-item">
                <div className="txn-icon" style={{ background: style.bg, color: style.color, fontSize: 18 }}>{style.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {txn.description || style.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(txn.created_at)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: isCredit ? 'var(--success)' : 'var(--error)' }}>
                    {isCredit ? '+' : '-'}{formatINR(txn.amount)}
                  </div>
                  {txn.fraud_flagged && <div style={{ fontSize: 10, color: 'var(--warning)' }}>⚠️ Flagged</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Spending by Category */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Spending This Month</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>By category</div>
          {categoryData.length > 0 ? (
            <>
              <PieChart width={230} height={160}>
                <Pie data={categoryData} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} strokeWidth={2} stroke="rgba(0,0,0,0.3)">
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a3e', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 8, fontSize: 12 }} formatter={v => formatINR(v)} />
              </PieChart>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {categoryData.map((c, i) => (
                  <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                      <span style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{c.category}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{formatINR(c.total)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="empty-state-icon">🥧</div>
              <p style={{ fontSize: 13 }}>No spending data this month</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
