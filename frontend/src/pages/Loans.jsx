import React, { useEffect, useState } from 'react';
import { loanAPI, accountAPI } from '../services/api';
import { formatINR, formatDate, LOAN_TYPES } from '../utils/helpers';
import toast from 'react-hot-toast';

const statusColors = { applied:'badge-info', under_review:'badge-warning', approved:'badge-primary', rejected:'badge-error', disbursed:'badge-success', closed:'badge-info' };

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [showApply, setShowApply] = useState(false);
  const [form, setForm] = useState({ account_id: '', loan_type: 'personal', amount_requested: '', tenure_months: 12, purpose: '' });
  const [emiPreview, setEmiPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([loanAPI.getAll(), accountAPI.getAll()]).then(([l, a]) => {
      setLoans(l.data.data);
      const active = a.data.data.filter(acc => acc.status === 'active');
      setAccounts(active);
      if (active.length > 0) setForm(f => ({ ...f, account_id: active[0].id }));
    }).catch(() => toast.error('Failed to load loan data'));
  }, []);

  const calculateEmiPreview = () => {
    const { amount_requested, tenure_months, loan_type } = form;
    if (!amount_requested || !tenure_months) return;
    const p = parseFloat(amount_requested);
    const r = (LOAN_TYPES[loan_type]?.rate || 12.5) / (12 * 100);
    const n = parseInt(tenure_months);
    const emi = p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    setEmiPreview({ emi: Math.round(emi * 100) / 100, total: Math.round(emi * n * 100) / 100, interest: Math.round((emi * n - p) * 100) / 100 });
  };

  const handleApply = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loanAPI.apply({ ...form, amount_requested: parseFloat(form.amount_requested), tenure_months: parseInt(form.tenure_months) });
      toast.success('📋 Loan application submitted!');
      const res = await loanAPI.getAll();
      setLoans(res.data.data);
      setShowApply(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Application failed');
    } finally { setLoading(false); }
  };

  const handleViewLoan = async (id) => {
    try {
      const res = await loanAPI.getById(id);
      setSelectedLoan(res.data.data);
    } catch { toast.error('Failed to load loan details'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">🏦 Loans</h1>
          <p className="page-subtitle">Apply for loans with competitive interest rates</p>
        </div>
        <button className="btn-primary" onClick={() => setShowApply(!showApply)}>+ Apply for Loan</button>
      </div>

      {/* Loan Types Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {Object.entries(LOAN_TYPES).map(([key, type]) => (
          <div key={key} onClick={() => { setForm(f => ({ ...f, loan_type: key })); setShowApply(true); }} style={{
            background: form.loan_type === key && showApply ? 'rgba(108,99,255,0.12)' : 'var(--bg-card)',
            border: `1px solid ${form.loan_type === key && showApply ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 12, padding: '14px 10px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{type.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{type.label.split(' ')[0]}</div>
            <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 700 }}>{type.rate}% p.a.</div>
          </div>
        ))}
      </div>

      {/* Apply Form */}
      {showApply && (
        <div className="glass-card" style={{ padding: 28, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>
            {LOAN_TYPES[form.loan_type]?.icon} Apply for {LOAN_TYPES[form.loan_type]?.label}
          </div>
          <form onSubmit={handleApply} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Loan Type</label>
              <select className="input-field" value={form.loan_type} onChange={e => { setForm(f => ({ ...f, loan_type: e.target.value })); setEmiPreview(null); }}
                style={{ background: 'var(--bg-input)' }}>
                {Object.entries(LOAN_TYPES).map(([k, t]) => <option key={k} value={k} style={{ background: '#1a1a3e' }}>{t.icon} {t.label} — {t.rate}% p.a.</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Link Account</label>
              <select className="input-field" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} style={{ background: 'var(--bg-input)' }}>
                {accounts.map(acc => <option key={acc.id} value={acc.id} style={{ background: '#1a1a3e' }}>···{acc.account_number.slice(-4)} ({formatINR(acc.balance)})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Loan Amount (₹)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>₹</span>
                <input type="number" className="input-field" placeholder="e.g. 200000" style={{ paddingLeft: 28 }} required
                  min="10000" max={LOAN_TYPES[form.loan_type]?.maxAmount}
                  value={form.amount_requested} onChange={e => { setForm(f => ({ ...f, amount_requested: e.target.value })); setEmiPreview(null); }}
                />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Max: {formatINR(LOAN_TYPES[form.loan_type]?.maxAmount)}</p>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Tenure: <strong>{form.tenure_months} months</strong></label>
              <input type="range" min="6" max="360" step="6" value={form.tenure_months}
                onChange={e => { setForm(f => ({ ...f, tenure_months: e.target.value })); setEmiPreview(null); }}
                style={{ width: '100%', accentColor: 'var(--primary)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                <span>6 mo</span><span>{Math.round(form.tenure_months / 12 * 10) / 10} years</span><span>360 mo</span>
              </div>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Purpose / Remarks</label>
              <textarea className="input-field" rows={2} placeholder="Briefly describe the purpose of this loan..."
                value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                style={{ resize: 'vertical' }} />
            </div>

            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 12 }}>
              <button type="button" className="btn-secondary" onClick={calculateEmiPreview}>📊 Calculate EMI</button>
              <button type="submit" className="btn-primary" disabled={loading || !form.amount_requested}>
                {loading ? 'Submitting...' : '🏦 Submit Application'}
              </button>
            </div>
          </form>

          {/* EMI Preview */}
          {emiPreview && (
            <div style={{ marginTop: 20, background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--primary-light)' }}>📊 EMI Calculation Preview</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  ['Monthly EMI', formatINR(emiPreview.emi)],
                  ['Principal', formatINR(form.amount_requested)],
                  ['Total Interest', formatINR(emiPreview.interest)],
                  ['Total Payable', formatINR(emiPreview.total)],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{l}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Existing Loans */}
      <div style={{ display: 'grid', gap: 12 }}>
        {loans.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">🏦</div><p>No loan applications yet</p></div>
        ) : loans.map(loan => (
          <div key={loan.id} className="glass-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(108,99,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                  {LOAN_TYPES[loan.loan_type]?.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{LOAN_TYPES[loan.loan_type]?.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Applied on {formatDate(loan.applied_at)}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{formatINR(loan.amount_requested)}</div>
                <span className={`badge ${statusColors[loan.status] || 'badge-info'}`}>{loan.status.replace('_', ' ')}</span>
              </div>
            </div>
            {loan.emi_amount && (
              <div style={{ marginTop: 14, display: 'flex', gap: 16, background: 'var(--bg-input)', borderRadius: 10, padding: '10px 14px' }}>
                {[['EMI', formatINR(loan.emi_amount)], ['Rate', `${loan.interest_rate}% p.a.`], ['Tenure', `${loan.tenure_months} months`]].map(([l, v]) => (
                  <div key={l}><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l}</div><div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div></div>
                ))}
                <button className="btn-secondary" style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 12 }} onClick={() => handleViewLoan(loan.id)}>View Details</button>
              </div>
            )}
            {loan.admin_remarks && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-input)', borderRadius: 8, padding: '8px 12px' }}>💬 Remark: {loan.admin_remarks}</div>}
          </div>
        ))}
      </div>

      {/* Loan Detail Modal */}
      {selectedLoan && (
        <div className="modal-overlay" onClick={() => setSelectedLoan(null)}>
          <div className="modal-content" style={{ maxWidth: 560, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 18 }}>
                {LOAN_TYPES[selectedLoan.loan_type]?.icon} Loan Details
              </h3>
              <button onClick={() => setSelectedLoan(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {selectedLoan.emi_schedule?.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>📅 EMI Schedule</div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {selectedLoan.emi_schedule.map(emi => (
                    <div key={emi.installment} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>EMI #{emi.installment}</span>
                      <span>{formatDate(emi.due_date)}</span>
                      <span style={{ fontWeight: 600 }}>{formatINR(emi.amount)}</span>
                      <span className={`badge ${emi.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>{emi.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
