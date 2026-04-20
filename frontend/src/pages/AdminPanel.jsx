import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminAPI, userAPI, supportAPI } from '../services/api';
import { formatINR, formatDate, formatDateTime } from '../utils/helpers';
import toast from 'react-hot-toast';

/* ─── tiny helpers ─────────────────────────────────────────── */
const Badge = ({ children, color = '#6C63FF' }) => (
  <span style={{ background: `${color}22`, color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
    {children}
  </span>
);
const Row = ({ label, value, mono }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, gap: 12 }}>
    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
    <span style={{ fontWeight: 600, textAlign: 'right', fontFamily: mono ? 'monospace' : 'Outfit,sans-serif', wordBreak: 'break-all' }}>{value ?? '—'}</span>
  </div>
);
const SectionTitle = ({ icon, children }) => (
  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
    <span>{icon}</span>{children}
  </div>
);
const inputSx = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 13px', color: 'var(--text-primary)', fontFamily: 'Outfit,sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const labelSx = { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 };

/* ═══ KYC Tab ═════════════════════════════════════════════ */
function KYCTab({ user, openUserDetail }) {
  const { useState: us } = React;
  const u = user;
  const [kycPan,    setKycPan]    = us(u.pending_pan    || u.pan_number    || '');
  const [kycAadhar, setKycAadhar] = us(u.pending_aadhaar || u.aadhaar_number || '');
  const [kycReason, setKycReason] = us('');
  const [kycBusy,   setKycBusy]   = us(false);
  const [showAadhar, setShowAadhar] = us(false);
  const [showExistingAadhar, setShowExistingAadhar] = us(false);

  const doKYC = async (action) => {
    if (action === 'approve' && !kycPan.trim()) { toast.error('PAN number is required to approve KYC'); return; }
    if (action === 'approve' && !kycAadhar.trim()) { toast.error('Aadhaar number is required to approve KYC'); return; }
    if (action === 'approve' && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(kycPan.trim())) { toast.error('Invalid PAN format (e.g. ABCDE1234F)'); return; }
    if (action === 'approve' && !/^\d{12}$/.test(kycAadhar.trim())) { toast.error('Aadhaar must be exactly 12 digits'); return; }
    if (action === 'reject' && !kycReason.trim()) { toast.error('Rejection reason is required'); return; }

    setKycBusy(true);
    try {
      const r = await adminAPI.manageKYC(u.id, { action, pan_number: kycPan.trim(), aadhaar_number: kycAadhar.trim(), reason: kycReason });
      toast.success(r.data.message);
      openUserDetail(u.id);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setKycBusy(false); }
  };

  const statusColor = { verified: '#00E5A0', rejected: '#FF5757', pending: '#FFB84C' }[u.kyc_status] || '#FFB84C';
  const isVerified  = u.kyc_status === 'verified';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Status Banner ── */}
      <div style={{ background:`${statusColor}12`, border:`2px solid ${statusColor}40`, borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ width:52, height:52, borderRadius:14, background:`${statusColor}20`, border:`1px solid ${statusColor}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>
          {isVerified ? '✅' : u.kyc_status === 'rejected' ? '❌' : '⏳'}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:16, color:statusColor }}>{u.kyc_status?.toUpperCase()} KYC</div>
          {u.kyc_submitted_at && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Submitted: {formatDateTime(u.kyc_submitted_at)}</div>}
          {u.kyc_verified_at  && <div style={{ fontSize:11, color:'#00E5A0', marginTop:1 }}>✅ Verified: {formatDateTime(u.kyc_verified_at)}</div>}
        </div>
        {u.risk_category && (
          <div style={{ background:'rgba(255,184,76,0.1)',border:'1px solid rgba(255,184,76,0.3)',borderRadius:10,padding:'6px 14px',textAlign:'center' }}>
            <div style={{ fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:2 }}>Risk</div>
            <div style={{ fontWeight:800,fontSize:14,color:'#FFB84C' }}>{u.risk_category?.toUpperCase()}</div>
          </div>
        )}
      </div>

      {/* ── CKYC Locked Badge (shown if already has a CKYC) ── */}
      {u.ckyc_number && (
        <div style={{ background:'linear-gradient(135deg,rgba(108,99,255,0.12),rgba(0,229,160,0.08))', border:'1px solid rgba(108,99,255,0.35)', borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ fontSize:32 }}>🔐</div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:14, color:'var(--primary-light)', marginBottom:4 }}>CKYC Number — Permanently Locked</div>
            <div style={{ fontFamily:'monospace', fontSize:20, fontWeight:900, color:'white', letterSpacing:3, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 14px', display:'inline-block' }}>
              {u.ckyc_number}
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
              🔒 Auto-generated at approval · Cannot be changed by user or admin
            </div>
          </div>
        </div>
      )}

      {/* ── Existing Verified Documents (shown when verified) ── */}
      {isVerified && (u.pan_number || u.aadhaar_number) && (
        <div className="glass-card" style={{ padding:20 }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
            <span>🔒</span> Verified KYC Documents <span style={{ fontSize:11, color:'#00E5A0', fontWeight:600 }}>— Locked</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {/* PAN Card */}
            <div style={{ background:'rgba(0,229,160,0.06)', border:'1px solid rgba(0,229,160,0.2)', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
                🪪 PAN Card Number
              </div>
              <div style={{ fontFamily:'monospace', fontSize:18, fontWeight:800, color:'#00E5A0', letterSpacing:2 }}>
                {u.pan_number || '—'}
              </div>
            </div>

            {/* Aadhaar */}
            <div style={{ background:'rgba(108,99,255,0.06)', border:'1px solid rgba(108,99,255,0.2)', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>🆔 Aadhaar Number</span>
                <button onClick={() => setShowExistingAadhar(v=>!v)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:'var(--text-muted)', lineHeight:1 }}>
                  {showExistingAadhar ? '🙈' : '👁️'}
                </button>
              </div>
              <div style={{ fontFamily:'monospace', fontSize:18, fontWeight:800, color:'#a89cff', letterSpacing:2 }}>
                {showExistingAadhar
                  ? (u.aadhaar_number || '—')
                  : (u.aadhaar_number ? `XXXX XXXX ${u.aadhaar_number.slice(-4)}` : '—')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── KYC Document Form (admin can set / update) ── */}
      <div className="glass-card" style={{ padding:20 }}>
        <div style={{ fontWeight:800, fontSize:14, marginBottom:4 }}>📋 {isVerified ? 'Update KYC Documents' : 'Set KYC Documents'}</div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:16 }}>
          {isVerified
            ? 'You can update PAN/Aadhaar and re-approve. CKYC number will not change.'
            : 'Fill in verified documents and approve to generate a locked CKYC number.'}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
          {/* PAN */}
          <div>
            <label style={labelSx}>PAN Card Number *</label>
            <input value={kycPan} onChange={e => setKycPan(e.target.value.toUpperCase())}
              style={{ ...inputSx, fontFamily:'monospace', letterSpacing:2, fontSize:15, fontWeight:700,
                borderColor: kycPan && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(kycPan) ? 'rgba(0,229,160,0.5)' : undefined }}
              placeholder="ABCDE1234F" maxLength={10} />
            <div style={{ fontSize:10, color: kycPan && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(kycPan) ? '#00E5A0' : 'var(--text-muted)', marginTop:4, display:'flex', alignItems:'center', gap:4 }}>
              {kycPan && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(kycPan) ? '✅' : '🔤'} Format: ABCDE1234F
            </div>
          </div>

          {/* Aadhaar */}
          <div>
            <label style={labelSx}>Aadhaar Number * (12 digits)</label>
            <div style={{ position:'relative' }}>
              <input value={kycAadhar} onChange={e => setKycAadhar(e.target.value.replace(/\D/g,''))}
                type={showAadhar ? 'text' : 'password'}
                style={{ ...inputSx, fontFamily:'monospace', letterSpacing:2, paddingRight:44,
                  borderColor: kycAadhar && kycAadhar.length===12 ? 'rgba(108,99,255,0.5)' : undefined }}
                placeholder="XXXXXXXXXXXX" maxLength={12} />
              <button type="button" onClick={() => setShowAadhar(v=>!v)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'var(--text-muted)', lineHeight:1 }}>
                {showAadhar ? '🙈' : '👁️'}
              </button>
            </div>
            <div style={{ fontSize:10, color: kycAadhar.length===12 ? '#a89cff' : 'var(--text-muted)', marginTop:4 }}>
              {kycAadhar.length===12 ? '✅ 12 digits' : `${kycAadhar.length}/12 digits`}
            </div>
          </div>
        </div>

        <button onClick={() => doKYC('update_docs')} disabled={kycBusy}
          style={{ background:'rgba(108,99,255,0.15)', border:'1px solid rgba(108,99,255,0.3)', borderRadius:9, padding:'9px 18px', color:'var(--primary-light)', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>
          💾 Save Documents (without approving)
        </button>
      </div>

      {/* ── Admin Decision ── */}
      <div className="glass-card" style={{ padding:20 }}>
        <div style={{ fontWeight:800, fontSize:14, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>⚖️ Admin Decision</div>

        <div style={{ marginBottom:14 }}>
          <label style={labelSx}>Rejection Reason (required when rejecting)</label>
          <textarea value={kycReason} onChange={e => setKycReason(e.target.value)}
            style={{ ...inputSx, minHeight:60, resize:'vertical' }} placeholder="Reason for rejection…" />
        </div>

        {/* CKYC preview */}
        {!u.ckyc_number && (
          <div style={{ background:'rgba(0,229,160,0.06)',border:'1px solid rgba(0,229,160,0.15)',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12,color:'var(--text-muted)',display:'flex',gap:8,alignItems:'flex-start' }}>
            <span style={{ fontSize:16 }}>🔐</span>
            <span>Approving will auto-generate a <strong style={{ color:'#00E5A0' }}>unique CKYC number</strong> that is <strong>permanently locked</strong> — neither the user nor admin can change it afterwards.</span>
          </div>
        )}
        {u.ckyc_number && (
          <div style={{ background:'rgba(255,184,76,0.06)',border:'1px solid rgba(255,184,76,0.2)',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#FFB84C',display:'flex',gap:8,alignItems:'center' }}>
            <span style={{ fontSize:16 }}>🔒</span>
            <span>CKYC <strong>{u.ckyc_number}</strong> will be preserved. Only PAN & Aadhaar will be updated.</span>
          </div>
        )}

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => doKYC('approve')} disabled={kycBusy}
            style={{ flex:1, background:'linear-gradient(135deg,#00E5A0,#00B5CC)', border:'none', borderRadius:10, padding:'13px 0', color:'white', fontWeight:800, fontSize:14, cursor:'pointer', fontFamily:'Outfit,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            {kycBusy ? <><span className="spinner" style={{ width:16, height:16, borderWidth:2, borderColor:'rgba(255,255,255,0.3)', borderTopColor:'white' }} />Processing…</> : `✅ Approve KYC${u.ckyc_number ? '' : ' & Generate CKYC'}`}
          </button>
          <button onClick={() => doKYC('reject')} disabled={kycBusy || !kycReason.trim()}
            style={{ flex:1, background:'rgba(255,87,87,0.12)', border:'1px solid rgba(255,87,87,0.3)', borderRadius:10, padding:'13px 0', color:'#FF5757', fontWeight:800, fontSize:14, cursor:'pointer', fontFamily:'Outfit,sans-serif', opacity:!kycReason.trim()?0.5:1 }}>
            ❌ Reject KYC
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ Cards Tab ═════════════════════════════════════════ */
function CardsTab({ cards, handleFreezeCard, openUserDetail, userId }) {
  const { useState: us } = React;
  const [limitModal, setLimitModal] = us(null);
  const [limitForm,  setLimitForm]  = us({ spending_limit: '', credit_limit: '', daily_atm_limit: '' });
  const [limitBusy,  setLimitBusy]  = us(false);

  const saveLimit = async (cardId) => {
    setLimitBusy(true);
    try {
      await adminAPI.updateCardLimit(cardId, limitForm);
      toast.success('Card limits updated!');
      setLimitModal(null);
      openUserDetail(userId);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLimitBusy(false); }
  };

  const deleteCard = async (cardId) => {
    if (!window.confirm('Permanently delete this card? This cannot be undone.')) return;
    try { await adminAPI.permanentDeleteCard(cardId); toast.success('Card permanently deleted!'); openUserDetail(userId); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {cards.length === 0 && (
          <div className="glass-card" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state"><div className="empty-state-icon">💳</div><p>No cards found</p></div>
          </div>
        )}
        {cards.map(c => (
          <div key={c.id} className="glass-card" style={{ padding: 20, border: `1px solid ${c.is_frozen ? 'rgba(255,87,87,0.3)' : 'rgba(108,99,255,0.2)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 800 }}>{c.card_type === 'debit' ? '💳 Debit' : '💎 Credit'} Card</span>
              <div style={{ display: 'flex', gap: 5 }}>
                <Badge color={c.is_frozen ? '#FF5757' : '#00E5A0'}>{c.is_frozen ? 'Frozen' : 'Active'}</Badge>
                <Badge color="#6C63FF">{c.card_network?.toUpperCase()}</Badge>
              </div>
            </div>
            <div style={{ background: 'linear-gradient(135deg,rgba(108,99,255,0.25),rgba(0,229,160,0.12))', borderRadius: 14, padding: '16px 18px', marginBottom: 12, fontFamily: 'monospace', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Card Number</div>
                  <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 3, color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{c.card_number_full || c.card_number_masked || '•••• •••• •••• ••••'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 2, marginBottom: 4 }}>CVV</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: 3 }}>•••</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 2, marginBottom: 3 }}>Card Holder</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: 1 }}>{c.name_on_card}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 2, marginBottom: 3 }}>Expires</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{c.expiry_month}/{c.expiry_year}</div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>🔒</span> CVV is one-way hashed for security — not recoverable by admin
            </div>
            <Row label="Linked Account" value={c.account_number} mono />
            {c.card_type === 'credit' && <Row label="Credit Limit"   value={formatINR(c.credit_limit)} />}
            {c.card_type === 'credit' && <Row label="Outstanding"    value={formatINR(c.outstanding_balance)} />}
            <Row label="Daily Spend Limit" value={formatINR(c.spending_limit)} />
            {c.daily_atm_limit > 0 && <Row label="ATM Limit" value={formatINR(c.daily_atm_limit)} />}
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              <button onClick={() => handleFreezeCard(c.id)}
                style={{ flex: 1, background: c.is_frozen ? 'rgba(0,229,160,0.12)' : 'rgba(255,87,87,0.12)', border: `1px solid ${c.is_frozen ? 'rgba(0,229,160,0.3)' : 'rgba(255,87,87,0.3)'}`, borderRadius: 8, padding: '8px 0', color: c.is_frozen ? '#00E5A0' : '#FF5757', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                {c.is_frozen ? '🔓 Unfreeze' : '🔒 Freeze'}
              </button>
              <button onClick={() => { setLimitModal(c); setLimitForm({ spending_limit: c.spending_limit || '', credit_limit: c.credit_limit || '', daily_atm_limit: c.daily_atm_limit || '' }); }}
                style={{ flex: 1, background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 8, padding: '8px 0', color: 'var(--primary-light)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                ✏️ Edit Limits
              </button>
              <button onClick={() => deleteCard(c.id)}
                style={{ background: 'rgba(255,87,87,0.08)', border: '1px solid rgba(255,87,87,0.2)', borderRadius: 8, padding: '8px 11px', color: '#FF5757', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Limit Modal */}
      {limitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setLimitModal(null)}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(108,99,255,0.35)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 420 }}>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 18 }}>✏️ Edit Card Limits — {limitModal.card_number_masked}</div>
            {[['spending_limit', 'Daily Spending Limit (₹)'], ['credit_limit', 'Credit Limit (₹)'], ['daily_atm_limit', 'Daily ATM Limit (₹)']].map(([k, lbl]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={labelSx}>{lbl}</label>
                <input type="number" value={limitForm[k]} onChange={e => setLimitForm(f => ({ ...f, [k]: e.target.value }))} style={inputSx} placeholder="0" />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setLimitModal(null)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 18px', color: 'var(--text-secondary)', fontFamily: 'Outfit,sans-serif', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => saveLimit(limitModal.id)} disabled={limitBusy} style={{ background: 'var(--gradient-primary)', border: 'none', borderRadius: 9, padding: '10px 22px', color: 'white', fontWeight: 800, fontFamily: 'Outfit,sans-serif', cursor: 'pointer' }}>
                {limitBusy ? 'Saving…' : '💾 Save Limits'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


/* ═══ EMI Calculator helper ═══════════════════════════════ */
function calcEMI(principal, annualRate, tenureMonths) {
  const p = parseFloat(principal) || 0;
  const r = (parseFloat(annualRate) || 0) / 100 / 12;
  const n = parseInt(tenureMonths) || 1;
  if (r === 0) return { emi: p / n, total: p, interest: 0 };
  const emi = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return { emi, total: emi * n, interest: emi * n - p };
}

/* ═══ LoansTab (inside user detail) ════════════════════════ */
function LoansTab({ userId, initialLoans, setLoanModal, setLoanForm, openGiveLoanModal }) {
  const [loans, setLoans]           = React.useState(initialLoans || []);
  const [emiProcessing, setEmiPro]  = React.useState(null); // loanId being processed

  React.useEffect(() => { setLoans(initialLoans || []); }, [initialLoans]);

  const statusColor = (s) =>
    ({ applied: '#FFB84C', under_review: '#6C63FF', approved: '#00E5A0', rejected: '#FF5757', disbursed: '#00E5A0', closed: '#888' }[s] || '#888');

  const handleProcessEMI = async (loanId) => {
    if (!window.confirm('Deduct one EMI from this user\'s account now?')) return;
    setEmiPro(loanId);
    try {
      const { adminAPI } = await import('../services/api');
      const r = await adminAPI.processEMI(loanId);
      const { toast } = await import('react-hot-toast');
      toast.success(r.data.message || 'EMI processed!');
      // Refresh loans list
      setLoans(prev => prev.map(l =>
        l.id === loanId
          ? { ...l, emis_paid: r.data.data?.emis_paid ?? l.emis_paid, status: r.data.data?.loan_closed ? 'disbursed' : l.status }
          : l
      ));
    } catch (err) {
      const { toast } = await import('react-hot-toast');
      toast.error(err.response?.data?.message || 'EMI processing failed');
    } finally { setEmiPro(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>🏛️ Loan History ({loans.length})</div>
        <button onClick={openGiveLoanModal}
          style={{ background: 'var(--gradient-primary)', border: 'none', borderRadius: 10, padding: '9px 18px', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
          ➕ Give Loan to User
        </button>
      </div>

      {loans.length === 0 && (
        <div className="glass-card">
          <div className="empty-state"><div className="empty-state-icon">🏛️</div><p>No loan applications found</p></div>
        </div>
      )}

      {loans.map(loan => {
        const isPending  = ['applied', 'under_review'].includes(loan.status);
        const isActive   = loan.status === 'approved';
        const sc         = statusColor(loan.status);
        const emisPaid   = loan.emis_paid || 0;
        const totalEmis  = loan.tenure_months || 0;
        const pct        = totalEmis > 0 ? Math.min(100, (emisPaid / totalEmis) * 100) : 0;
        return (
          <div key={loan.id} className="glass-card" style={{ padding: '18px 22px', border: `1px solid ${isPending ? 'rgba(255,184,76,0.3)' : isActive ? 'rgba(0,229,160,0.2)' : 'var(--border)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>🏛️ {loan.loan_type?.toUpperCase()} Loan</span>
                  <span style={{ background: `${sc}22`, color: sc, padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                    {loan.status?.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '4px 16px', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  <div>💰 Requested: <strong style={{ color: 'var(--text-primary)' }}>{formatINR(loan.amount_requested)}</strong></div>
                  {loan.amount_approved && <div>✅ Approved: <strong style={{ color: '#00E5A0' }}>{formatINR(loan.amount_approved)}</strong></div>}
                  <div>📅 EMI: <strong>{formatINR(loan.emi_amount)}/mo</strong></div>
                  <div>⏱ Tenure: <strong>{loan.tenure_months} months</strong></div>
                  <div>📊 Rate: <strong>{loan.interest_rate}% p.a.</strong></div>
                  <div>📆 Applied: <strong>{formatDate(loan.applied_at)}</strong></div>
                  {loan.next_emi_date && <div>🗓 Next EMI: <strong>{formatDate(loan.next_emi_date)}</strong></div>}
                  {emisPaid > 0 && <div>✅ EMIs Paid: <strong>{emisPaid}/{totalEmis}</strong></div>}
                </div>

                {/* EMI progress bar */}
                {(isActive || loan.status === 'disbursed') && totalEmis > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <span>Repayment Progress</span>
                      <span>{emisPaid}/{totalEmis} EMIs ({pct.toFixed(0)}%)</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#6C63FF,#00E5A0)', borderRadius: 99, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                )}

                {loan.purpose && <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 10px', marginBottom: 4 }}>💬 {loan.purpose}</div>}
                {loan.admin_remarks && <div style={{ fontSize: 12, color: loan.status === 'rejected' ? '#FF5757' : '#00E5A0', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 10px' }}>📝 Admin: {loan.admin_remarks}</div>}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                {isPending && (
                  <button onClick={() => { setLoanModal(loan); setLoanForm({ action: 'approve', amount_approved: String(loan.amount_requested), admin_remarks: '' }); }}
                    style={{ background: 'var(--gradient-primary)', border: 'none', borderRadius: 9, padding: '9px 16px', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', whiteSpace: 'nowrap' }}>
                    ⚖️ Review Loan
                  </button>
                )}
                {isActive && (
                  <button onClick={() => handleProcessEMI(loan.id)} disabled={emiProcessing === loan.id}
                    style={{ background: 'rgba(255,184,76,0.12)', border: '1px solid rgba(255,184,76,0.3)', borderRadius: 9, padding: '9px 16px', color: '#FFB84C', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', whiteSpace: 'nowrap', opacity: emiProcessing === loan.id ? 0.6 : 1 }}>
                    {emiProcessing === loan.id ? '⏳ Processing…' : '📅 Process EMI'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ BeneficiariesTab (inside user detail) ════════════════ */
function BeneficiariesTab({ userId, initialBens }) {
  const [bens, setBens]     = React.useState(initialBens || []);
  const [showAdd, setAdd]   = React.useState(false);
  const [form, setForm]     = React.useState({ nickname: '', account_number: '', bank_name: 'Money Mitra Bank', ifsc_code: 'MMIT0001001', account_holder_name: '' });
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDel]  = React.useState(null);

  React.useEffect(() => { setBens(initialBens || []); }, [initialBens]);

  const handleAdd = async () => {
    if (!form.nickname || !form.account_number || !form.ifsc_code) {
      const { toast } = await import('react-hot-toast');
      toast.error('Nickname, Account Number and IFSC are required'); return;
    }
    setSaving(true);
    try {
      const { adminAPI } = await import('../services/api');
      const { toast } = await import('react-hot-toast');
      const r = await adminAPI.addBeneficiary(userId, form);
      setBens(prev => [r.data.data, ...prev]);
      setForm({ nickname: '', account_number: '', bank_name: 'Money Mitra Bank', ifsc_code: 'MMIT0001001', account_holder_name: '' });
      setAdd(false);
      toast.success('Beneficiary added!');
    } catch (err) {
      const { toast } = await import('react-hot-toast');
      toast.error(err.response?.data?.message || 'Failed to add beneficiary');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this beneficiary from user\'s account?')) return;
    setDel(id);
    try {
      const { adminAPI } = await import('../services/api');
      const { toast } = await import('react-hot-toast');
      await adminAPI.deleteBeneficiary(id);
      setBens(prev => prev.filter(b => b.id !== id));
      toast.success('Beneficiary removed');
    } catch (err) {
      const { toast } = await import('react-hot-toast');
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setDel(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>👥 Beneficiaries ({bens.length})</div>
        <button onClick={() => setAdd(v => !v)}
          style={{ background: showAdd ? 'rgba(255,87,87,0.12)' : 'rgba(0,229,160,0.12)', border: `1px solid ${showAdd ? 'rgba(255,87,87,0.3)' : 'rgba(0,229,160,0.3)'}`, borderRadius: 9, padding: '8px 16px', color: showAdd ? '#FF5757' : '#00E5A0', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
          {showAdd ? '✕ Cancel' : '➕ Add Beneficiary'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="glass-card" style={{ padding: 22, border: '1px solid rgba(0,229,160,0.25)', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: '#00E5A0' }}>➕ Add Beneficiary for User</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {[['nickname', 'Nickname *', 'text', 'e.g. Mom, Office'],
              ['account_number', 'Account Number *', 'text', '12-18 digit account no.'],
              ['bank_name', 'Bank Name', 'text', 'Money Mitra Bank'],
              ['ifsc_code', 'IFSC Code *', 'text', 'MMIT0001001'],
              ['account_holder_name', 'Account Holder Name', 'text', 'As per bank records']
            ].map(([k, lbl, t, ph]) => (
              <div key={k}>
                <label style={labelSx}>{lbl}</label>
                <input type={t} value={form[k]} placeholder={ph}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  style={inputSx} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setAdd(false)}
              style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 18px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>Cancel</button>
            <button onClick={handleAdd} disabled={saving}
              style={{ background: 'linear-gradient(135deg,#00E5A0,#00B5CC)', border: 'none', borderRadius: 9, padding: '9px 22px', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', opacity: saving ? 0.7 : 1 }}>
              {saving ? '⏳ Saving…' : '✅ Add Beneficiary'}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {bens.length === 0 && !showAdd && (
        <div className="glass-card">
          <div className="empty-state"><div className="empty-state-icon">👥</div><p>No beneficiaries yet. Add one above!</p></div>
        </div>
      )}

      {/* Grid of beneficiary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {bens.map(b => (
          <div key={b.id} className="glass-card" style={{ padding: 18, border: `1px solid ${b.is_verified ? 'rgba(0,229,160,0.25)' : 'rgba(255,184,76,0.2)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 3 }}>👤 {b.nickname || b.beneficiary_name}</div>
                <Badge color={b.is_verified ? '#00E5A0' : '#FFB84C'}>{b.is_verified ? '✅ Verified' : '⚠️ Unverified'}</Badge>
              </div>
              <button onClick={() => handleDelete(b.id)} disabled={deleting === b.id}
                style={{ background: 'rgba(255,87,87,0.1)', border: '1px solid rgba(255,87,87,0.25)', borderRadius: 7, padding: '5px 10px', color: '#FF5757', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', opacity: deleting === b.id ? 0.5 : 1 }}>
                {deleting === b.id ? '⏳' : '🗑 Remove'}
              </button>
            </div>
            <Row label="Account No." value={b.account_number} mono />
            <Row label="Bank" value={b.bank_name || '—'} />
            <Row label="IFSC" value={b.ifsc_code || '—'} mono />
            {(b.account_holder_name || b.beneficiary_name) && <Row label="Holder Name" value={b.account_holder_name || b.beneficiary_name} />}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>Added: {formatDate(b.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
export default function AdminPanel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /* ── tab is driven by the URL ?tab= param ── */
  const tab = searchParams.get('tab') || 'overview';
  const setTab = (t) => navigate(`/admin?tab=${t}`, { replace: true });

  /* ── top-level state ── */
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [search, setSearch] = useState('');
  const [fraudOnly, setFraudOnly] = useState(false);

  /* ── support ── */
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportStats, setSupportStats] = useState(null);
  const [activeTicket, setActiveTicket] = useState(null);
  const [adminReply, setAdminReply] = useState('');
  const [supportFilter, setSupportFilter] = useState({ status: '', priority: '', category: '' });
  const [supportLoading, setSupportLoading] = useState(false);
  const msgEndRef = useRef(null);

  /* ── user detail view ── */
  const [showDetail, setShowDetail] = useState(false); // drill-down overlay
  const [detailUser, setDetailUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('profile');
  const [userTxns, setUserTxns] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnSearch, setTxnSearch] = useState('');
  const [txnTypeFilter, setTxnTypeFilter] = useState('all');
  const [txnStatusFilter, setTxnStatusFilter] = useState('all');


  /* ── edit form inside detail ── */
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const editPhotoRef = useRef();

  /* ── loan approve in detail ── */
  const [loanModal, setLoanModal] = useState(null);
  const [loanForm, setLoanForm] = useState({ action: 'approve', amount_approved: '', admin_remarks: '' });

  /* ── money modal ── */
  const [moneyModal, setMoneyModal] = useState(null);
  const [moneyForm, setMoneyForm] = useState({ type: 'credit', amount: '', reason: '' });
  const [moneyLoading, setMoneyLoading] = useState(false);
  const [moneySuccess, setMoneySuccess] = useState(null);

  /* ── FAQ ── */
  const [faqs, setFaqs] = useState([]);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', category: 'general' });
  const [faqEdit, setFaqEdit] = useState(null);
  const [faqLoading, setFaqLoading] = useState(false);

  /* ── Loans (dedicated tab) ── */
  const [allLoans, setAllLoans]         = useState([]);
  const [loanFilter, setLoanFilter]     = useState('');   // '' | applied | approved | rejected
  const [loanSearch, setLoanSearch]     = useState('');
  const [loanTabModal, setLoanTabModal] = useState(null); // loan obj being reviewed
  const [loanTabForm, setLoanTabForm]   = useState({ action: 'approve', amount_approved: '', admin_remarks: '' });
  const [loanTabLoading, setLoanTabLoading] = useState(false);
  const [loansLoading, setLoansLoading] = useState(false);

  /* ── Give Loan modal ── */
  const [giveLoanUser, setGiveLoanUser] = useState(null);
  const [giveLoanForm, setGiveLoanForm] = useState({ loan_type: 'personal', amount: '', interest_rate: '10', tenure_months: '12', purpose: '', auto_credit: true });
  const [giveLoanLoading, setGiveLoanLoading] = useState(false);

  /* ── Broadcast (admin send message) ── */
  const [broadcastUsers, setBroadcastUsers] = useState([]);
  const [broadcastForm, setBroadcastForm] = useState({ user_id: '', title: '', body: '', type: 'info', channel: 'notification' });
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastHistory, setBroadcastHistory] = useState([]);

  /* ── Database Viewer ── */
  const [dbStats, setDbStats] = useState(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbQuery, setDbQuery] = useState('');
  const [dbQueryResult, setDbQueryResult] = useState(null);
  const [dbQueryLoading, setDbQueryLoading] = useState(false);

  /* ── Reset Password modal ── */
  const [resetPwUser, setResetPwUser] = useState(null);
  const [resetPwForm, setResetPwForm] = useState({ new_password: '', confirm: '' });
  const [resetPwShow, setResetPwShow] = useState({ pw: false, confirm: false });
  const [resetPwLoading, setResetPwLoading] = useState(false);

  /* ── Create User modal ── */
  const [createUserModal, setCreateUserModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ full_name: '', email: '', phone: '', password: '', role: 'user', initial_balance: '0', account_type: 'savings', gender: '', occupation: '', annual_income: '' });
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserPwShow, setCreateUserPwShow] = useState(false);

  /* ── Admin Close User Account modal ── */
  const [adminCloseModal, setAdminCloseModal] = useState(null); // user obj
  const [adminCloseForm, setAdminCloseForm] = useState({ confirm_text: '', reason: '' });
  const [adminCloseLoading, setAdminCloseLoading] = useState(false);

  /* ─── data fetching ─────────────────────────────────────── */
  useEffect(() => {
    adminAPI.getStats().then(r => setStats(r.data.data)).catch(() => {});
    if (tab === 'users') fetchUsers();
    if (tab === 'transactions') fetchTransactions();
    if (tab === 'pending') fetchPending();
    if (tab === 'support') { fetchSupportTickets(); fetchSupportStats(); }
    if (tab === 'faq') fetchFAQs();
    if (tab === 'loans') fetchAllLoans();
    if (tab === 'broadcast') adminAPI.getUsers({ limit: 200 }).then(r => setBroadcastUsers(r.data.data || [])).catch(() => {});
    if (tab === 'database') fetchDbStats();
  }, [tab]);

  const fetchUsers = async () => {
    try { const r = await adminAPI.getUsers({ search }); setUsers(r.data.data); } catch {}
  };
  const fetchTransactions = async () => {
    try { const r = await adminAPI.getTransactions({ fraud_only: fraudOnly }); setTransactions(r.data.data); } catch {}
  };
  const fetchPending = async () => {
    try { const r = await userAPI.getPendingChanges(); setPendingChanges(r.data.data || []); } catch {}
  };
  const fetchSupportTickets = async () => {
    try { const r = await supportAPI.adminGetAllTickets(supportFilter); setSupportTickets(r.data.data || []); } catch {}
  };
  const fetchSupportStats = async () => {
    try { const r = await supportAPI.adminGetStats(); setSupportStats(r.data.data); } catch {}
  };
  const fetchFAQs = async () => {
    try { const r = await adminAPI.getFAQs(); setFaqs(r.data.data || []); } catch {}
  };
  const fetchDbStats = async () => {
    setDbLoading(true);
    try { const r = await adminAPI.getDbStats(); setDbStats(r.data.data); }
    catch { toast.error('Failed to load DB stats'); }
    finally { setDbLoading(false); }
  };
  const fetchAllLoans = async (params = {}) => {
    setLoansLoading(true);
    try {
      const r = await adminAPI.getLoans({ status: loanFilter || undefined, search: loanSearch || undefined, ...params });
      setAllLoans(r.data.data?.loans || r.data.data || []);
    } catch { toast.error('Failed to load loans'); }
    finally { setLoansLoading(false); }
  };

  /* ─── user detail ─────────────────────────────────────── */
  const openUserDetail = async (userId) => {
    setDetailLoading(true);
    setDetailUser(null);
    setShowDetail(true);   // switch to detail view
    setDetailTab('profile');
    setUserTxns([]);
    try {
      const r = await adminAPI.getUserFull(userId);
      const data = r.data.data;
      setDetailUser(data);
      setEditForm({
        full_name: data.user.full_name || '', email: data.user.email || '',
        phone: data.user.phone || '', gender: data.user.gender || '',
        date_of_birth: data.user.date_of_birth?.split('T')[0] || '',
        occupation: data.user.occupation || '', annual_income: data.user.annual_income || '',
        residential_address: data.user.residential_address || '',
        corporate_address: data.user.corporate_address || '',
        nationality: data.user.nationality || 'Indian',
        kyc_status: data.user.kyc_status || 'pending',
        is_active: data.user.is_active ? 1 : 0,
        risk_category: data.user.risk_category || 'low',
        profile_photo: data.user.profile_photo || null,
        avatar_id: data.user.avatar_id || 1,
      });
    } catch { toast.error('Failed to load user data'); }
    finally { setDetailLoading(false); }
  };

  const loadUserTxns = async (uid, silent = false) => {
    if (!silent) setTxnLoading(true);
    try {
      const r = await adminAPI.getUserTransactions(uid, { limit: 100 });
      setUserTxns(r.data.data || []);
    } catch { if (!silent) toast.error('Failed to load transactions'); }
    finally { if (!silent) setTxnLoading(false); }
  };

  // Live-refresh user transactions every 10s while the tab is open
  useEffect(() => {
    if (detailTab === 'transactions' && detailUser) {
      loadUserTxns(detailUser.user.id);
      const interval = setInterval(() => loadUserTxns(detailUser.user.id, true), 10000);
      return () => clearInterval(interval);
    }
  }, [detailTab, detailUser?.user?.id]);

  const saveProfile = async () => {
    setEditLoading(true);
    try {
      await adminAPI.updateUser(detailUser.user.id, editForm);
      toast.success('Profile updated!');
      setDetailUser(d => ({ ...d, user: { ...d.user, ...editForm } }));
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
    finally { setEditLoading(false); }
  };

  const handleToggleUser = async (id) => {
    try {
      const r = await adminAPI.toggleUser(id);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: r.data.data.is_active } : u));
      if (detailUser?.user?.id === id) setDetailUser(d => ({ ...d, user: { ...d.user, is_active: r.data.data.is_active } }));
      toast.success(r.data.message);
    } catch { toast.error('Failed'); }
  };

  const handleFreezeCard = async (cardId) => {
    try {
      const r = await adminAPI.freezeCard(cardId);
      setDetailUser(d => ({ ...d, cards: d.cards.map(c => c.id === cardId ? { ...c, is_frozen: r.data.data.is_frozen } : c) }));
      toast.success(r.data.message);
    } catch { toast.error('Failed'); }
  };

  const handleToggleUPI = async (upiId) => {
    try {
      const r = await adminAPI.toggleUPI(upiId);
      setDetailUser(d => ({ ...d, upiIds: d.upiIds.map(u => u.id === upiId ? { ...u, is_active: r.data.data.is_active } : u) }));
      toast.success(r.data.message);
    } catch { toast.error('Failed'); }
  };

  const freezeTxn = async (txnId, refund) => {
    const reason = window.prompt(refund ? 'Reason for refund/reversal:' : 'Reason for freezing:');
    if (reason === null) return;
    try {
      const r = await adminAPI.freezeTransaction(txnId, { refund, reason });
      toast.success(r.data.message);
      loadUserTxns(detailUser.user.id);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  /* ─── money modal ─────────────────────────────────────── */
  const openMoneyModal = (user) => {
    setMoneyModal(user);
    setMoneyForm({ type: 'credit', amount: '', reason: '' });
    setMoneySuccess(null);
  };

  const handleMoneyAdjust = async () => {
    if (!moneyForm.amount || parseFloat(moneyForm.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setMoneyLoading(true);
    try {
      const uid = moneyModal.id || moneyModal.user?.id;
      const r = await adminAPI.adjustBalance(uid, moneyForm);
      setMoneySuccess(r.data);
      toast.success(r.data.message);
      fetchUsers();
      if (detailUser) {
        const fr = await adminAPI.getUserFull(uid);
        setDetailUser(fr.data.data);
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setMoneyLoading(false); }
  };

  /* ─── loan approve (from user detail) ─────────────────────── */
  const handleApproveLoan = async () => {
    try {
      const r = await adminAPI.approveLoan(loanModal.id, loanForm);
      toast.success(r.data.message || `Loan ${loanForm.action}d!`);
      setLoanModal(null);
      if (detailUser) openUserDetail(detailUser.user.id);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  /* ─── loan approve (from loans tab) ──────────────────────────  */
  const handleLoanTabDecision = async () => {
    if (!loanTabModal) return;
    setLoanTabLoading(true);
    try {
      const r = await adminAPI.approveLoan(loanTabModal.id, {
        action: loanTabForm.action,
        amount_approved: parseFloat(loanTabForm.amount_approved) || loanTabModal.amount_requested,
        admin_remarks: loanTabForm.admin_remarks,
      });
      toast.success(r.data.message || `Loan ${loanTabForm.action}d!`);
      setLoanTabModal(null);
      fetchAllLoans();
      adminAPI.getStats().then(r => setStats(r.data.data)).catch(() => {});
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoanTabLoading(false); }
  };

  /* ─── support ────────────────────────────────────────── */
  const openAdminTicket = async (id) => {
    setSupportLoading(true);
    try { const r = await supportAPI.adminGetTicketDetail(id); setActiveTicket(r.data.data); setAdminReply(''); }
    catch { toast.error('Failed to load ticket'); }
    finally { setSupportLoading(false); }
  };
  const handleAdminReply = async () => {
    if (!adminReply.trim()) return;
    setSupportLoading(true);
    try {
      await supportAPI.adminReply(activeTicket.id, { message: adminReply });
      setAdminReply('');
      const r = await supportAPI.adminGetTicketDetail(activeTicket.id);
      setActiveTicket(r.data.data);
      await fetchSupportTickets(); await fetchSupportStats();
      toast.success('Reply sent!');
    } catch { toast.error('Failed'); }
    finally { setSupportLoading(false); }
  };
  const handleStatusChange = async (id, field, value) => {
    try {
      await supportAPI.adminUpdateStatus(id, { [field]: value });
      toast.success('Ticket updated!');
      await fetchSupportTickets(); await fetchSupportStats();
      if (activeTicket?.id === id) { const r = await supportAPI.adminGetTicketDetail(id); setActiveTicket(r.data.data); }
    } catch { toast.error('Failed'); }
  };

  /* ─── FAQ ────────────────────────────────────────────── */
  const saveFAQ = async () => {
    if (!faqForm.question || !faqForm.answer) { toast.error('Question and answer required'); return; }
    setFaqLoading(true);
    try {
      if (faqEdit) { await adminAPI.updateFAQ(faqEdit.id, faqForm); toast.success('FAQ updated!'); }
      else { await adminAPI.createFAQ(faqForm); toast.success('FAQ added!'); }
      setFaqEdit(null); setFaqForm({ question: '', answer: '', category: 'general' });
      fetchFAQs();
    } catch { toast.error('Failed to save FAQ'); }
    finally { setFaqLoading(false); }
  };
  const deleteFAQ = async (id) => {
    if (!window.confirm('Delete this FAQ?')) return;
    try { await adminAPI.deleteFAQ(id); toast.success('Deleted'); fetchFAQs(); } catch { toast.error('Failed'); }
  };

  /* ─── TABS CONFIG ─────────────────────────────────────── */

  const detailTabs = [
    ['profile', '👤 Profile'],
    ['bank', '🏦 Bank Details'],
    ['kyc', '📋 KYC'],
    ['cards', '💳 Cards'],
    ['upi', '📱 UPI'],
    ['transactions', '💸 Transactions'],
    ['beneficiaries', '👥 Beneficiaries'],
    ['bills', '🧾 Bills'],
    ['loans', '🏛️ Loans'],
    ['login', '🔐 Login Info'],
  ];

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <h1 className="page-title">⚙️ Admin Panel</h1>
        <p className="page-subtitle">Full platform control — users, transactions, loans, support & FAQ</p>
      </div>





      {/* ══════════════ OVERVIEW TAB ══════════════ */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Stats Cards */}
          {stats && (
            <div className="stats-grid">
              {[
                { icon: '👥', label: 'Total Users',   value: stats.users?.total_users || 0,             sub: `${stats.users?.active_users || 0} active`,        color: '#6C63FF' },
                { icon: '🏦', label: 'Total Balance',  value: formatINR(stats.accounts?.total_balance),  sub: `${stats.accounts?.total_accounts || 0} accounts`, color: '#00E5A0' },
                { icon: '💸', label: 'Monthly Txns',  value: stats.this_month?.total_transactions || 0,  sub: formatINR(stats.this_month?.total_volume),        color: '#FF6B9D' },
                { icon: '⚠️', label: 'Fraud Alerts',  value: stats.this_month?.fraud_count || 0,         sub: 'This month',                                     color: '#FF5757' },
                { icon: '📋', label: 'Pending Loans', value: stats.loans?.pending_loans || 0,            sub: 'Under review',                                   color: '#FFB84C' },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div className="stat-icon" style={{ background: `${s.color}18` }}><span style={{ fontSize: 24 }}>{s.icon}</span></div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{typeof s.value === 'number' ? s.value.toLocaleString('en-IN') : s.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Platform Health */}
          <div className="glass-card" style={{ padding: 24 }}>
            <SectionTitle icon="⚠️">Platform Health</SectionTitle>
            {[
              { label: 'Active Users',   value: stats?.users?.active_users || 0,                color: 'var(--success)' },
              { label: 'Monthly Volume', value: formatINR(stats?.this_month?.total_volume || 0), color: 'var(--primary)' },
              { label: 'Pending Loans',  value: stats?.loans?.pending_loans || 0,               color: 'var(--warning)' },
              { label: 'Fraud Alerts',   value: stats?.this_month?.fraud_count || 0,            color: 'var(--error)' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ fontWeight: 700, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ USERS TAB ══════════════ */}
      {tab === 'users' && !showDetail && (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="input-field" placeholder="Search by name / email / phone…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ maxWidth: 300, padding: '8px 14px' }}
              onKeyDown={e => e.key === 'Enter' && fetchUsers()} />
            <button className="btn-secondary" onClick={fetchUsers} style={{ padding: '8px 14px', fontSize: 13 }}>🔍 Search</button>
            <div style={{ marginLeft: 'auto' }}>
              <button onClick={() => { setCreateUserModal(true); setCreateUserForm({ full_name: '', email: '', phone: '', password: '', role: 'user', initial_balance: '0', account_type: 'savings', gender: '', occupation: '', annual_income: '' }); }}
                style={{ background: 'linear-gradient(135deg,#6C63FF,#00E5A0)', border: 'none', borderRadius: 10, padding: '9px 18px', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                ➕ Create User
              </button>
            </div>
          </div>
          <table className="data-table">
            <thead><tr><th>User</th><th>Contact</th><th>Account No.</th><th>KYC</th><th>Balance</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{u.full_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{u.phone}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{u.account_number || '—'}</td>
                  <td><Badge color={u.kyc_status === 'verified' ? '#00E5A0' : '#FFB84C'}>{u.kyc_status}</Badge></td>
                  <td style={{ fontWeight: 700, fontSize: 13 }}>{formatINR(u.total_balance)}</td>
                  <td style={{ fontSize: 12 }}>{formatDate(u.created_at)}</td>
                  <td><Badge color={u.is_active ? '#00E5A0' : '#FF5757'}>{u.is_active ? 'Active' : 'Suspended'}</Badge></td>
                  <td>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      <button onClick={() => openUserDetail(u.id)}
                        style={{ background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 7, padding: '5px 9px', color: 'var(--primary-light)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                        👁 View
                      </button>
                      <button onClick={() => openMoneyModal(u)}
                        style={{ background: 'rgba(0,229,160,0.12)', border: '1px solid rgba(0,229,160,0.3)', borderRadius: 7, padding: '5px 9px', color: '#00E5A0', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                        💰 Money
                      </button>
                      <button onClick={() => handleToggleUser(u.id)}
                        style={{ background: u.is_active ? 'rgba(255,87,87,0.1)' : 'rgba(0,229,160,0.1)', border: `1px solid ${u.is_active ? 'rgba(255,87,87,0.3)' : 'rgba(0,229,160,0.3)'}`, borderRadius: 7, padding: '5px 9px', color: u.is_active ? '#FF5757' : '#00E5A0', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                        {u.is_active ? '🚫 Suspend' : '✅ Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No users found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════ USER DETAIL VIEW ══════════════ */}
      {showDetail && (
        <div>
          {/* Back button */}
          <button onClick={() => { setShowDetail(false); setDetailUser(null); }} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 16px', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            ← Back to Users
          </button>

          {detailLoading && <div className="glass-card" style={{ textAlign: 'center', padding: 60 }}><div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div><div>Loading user data…</div></div>}

          {detailUser && !detailLoading && (
            <>
              {/* User header card */}
              <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(108,99,255,0.5)', flexShrink: 0 }}>
                  {detailUser.user.profile_photo
                    ? <img src={detailUser.user.profile_photo} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, background: 'rgba(108,99,255,0.1)' }}>👤</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{detailUser.user.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{detailUser.user.email} · {detailUser.user.phone}</div>
                  {detailUser.accounts[0] && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'monospace' }}>
                      🏦 A/C: {detailUser.accounts[0].account_number}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <Badge color={detailUser.user.kyc_status === 'verified' ? '#00E5A0' : '#FFB84C'}>{detailUser.user.kyc_status?.toUpperCase()}</Badge>
                    <Badge color={detailUser.user.is_active ? '#00E5A0' : '#FF5757'}>{detailUser.user.is_active ? 'Active' : 'Suspended'}</Badge>
                    {detailUser.accounts[0] && <Badge color="#6C63FF">{formatINR(detailUser.accounts[0].balance)}</Badge>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openMoneyModal({ id: detailUser.user.id, ...detailUser.user, balance: detailUser.accounts[0]?.balance, account_number: detailUser.accounts[0]?.account_number })}
                    style={{ background: 'rgba(0,229,160,0.12)', border: '1px solid rgba(0,229,160,0.3)', borderRadius: 9, padding: '9px 14px', color: '#00E5A0', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                    💰 Adjust Balance
                  </button>
                  <button onClick={() => { setResetPwUser({ id: detailUser.user.id, full_name: detailUser.user.full_name }); setResetPwForm({ new_password: '', confirm: '' }); setResetPwShow({ pw: false, confirm: false }); }}
                    style={{ background: 'rgba(255,184,76,0.12)', border: '1px solid rgba(255,184,76,0.3)', borderRadius: 9, padding: '9px 14px', color: '#FFB84C', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                    🔑 Reset Password
                  </button>
                  <button onClick={() => handleToggleUser(detailUser.user.id)}
                    style={{ background: detailUser.user.is_active ? 'rgba(255,87,87,0.1)' : 'rgba(0,229,160,0.1)', border: `1px solid ${detailUser.user.is_active ? 'rgba(255,87,87,0.3)' : 'rgba(0,229,160,0.3)'}`, borderRadius: 9, padding: '9px 14px', color: detailUser.user.is_active ? '#FF5757' : '#00E5A0', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                    {detailUser.user.is_active ? '🚫 Suspend' : '✅ Activate'}
                  </button>
                  {detailUser.user.is_active && (
                    <button onClick={() => { setAdminCloseModal({ id: detailUser.user.id, full_name: detailUser.user.full_name, email: detailUser.user.email }); setAdminCloseForm({ confirm_text: '', reason: '' }); }}
                      style={{ background: 'rgba(255,87,87,0.12)', border: '1px solid rgba(255,87,87,0.35)', borderRadius: 9, padding: '9px 14px', color: '#FF5757', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                      ⛔ Close Account
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {detailTabs.map(([t, label]) => (
                  <button key={t} onClick={() => setDetailTab(t)} style={{
                    padding: '8px 14px', borderRadius: 9, border: detailTab === t ? 'none' : '1px solid var(--border)',
                    background: detailTab === t ? 'var(--gradient-primary)' : 'var(--bg-card)',
                    color: detailTab === t ? 'white' : 'var(--text-secondary)', fontWeight: 600, fontSize: 12,
                    fontFamily: 'Outfit, sans-serif', cursor: 'pointer', transition: 'all 0.2s',
                  }}>{label}</button>
                ))}
              </div>

              {/* ── PROFILE sub-tab ── */}
              {detailTab === 'profile' && (
                <div className="glass-card" style={{ padding: 24 }}>
                  <SectionTitle icon="👤">Personal Information</SectionTitle>
                  <input ref={editPhotoRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files[0]; if (!f) return; if (f.size > 3 * 1024 * 1024) { toast.error('Max 3MB'); return; } const r = new FileReader(); r.onload = () => setEditForm(p => ({ ...p, profile_photo: r.result })); r.readAsDataURL(f); }} />

                  <div style={{ display: 'flex', gap: 20, marginBottom: 20, alignItems: 'flex-start' }}>
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(108,99,255,0.5)', margin: '0 auto 8px' }}>
                        {editForm.profile_photo ? <img src={editForm.profile_photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>👤</div>}
                      </div>
                      <button type="button" onClick={() => editPhotoRef.current.click()}
                        style={{ background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: 'var(--primary-light)', fontFamily: 'Outfit,sans-serif' }}>📷 Change</button>
                    </div>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {[['full_name','Full Name','text'],['email','Email','email'],['phone','Phone','tel'],['nationality','Nationality','text'],['occupation','Occupation','text'],['annual_income','Annual Income','text']].map(([k,l,t]) => (
                        <div key={k}><label style={labelSx}>{l}</label><input type={t} value={editForm[k] || ''} onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))} style={inputSx} /></div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <div><label style={labelSx}>Gender</label>
                      <select value={editForm.gender || ''} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))} style={{ ...inputSx, cursor: 'pointer' }}>
                        <option value="">— Select —</option>
                        {[['male','Male'],['female','Female'],['transgender','Transgender'],['prefer_not_to_say','Prefer Not To Say']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div><label style={labelSx}>Date of Birth</label><input type="date" value={editForm.date_of_birth || ''} onChange={e => setEditForm(f => ({ ...f, date_of_birth: e.target.value }))} style={inputSx} /></div>
                    <div><label style={labelSx}>KYC Status</label>
                      <select value={editForm.kyc_status || 'pending'} onChange={e => setEditForm(f => ({ ...f, kyc_status: e.target.value }))} style={{ ...inputSx, cursor: 'pointer' }}>
                        <option value="pending">⏳ Pending</option><option value="verified">✅ Verified</option><option value="rejected">❌ Rejected</option>
                      </select>
                    </div>
                    <div><label style={labelSx}>Risk Category</label>
                      <select value={editForm.risk_category || 'low'} onChange={e => setEditForm(f => ({ ...f, risk_category: e.target.value }))} style={{ ...inputSx, cursor: 'pointer' }}>
                        <option value="low">🟢 Low</option><option value="medium">🟡 Medium</option><option value="high">🔴 High</option>
                      </select>
                    </div>
                    <div><label style={labelSx}>Account Status</label>
                      <select value={editForm.is_active} onChange={e => setEditForm(f => ({ ...f, is_active: parseInt(e.target.value) }))} style={{ ...inputSx, cursor: 'pointer' }}>
                        <option value={1}>✅ Active</option><option value={0}>🚫 Suspended</option>
                      </select>
                    </div>
                  </div>

                  {[['residential_address','Residential Address'],['corporate_address','Corporate Address']].map(([k,l]) => (
                    <div key={k} style={{ marginBottom: 12 }}>
                      <label style={labelSx}>{l}</label>
                      <textarea value={editForm[k] || ''} onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))} style={{ ...inputSx, minHeight: 70, resize: 'vertical', lineHeight: 1.5 }} />
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                    <button onClick={saveProfile} disabled={editLoading}
                      style={{ background: 'var(--gradient-primary)', border: 'none', borderRadius: 10, padding: '11px 24px', color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', opacity: editLoading ? 0.7 : 1 }}>
                      {editLoading ? '⏳ Saving…' : '💾 Save Profile'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── BANK DETAILS sub-tab ── */}
              {detailTab === 'bank' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {detailUser.accounts.length === 0 && <div className="glass-card"><div className="empty-state"><div className="empty-state-icon">🏦</div><p>No accounts found</p></div></div>}
                  {detailUser.accounts.map(acc => (
                    <div key={acc.id}>
                      {/* ── Premium Card Visual ── */}
                      <div style={{
                        borderRadius: 22, padding: '28px 30px', marginBottom: 16,
                        background: acc.account_type === 'savings'
                          ? 'linear-gradient(135deg,#1a1040 0%,#2d1f6e 40%,#1a3a5c 100%)'
                          : 'linear-gradient(135deg,#0a1f1a 0%,#0d3d29 40%,#1a2a10 100%)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.06)',
                        position: 'relative', overflow: 'hidden', minHeight: 200,
                      }}>
                        {/* BG decorations */}
                        <div style={{ position:'absolute',top:-70,right:-70,width:220,height:220,borderRadius:'50%',background:'rgba(255,255,255,0.04)',pointerEvents:'none' }} />
                        <div style={{ position:'absolute',bottom:-50,right:80,width:160,height:160,borderRadius:'50%',background:'rgba(255,255,255,0.03)',pointerEvents:'none' }} />
                        <div style={{ position:'absolute',inset:0,backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(255,255,255,0.015) 40px,rgba(255,255,255,0.015) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,255,255,0.015) 40px,rgba(255,255,255,0.015) 41px)',pointerEvents:'none' }} />

                        {/* Top row */}
                        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:30 }}>
                          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                            <div style={{ width:44,height:44,borderRadius:11,background:'linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06))',backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24 }}>🏦</div>
                            <div>
                              <div style={{ fontWeight:800,fontSize:16,color:'white',letterSpacing:0.3 }}>{acc.bank_name || 'Money Mitra Bank'}</div>
                              <div style={{ fontSize:10,color:'rgba(255,255,255,0.5)',letterSpacing:2,textTransform:'uppercase' }}>{acc.account_type} Account · #{acc.account_number?.slice(-4)}</div>
                            </div>
                          </div>
                          <div style={{ display:'flex',gap:8 }}>
                            <div style={{ background:acc.status==='active'?'rgba(0,229,160,0.2)':'rgba(255,87,87,0.2)',border:`1px solid ${acc.status==='active'?'rgba(0,229,160,0.5)':'rgba(255,87,87,0.5)'}`,borderRadius:20,padding:'4px 12px',fontSize:11,fontWeight:800,color:acc.status==='active'?'#00E5A0':'#FF5757',textTransform:'uppercase',letterSpacing:1 }}>
                              ● {acc.status || 'Active'}
                            </div>
                            <div style={{ background:'rgba(108,99,255,0.2)',border:'1px solid rgba(108,99,255,0.4)',borderRadius:20,padding:'4px 12px',fontSize:11,fontWeight:800,color:'#a89cff',textTransform:'uppercase',letterSpacing:1 }}>
                              {acc.account_type}
                            </div>
                          </div>
                        </div>

                        {/* Chip + Account number */}
                        <div style={{ marginBottom:24 }}>
                          <div style={{ width:38,height:28,borderRadius:5,background:'linear-gradient(135deg,#d4a843,#f0cc5e,#b8922e)',boxShadow:'inset 0 0 0 1px rgba(255,255,255,0.2)',marginBottom:14,display:'flex',alignItems:'center',justifyContent:'center' }}>
                            <div style={{ width:26,height:20,borderRadius:3,border:'1px solid rgba(0,0,0,0.2)',background:'linear-gradient(135deg,#c9972a,#e8c04e)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,padding:3 }}>
                              {[0,1,2,3].map(n=><div key={n} style={{ background:'rgba(0,0,0,0.15)',borderRadius:1 }} />)}
                            </div>
                          </div>
                          <div style={{ fontFamily:'monospace',fontSize:20,fontWeight:700,color:'white',letterSpacing:3,textShadow:'0 2px 8px rgba(0,0,0,0.5)' }}>
                            {(acc.account_number||'0000000000').replace(/(.{4})/g,'$1 ').trim()}
                          </div>
                        </div>

                        {/* Bottom stats row */}
                        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-end' }}>
                          <div>
                            <div style={{ fontSize:9,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:1.5,marginBottom:3 }}>IFSC Code</div>
                            <div style={{ fontFamily:'monospace',fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.85)',letterSpacing:1 }}>{acc.ifsc_code||'MMIT0001001'}</div>
                          </div>
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontSize:9,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:1.5,marginBottom:3 }}>Current Balance</div>
                            <div style={{ fontSize:26,fontWeight:900,color:'white',textShadow:'0 2px 16px rgba(0,229,160,0.5)',letterSpacing:-0.5 }}>
                              {formatINR(acc.balance)}
                            </div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:9,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:1.5,marginBottom:3 }}>Branch</div>
                            <div style={{ fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.8)' }}>{acc.branch||'Digital Branch'}</div>
                            <div style={{ fontSize:10,color:'rgba(255,255,255,0.4)' }}>India</div>
                          </div>
                        </div>
                      </div>

                      {/* ── Info Grid ── */}
                      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:10 }}>
                        {[
                          { icon:'🔢', label:'Account Number', value: acc.account_number, mono:true },
                          { icon:'🏷️', label:'IFSC Code',       value: acc.ifsc_code||'MMIT0001001', mono:true },
                          { icon:'🏦', label:'MICR Code',       value: '400002001', mono:true },
                          { icon:'🏢', label:'Account Type',    value: acc.account_type?.toUpperCase() },
                          { icon:'📍', label:'Branch',          value: acc.branch||'Digital Branch — India' },
                          { icon:'💰', label:'Min Balance',     value: formatINR(acc.min_balance) },
                          { icon:'📅', label:'Opened On',       value: formatDate(acc.created_at) },
                          { icon:'📈', label:'Interest Rate',   value: `${acc.interest_rate??3.5}% p.a.` },
                          { icon:'🆔', label:'Account ID',      value: acc.id?.slice(0,13)+'…', mono:true },
                        ].map(({ icon, label, value, mono }) => (
                          <div key={label}
                            style={{ background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'13px 15px',transition:'border-color 0.2s,background 0.2s',cursor:'default' }}
                            onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(108,99,255,0.4)'; e.currentTarget.style.background='rgba(108,99,255,0.06)'; }}
                            onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.background='rgba(255,255,255,0.03)'; }}>
                            <div style={{ fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:5,display:'flex',alignItems:'center',gap:4 }}>
                              <span>{icon}</span>{label}
                            </div>
                            <div style={{ fontFamily:mono?'monospace':'Outfit,sans-serif',fontSize:13,fontWeight:700,color:'var(--text-primary)',letterSpacing:mono?0.5:0 }}>
                              {value||'—'}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Admin quick balance summary */}
                      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10 }}>
                        {[
                          { label:'Balance',     value: formatINR(acc.balance),          color:'#00E5A0', icon:'💰' },
                          { label:'Min Balance', value: formatINR(acc.min_balance||1000), color:'#FFB84C', icon:'🔒' },
                          { label:'Interest',    value: `${acc.interest_rate??3.5}% p.a.`,color:'#6C63FF', icon:'📈' },
                        ].map(s=>(
                          <div key={s.label} style={{ background:`rgba(${s.color==='#00E5A0'?'0,229,160':s.color==='#FFB84C'?'255,184,76':'108,99,255'},0.08)`,border:`1px solid ${s.color}30`,borderRadius:12,padding:'14px 16px',textAlign:'center' }}>
                            <div style={{ fontSize:20,marginBottom:4 }}>{s.icon}</div>
                            <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:4 }}>{s.label}</div>
                            <div style={{ fontSize:15,fontWeight:800,color:s.color }}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}


              {/* ── KYC sub-tab ── */}
              {detailTab === 'kyc' && (
                <KYCTab key={detailUser.user.id} user={detailUser.user} openUserDetail={openUserDetail} />
              )}

              {/* ── CARDS sub-tab ── */}
              {detailTab === 'cards' && (
                <CardsTab
                  key={detailUser.user.id}
                  cards={detailUser.cards}
                  handleFreezeCard={handleFreezeCard}
                  openUserDetail={openUserDetail}
                  userId={detailUser.user.id}
                />
              )}

              {/* ── UPI sub-tab ── */}
              {detailTab === 'upi' && (
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {detailUser.upiIds.length===0 && <div className="glass-card"><div className="empty-state"><div className="empty-state-icon">📱</div><p>No UPI IDs found</p></div></div>}
                  {detailUser.upiIds.map(u => {
                    const upiPayload = encodeURIComponent(`upi://pay?pa=${u.upi_handle}&pn=${encodeURIComponent(detailUser.user.full_name)}&cu=INR`);
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${upiPayload}&bgcolor=ffffff&color=6C63FF&margin=8`;
                    return (
                      <div key={u.id} className="glass-card" style={{ padding:20, display:'flex', gap:20, alignItems:'flex-start' }}>
                        {/* Live QR Code */}
                        <div style={{ flexShrink:0, textAlign:'center' }}>
                          <div style={{ background:'white', borderRadius:12, padding:8, display:'inline-block', boxShadow:'0 4px 16px rgba(108,99,255,0.2)' }}>
                            <img src={qrUrl} alt="UPI QR" width={140} height={140} style={{ display:'block', borderRadius:6 }} loading="lazy" />
                          </div>
                          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:5 }}>Scan to Pay</div>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:800, fontSize:15, fontFamily:'monospace', marginBottom:8, color:'var(--primary-light)' }}>{u.upi_handle}</div>
                          <Row label="Linked Account" value={u.account_number} mono />
                          <Row label="Account Holder" value={detailUser.user.full_name} />
                          <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                            {u.is_primary && <Badge color="#6C63FF">⭐ Primary</Badge>}
                            <Badge color={u.is_active?'#00E5A0':'#FF5757'}>{u.is_active?'Active':'Inactive'}</Badge>
                          </div>
                          <button onClick={()=>handleToggleUPI(u.id)} style={{ marginTop:12, background:u.is_active?'rgba(255,87,87,0.12)':'rgba(0,229,160,0.12)', border:`1px solid ${u.is_active?'rgba(255,87,87,0.3)':'rgba(0,229,160,0.3)'}`, borderRadius:9, padding:'9px 18px', color:u.is_active?'#FF5757':'#00E5A0', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>
                            {u.is_active?'🚫 Deactivate UPI':'✅ Activate UPI'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── TRANSACTIONS sub-tab ── */}
              {detailTab === 'transactions' && detailUser && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>📊 Transaction History</div>
                      <span style={{ background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, color: 'var(--primary-light)' }}>{userTxns.length} total</span>
                      <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
                        Live · refreshes every 10s
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-secondary" onClick={() => loadUserTxns(detailUser.user.id)} style={{ padding: '7px 14px', fontSize: 12 }}>↺ Refresh Now</button>
                      <button onClick={() => {
                        adminAPI.exportTransactions(detailUser.user.id).then(r => {
                          const { user: u, transactions: txns } = r.data.data;
                          const rows = txns.map(t => `<tr style="border-bottom:1px solid #eee"><td style="padding:6px 10px">${t.type}</td><td style="padding:6px 10px">${t.reference_number||'—'}</td><td style="padding:6px 10px">${t.description||'—'}</td><td style="padding:6px 10px">${t.from_user||'—'} → ${t.to_user||'—'}</td><td style="padding:6px 10px;font-weight:700">₹${parseFloat(t.amount).toLocaleString('en-IN')}</td><td style="padding:6px 10px">${t.status}</td><td style="padding:6px 10px;font-size:11px">${new Date(t.created_at).toLocaleString('en-IN')}</td></tr>`).join('');
                          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transactions - ${u.full_name}</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#111}h1{color:#6C63FF}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#6C63FF;color:white;padding:8px 10px;text-align:left;font-size:12px}td{font-size:12px}</style></head><body><h1>Transaction History</h1><p>${u.full_name} · ${u.email}</p><table><thead><tr><th>Type</th><th>Reference</th><th>Description</th><th>From→To</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
                          const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.print();
                        }).catch(() => toast.error('Export failed'));
                      }} style={{ background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 9, padding: '8px 14px', color: 'var(--primary-light)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>📄 Export PDF</button>
                    </div>
                  </div>

                  {/* Summary stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {[
                      { label: 'Total Txns',   val: userTxns.length,                                                                                color: 'var(--primary-light)' },
                      { label: 'Total Credit', val: formatINR(userTxns.filter(t => t.type === 'credit').reduce((s, t) => s + parseFloat(t.amount || 0), 0)), color: '#00E5A0' },
                      { label: 'Total Debit',  val: formatINR(userTxns.filter(t => t.type !== 'credit').reduce((s, t) => s + parseFloat(t.amount || 0), 0)), color: '#FF5757' },
                      { label: 'Fraud Flags',  val: userTxns.filter(t => t.fraud_flagged).length,                                                  color: '#FFB84C' },
                    ].map(s => (
                      <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Filters */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      type="text" placeholder="Search reference, description, name..."
                      value={txnSearch} onChange={e => setTxnSearch(e.target.value)}
                      style={{ flex: 1, minWidth: 200, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: 'var(--text-primary)', fontFamily: 'Outfit,sans-serif', fontSize: 12, outline: 'none' }}
                    />
                    <select value={txnTypeFilter} onChange={e => setTxnTypeFilter(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: 'var(--text-primary)', fontFamily: 'Outfit,sans-serif', fontSize: 12, cursor: 'pointer' }}>
                      <option value="all">All Types</option>
                      <option value="transfer">Transfer (IMPS/NEFT)</option>
                      <option value="upi_send">UPI Send</option>
                      <option value="upi_receive">UPI Receive</option>
                      <option value="bill_payment">Bill Payment</option>
                      <option value="credit">Admin Credit</option>
                      <option value="debit">Admin Debit</option>
                      <option value="loan_disbursement">Loan Disbursement</option>
                      <option value="refund">Refund</option>
                    </select>
                    <select value={txnStatusFilter} onChange={e => setTxnStatusFilter(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: 'var(--text-primary)', fontFamily: 'Outfit,sans-serif', fontSize: 12, cursor: 'pointer' }}>
                      <option value="all">All Direction</option>
                      <option value="SENT">↑ Sent (Debit)</option>
                      <option value="RECEIVED">↓ Received (Credit)</option>
                      <option value="SELF">↔ Self</option>
                    </select>
                    {(txnSearch || txnTypeFilter !== 'all' || txnStatusFilter !== 'all') && (
                      <button onClick={() => { setTxnSearch(''); setTxnTypeFilter('all'); setTxnStatusFilter('all'); }}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>✕ Clear</button>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {userTxns.filter(t => {
                        const s = txnSearch.toLowerCase();
                        const matchSearch = !s || (t.reference_number||'').toLowerCase().includes(s) || (t.description||'').toLowerCase().includes(s) || (t.from_user||'').toLowerCase().includes(s) || (t.to_user||'').toLowerCase().includes(s);
                        const matchType = txnTypeFilter === 'all' || t.type === txnTypeFilter;
                        const matchDir  = txnStatusFilter === 'all' || t.direction === txnStatusFilter;
                        return matchSearch && matchType && matchDir;
                      }).length} shown
                    </span>
                  </div>

                  {/* Table */}
                  {txnLoading
                    ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>⏳ Loading transactions…</div>
                    : (
                      <div className="glass-card" style={{ overflow: 'auto' }}>
                        <table className="data-table" style={{ minWidth: 860 }}>
                          <thead>
                            <tr>
                              <th style={{ width: 110 }}>Direction</th>
                              <th style={{ width: 110 }}>Type</th>
                              <th>Reference</th>
                              <th>Description / Parties</th>
                              <th style={{ textAlign: 'right' }}>Amount</th>
                              <th style={{ textAlign: 'right' }}>Balance After</th>
                              <th>Status</th>
                              <th>Date & Time</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userTxns.filter(t => {
                              const s = txnSearch.toLowerCase();
                              const matchSearch = !s || (t.reference_number||'').toLowerCase().includes(s) || (t.description||'').toLowerCase().includes(s) || (t.from_user||'').toLowerCase().includes(s) || (t.to_user||'').toLowerCase().includes(s);
                              const matchType = txnTypeFilter === 'all' || t.type === txnTypeFilter;
                              const matchDir  = txnStatusFilter === 'all' || t.direction === txnStatusFilter;
                              return matchSearch && matchType && matchDir;
                            }).map(t => {
                              const dir     = t.direction || (t.type === 'credit' || t.type === 'refund' || t.type === 'loan_disbursement' ? 'RECEIVED' : 'SENT');
                              const isIn    = dir === 'RECEIVED';
                              const isSelf  = dir === 'SELF';
                              const canAct  = ['completed', 'pending'].includes(t.status);
                              const isDone  = ['reversed', 'frozen'].includes(t.status);

                              const typeIcon = {
                                transfer: '🏦', upi_send: '⚡', upi_receive: '⚡',
                                bill_payment: '🧾', credit: '💰', debit: '💸',
                                loan_disbursement: '🏛️', refund: '↩️',
                              }[t.type] || '💳';

                              const dirColor  = isIn ? '#00E5A0' : isSelf ? '#6C63FF' : '#FF5757';
                              const dirLabel  = isIn ? '↓ Received' : isSelf ? '↔ Self' : '↑ Sent';
                              const dirArrow  = isIn ? '+' : isSelf ? '±' : '-';

                              return (
                                <tr key={t.id} style={{ opacity: isDone ? 0.65 : 1, background: t.fraud_flagged ? 'rgba(255,87,87,0.04)' : undefined }}>
                                  {/* Direction */}
                                  <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${dirColor}18`, border: `1px solid ${dirColor}44`, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 800, color: dirColor }}>
                                        {dirLabel}
                                      </span>
                                      {t.fraud_flagged && <span style={{ fontSize: 9, fontWeight: 800, color: '#FFB84C', background: 'rgba(255,184,76,0.12)', borderRadius: 4, padding: '1px 5px' }}>⚠ FRAUD</span>}
                                    </div>
                                  </td>
                                  {/* Type */}
                                  <td>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{typeIcon} {t.type?.replace(/_/g, ' ')}</span>
                                  </td>
                                  {/* Reference */}
                                  <td style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {t.reference_number || '—'}
                                  </td>
                                  {/* Description + Parties */}
                                  <td style={{ fontSize: 11, maxWidth: 180 }}>
                                    {t.description && <div style={{ fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>}
                                    <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                                      {t.from_user || t.from_acc || '—'}
                                      {(t.to_user || t.to_acc) ? ` → ${t.to_user || t.to_acc}` : ''}
                                    </div>
                                  </td>
                                  {/* Amount */}
                                  <td style={{ textAlign: 'right', fontWeight: 800, color: dirColor, fontSize: 15, whiteSpace: 'nowrap' }}>
                                    {dirArrow}{formatINR(t.amount)}
                                  </td>
                                  {/* Balance After */}
                                  <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    {t.balance_after != null ? formatINR(t.balance_after) : '—'}
                                  </td>
                                  {/* Status */}
                                  <td>
                                    <Badge color={t.status === 'completed' ? '#00E5A0' : t.status === 'reversed' ? '#6C63FF' : t.status === 'frozen' ? '#FF5757' : t.status === 'failed' ? '#FF5757' : '#FFB84C'}>{t.status}</Badge>
                                  </td>
                                  {/* Date */}
                                  <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{formatDateTime(t.created_at)}</td>
                                  {/* Actions */}
                                  <td>
                                    {canAct && (
                                      <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={() => freezeTxn(t.id, false)} style={{ background: 'rgba(255,87,87,0.1)', border: '1px solid rgba(255,87,87,0.2)', borderRadius: 6, padding: '4px 8px', color: '#FF5757', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', whiteSpace: 'nowrap' }}>🔒 Freeze</button>
                                        {t.from_account_id && t.to_account_id && (
                                          <button onClick={() => freezeTxn(t.id, true)} style={{ background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 6, padding: '4px 8px', color: 'var(--primary-light)', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', whiteSpace: 'nowrap' }}>↩️ Refund</button>
                                        )}
                                      </div>
                                    )}
                                    {isDone && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.status}</span>}
                                  </td>
                                </tr>
                              );
                            })}
                            {userTxns.length === 0 && (
                              <tr><td colSpan="9" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No transactions found for this user</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )
                  }
                </div>
              )}



              {/* ── BENEFICIARIES sub-tab ── */}
              {detailTab === 'beneficiaries' && (
                <BeneficiariesTab
                  key={detailUser.user.id}
                  userId={detailUser.user.id}
                  initialBens={detailUser.beneficiaries}
                />
              )}

              {/* ── BILLS sub-tab ── */}
              {detailTab === 'bills' && (
                <div className="glass-card" style={{ overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead><tr><th>Biller</th><th>Category</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Paid At</th></tr></thead>
                    <tbody>
                      {detailUser.bills.map(b => (
                        <tr key={b.id}>
                          <td style={{ fontWeight: 600 }}>{b.biller_name}</td>
                          <td><Badge>{b.category}</Badge></td>
                          <td style={{ fontWeight: 700 }}>{formatINR(b.amount)}</td>
                          <td style={{ fontSize: 12 }}>{formatDate(b.due_date)}</td>
                          <td><Badge color={b.status === 'paid' ? '#00E5A0' : b.status === 'overdue' ? '#FF5757' : '#FFB84C'}>{b.status}</Badge></td>
                          <td style={{ fontSize: 12 }}>{b.paid_at ? formatDateTime(b.paid_at) : '—'}</td>
                        </tr>
                      ))}
                      {detailUser.bills.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No bills</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
              {/* ── LOANS sub-tab ── */}
              {detailTab === 'loans' && (
                <LoansTab
                  key={detailUser.user.id}
                  userId={detailUser.user.id}
                  initialLoans={detailUser.loans}
                  setLoanModal={setLoanModal}
                  setLoanForm={setLoanForm}
                  openGiveLoanModal={() => {
                    setGiveLoanUser({ id: detailUser.user.id, full_name: detailUser.user.full_name, email: detailUser.user.email });
                    setGiveLoanForm({ loan_type: 'personal', amount: '', interest_rate: '10', tenure_months: '12', purpose: '', auto_credit: true });
                  }}
                />
              )}


              {/* ── LOGIN INFO sub-tab ── */}
              {detailTab === 'login' && (
                <div className="glass-card" style={{ padding: 24 }}>
                  <SectionTitle icon="🔐">Login & Security Details</SectionTitle>
                  <Row label="User ID" value={detailUser.user.id} mono />
                  <Row label="Role" value={detailUser.user.role} />
                  <Row label="Email" value={detailUser.user.email} />
                  <Row label="Phone" value={detailUser.user.phone} />
                  <Row label="Last Login" value={formatDateTime(detailUser.user.last_login)} />
                  <Row label="Account Created" value={formatDateTime(detailUser.user.created_at)} />
                  <Row label="Last Updated" value={formatDateTime(detailUser.user.updated_at)} />
                  <Row label="Account Status" value={<Badge color={detailUser.user.is_active ? '#00E5A0' : '#FF5757'}>{detailUser.user.is_active ? 'Active' : 'Suspended'}</Badge>} />
                  <Row label="Pending Phone" value={detailUser.user.pending_phone} />
                  <Row label="Pending Email" value={detailUser.user.pending_email} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════ TRANSACTIONS TAB ══════════════ */}
      {tab === 'transactions' && (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={fraudOnly} onChange={e => { setFraudOnly(e.target.checked); setTimeout(fetchTransactions, 100); }} style={{ accentColor: 'var(--error)', width: 15, height: 15 }} />
              ⚠️ Fraud Flagged Only
            </label>
            <button className="btn-secondary" onClick={fetchTransactions} style={{ padding: '7px 14px', fontSize: 12, marginLeft: 'auto' }}>↺ Refresh</button>
          </div>
          <table className="data-table">
            <thead><tr><th>Type</th><th>Description</th><th>From → To</th><th>Amount</th><th>Date</th><th>Flag</th></tr></thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td><Badge>{t.type}</Badge></td>
                  <td style={{ fontSize: 12 }}>{t.description || '—'}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.from_user || '—'} → {t.to_user || '—'}</td>
                  <td style={{ fontWeight: 700 }}>{formatINR(t.amount)}</td>
                  <td style={{ fontSize: 12 }}>{formatDateTime(t.created_at)}</td>
                  <td>{t.fraud_flagged ? <Badge color="#FF5757">⚠️ Fraud</Badge> : <Badge color="#00E5A0">✅ Clean</Badge>}</td>
                </tr>
              ))}
              {transactions.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No transactions</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════ LOANS TAB ══════════════ */}
      {tab === 'loans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Header + Search + Filters ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input
              className="input-field"
              placeholder="🔍 Search by name, email or loan type…"
              value={loanSearch}
              onChange={e => setLoanSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchAllLoans()}
              style={{ maxWidth: 300, padding: '8px 14px', fontSize: 13 }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['', 'All'], ['applied', '⏳ Pending'], ['under_review', '🔍 Under Review'], ['approved', '✅ Approved'], ['rejected', '❌ Rejected'], ['disbursed', '💰 Disbursed']].map(([v, l]) => (
                <button key={v} onClick={() => { setLoanFilter(v); fetchAllLoans({ status: v || undefined, search: loanSearch || undefined }); }} style={{
                  padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 12, transition: 'all 0.2s',
                  background: loanFilter === v ? 'var(--gradient-primary)' : 'var(--bg-card)',
                  color: loanFilter === v ? 'white' : 'var(--text-secondary)',
                  boxShadow: loanFilter === v ? '0 2px 12px rgba(108,99,255,0.3)' : 'none',
                  border: loanFilter === v ? 'none' : '1px solid var(--border)',
                }}>{l}</button>
              ))}
            </div>
            <button className="btn-secondary" onClick={() => fetchAllLoans()} style={{ padding: '8px 14px', fontSize: 12, marginLeft: 'auto' }}>
              ↺ Refresh
            </button>
          </div>

          {/* ── Stats Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { label: 'Pending',    count: allLoans.filter(l => ['applied','under_review'].includes(l.status)).length, color: '#FFB84C' },
              { label: 'Approved',   count: allLoans.filter(l => l.status === 'approved').length,   color: '#00E5A0' },
              { label: 'Rejected',   count: allLoans.filter(l => l.status === 'rejected').length,   color: '#FF5757' },
              { label: 'Total',      count: allLoans.length,                                         color: '#6C63FF' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Loan Cards ── */}
          {loansLoading ? (
            <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /><div style={{ marginTop: 12, color: 'var(--text-muted)' }}>Loading loans…</div></div>
          ) : allLoans.length === 0 ? (
            <div className="glass-card"><div className="empty-state"><div className="empty-state-icon">🏛️</div><p>No loan applications found</p></div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {allLoans.map(loan => {
                const isPending = ['applied', 'under_review'].includes(loan.status);
                const statusColor = { applied: '#FFB84C', under_review: '#6C63FF', approved: '#00E5A0', rejected: '#FF5757', disbursed: '#00E5A0' }[loan.status] || '#888';
                return (
                  <div key={loan.id} style={{
                    background: 'var(--bg-card)', border: `1px solid ${isPending ? 'rgba(255,184,76,0.3)' : 'var(--border)'}`,
                    borderRadius: 14, padding: '18px 22px',
                    boxShadow: isPending ? '0 0 12px rgba(255,184,76,0.08)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>

                      {/* Applicant avatar */}
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(108,99,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                        🏛️
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 800, fontSize: 15 }}>{loan.full_name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{loan.email}</span>
                          <span style={{ background: `${statusColor}22`, color: statusColor, padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                            {loan.status.replace('_', ' ').toUpperCase()}
                          </span>
                          {isPending && (
                            <span style={{ background: 'rgba(255,184,76,0.15)', color: '#FFB84C', padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, animation: 'pulse 2s infinite' }}>
                              ⏳ NEEDS REVIEW
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '4px 16px', fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                          <div>📋 <strong>{loan.loan_type?.toUpperCase()}</strong> Loan</div>
                          <div>💰 Requested: <strong style={{ color: 'var(--text-primary)' }}>{formatINR(loan.amount_requested)}</strong></div>
                          {loan.amount_approved && <div>✅ Approved: <strong style={{ color: '#00E5A0' }}>{formatINR(loan.amount_approved)}</strong></div>}
                          <div>📅 EMI: <strong>{formatINR(loan.emi_amount)}/mo</strong></div>
                          <div>⏱ Tenure: <strong>{loan.tenure_months} months</strong></div>
                          <div>📊 Rate: <strong>{loan.interest_rate}% p.a.</strong></div>
                          <div>🏦 A/C: <strong style={{ fontFamily: 'monospace' }}>{loan.account_number || '—'}</strong></div>
                          <div>📆 Applied: <strong>{formatDate(loan.applied_at)}</strong></div>
                        </div>

                        {loan.purpose && (
                          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 10px' }}>
                            💬 Purpose: {loan.purpose}
                          </div>
                        )}
                        {loan.admin_remarks && (
                          <div style={{ marginTop: 6, fontSize: 12, color: loan.status === 'rejected' ? '#FF5757' : '#00E5A0', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 10px' }}>
                            📝 Admin: {loan.admin_remarks}
                          </div>
                        )}
                      </div>

                      {/* Action button */}
                      <div style={{ flexShrink: 0 }}>
                        {isPending ? (
                          <button onClick={() => {
                            setLoanTabModal(loan);
                            setLoanTabForm({ action: 'approve', amount_approved: String(loan.amount_requested), admin_remarks: '' });
                          }} style={{
                            background: 'var(--gradient-primary)', border: 'none', borderRadius: 10,
                            padding: '10px 20px', color: 'white', fontWeight: 700, fontSize: 13,
                            cursor: 'pointer', fontFamily: 'Outfit,sans-serif', whiteSpace: 'nowrap'
                          }}>
                            ⚖️ Review Loan
                          </button>
                        ) : (
                          <div style={{ fontSize: 28 }}>
                            {loan.status === 'approved' || loan.status === 'disbursed' ? '✅' : '❌'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ PENDING TAB ══════════════ */}
      {tab === 'pending' && (

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>🕐 Pending User Change Requests</div>
            <button className="btn-secondary" onClick={fetchPending} style={{ padding: '8px 14px', fontSize: 12 }}>↺ Refresh</button>
          </div>
          {pendingChanges.length === 0
            ? <div className="glass-card"><div className="empty-state"><div className="empty-state-icon">✅</div><p>No pending requests</p></div></div>
            : pendingChanges.map(u => (
              <div key={u.id} className="glass-card" style={{ padding: 20, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{u.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email} · {u.phone}</div>
                  </div>
                  <Badge color="#FFB84C">🕐 {u.pending_change_type?.toUpperCase()} PENDING</Badge>
                </div>
                {u.pending_phone && (
                  <div style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--primary-light)' }}>📱 Phone Change</div>
                    <div style={{ fontSize: 13 }}>{u.phone} → <strong style={{ color: '#FFB84C' }}>{u.pending_phone}</strong> {u.phone_verified ? '✅ OTP Verified' : '⚠️ Not Verified'}</div>
                    {u.phone_verified && <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                      <button className="btn-primary" style={{ fontSize: 12, padding: '7px 16px' }} onClick={async () => { try { await userAPI.approveChange({ userId: u.id, changeType: 'phone' }); toast.success('Approved!'); fetchPending(); } catch { toast.error('Failed'); } }}>✅ Approve</button>
                      <button className="btn-secondary" style={{ fontSize: 12, padding: '7px 14px' }} onClick={async () => { try { await userAPI.rejectChange({ userId: u.id, changeType: 'phone', reason: 'Rejected by admin' }); toast.success('Rejected'); fetchPending(); } catch { toast.error('Failed'); } }}>❌ Reject</button>
                    </div>}
                  </div>
                )}
                {u.pending_email && (
                  <div style={{ background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#00E5A0' }}>✉️ Email Change</div>
                    <div style={{ fontSize: 13 }}>{u.email} → <strong style={{ color: '#FFB84C' }}>{u.pending_email}</strong> {u.email_verified ? '✅ OTP Verified' : '⚠️ Not Verified'}</div>
                    {u.email_verified && <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                      <button className="btn-primary" style={{ fontSize: 12, padding: '7px 16px' }} onClick={async () => { try { await userAPI.approveChange({ userId: u.id, changeType: 'email' }); toast.success('Approved!'); fetchPending(); } catch { toast.error('Failed'); } }}>✅ Approve</button>
                      <button className="btn-secondary" style={{ fontSize: 12, padding: '7px 14px' }} onClick={async () => { try { await userAPI.rejectChange({ userId: u.id, changeType: 'email', reason: 'Rejected by admin' }); toast.success('Rejected'); fetchPending(); } catch { toast.error('Failed'); } }}>❌ Reject</button>
                    </div>}
                  </div>
                )}
                {u.pending_change_type === 'kyc' && (
                  <div style={{ background: 'rgba(255,184,76,0.05)', border: '1px solid rgba(255,184,76,0.2)', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: '#FFB84C' }}>📋 KYC Documents</div>
                    {u.pending_pan && <div style={{ fontSize: 12, marginBottom: 4 }}>PAN: <strong style={{ fontFamily: 'monospace' }}>{u.pending_pan}</strong></div>}
                    {u.pending_aadhaar && <div style={{ fontSize: 12, marginBottom: 4 }}>Aadhaar: <strong style={{ fontFamily: 'monospace' }}>••••••••{u.pending_aadhaar.slice(-4)}</strong></div>}
                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                      <button className="btn-primary" style={{ fontSize: 12, padding: '7px 16px' }} onClick={async () => { try { await userAPI.approveChange({ userId: u.id, changeType: 'kyc' }); toast.success('KYC Approved!'); fetchPending(); } catch { toast.error('Failed'); } }}>✅ Approve KYC</button>
                      <button className="btn-secondary" style={{ fontSize: 12, padding: '7px 14px' }} onClick={async () => { try { await userAPI.rejectChange({ userId: u.id, changeType: 'kyc', reason: 'Rejected' }); toast.success('Rejected'); fetchPending(); } catch { toast.error('Failed'); } }}>❌ Reject KYC</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* ══════════════ SUPPORT TAB ══════════════ */}
      {tab === 'support' && (
        <div>
          {supportStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
              {[['Total', supportStats.total || 0, '#6C63FF'],['🟣 Open', supportStats.open_count || 0, '#6C63FF'],['🟡 In Progress', supportStats.in_progress_count || 0, '#FFB84C'],['🟢 Resolved', supportStats.resolved_count || 0, '#00E5A0'],['🔴 Urgent', supportStats.urgent_count || 0, '#FF5757']].map(([l,v,c]) => (
                <div key={l} style={{ background: 'var(--bg-card)', border: `1px solid ${c}30`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: activeTicket ? '1fr 1fr' : '1fr', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {[['status','all status'],['priority','all priority'],['category','all category']].map(([field,ph]) => (
                  <select key={field} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'Outfit', cursor: 'pointer' }}
                    value={supportFilter[field]} onChange={e => setSupportFilter(f => ({ ...f, [field]: e.target.value }))}>
                    <option value="">{ph}</option>
                    {field === 'status' && ['open','in_progress','resolved','closed'].map(v => <option key={v} value={v}>{v}</option>)}
                    {field === 'priority' && ['low','medium','high','urgent'].map(v => <option key={v} value={v}>{v}</option>)}
                    {field === 'category' && ['account','payment','kyc','card','loan','upi','other'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                ))}
                <button onClick={fetchSupportTickets} style={{ background: 'var(--gradient-primary)', border: 'none', borderRadius: 8, padding: '7px 14px', color: 'white', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit' }}>🔍 Filter</button>
                <button onClick={() => { setSupportFilter({ status:'',priority:'',category:'' }); setTimeout(fetchSupportTickets,50); }} style={{ background:'transparent',border:'1px solid var(--border)',borderRadius:8,padding:'7px 14px',color:'var(--text-secondary)',fontSize:12,cursor:'pointer',fontFamily:'Outfit' }}>✖ Clear</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {supportTickets.length === 0 && <div className="glass-card"><div className="empty-state"><div className="empty-state-icon">🎉</div><p>No tickets found</p></div></div>}
                {supportTickets.map(t => {
                  const STS = { open:'#6C63FF',in_progress:'#FFB84C',resolved:'#00E5A0',closed:'#888' };
                  const PRI = { low:'#888',medium:'#6C63FF',high:'#FFB84C',urgent:'#FF5757' };
                  const isActive = activeTicket?.id === t.id;
                  return (
                    <div key={t.id} onClick={() => openAdminTicket(t.id)} style={{ background: isActive ? 'rgba(108,99,255,0.08)' : 'var(--bg-card)', border: `1px solid ${isActive ? '#6C63FF' : 'var(--border)'}`, borderLeft: `4px solid ${STS[t.status] || '#6C63FF'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                          {t.unread_user_msgs > 0 && <span style={{ background: '#FF5757', color: 'white', borderRadius: 999, fontSize: 9, fontWeight: 800, padding: '2px 6px' }}>{t.unread_user_msgs} new</span>}
                          <span style={{ fontSize: 10, fontWeight: 700, color: PRI[t.priority] }}>{t.priority?.toUpperCase()}</span>
                          <Badge color={STS[t.status]}>{t.status?.replace('_',' ')}</Badge>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}><b style={{ color: 'var(--text-secondary)' }}>{t.user_name}</b> · {t.ticket_number} · {formatDateTime(t.created_at)}</div>
                      {t.last_message && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{t.last_message}"</div>}
                    </div>
                  );
                })}
              </div>
            </div>
            {activeTicket && (
              <div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{activeTicket.subject}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{activeTicket.ticket_number} · {activeTicket.user_name} ({activeTicket.user_email})</div>
                    </div>
                    <button onClick={() => setActiveTicket(null)} style={{ background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:20,lineHeight:1 }}>×</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select style={{ background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:8,padding:'6px 10px',color:'var(--text-primary)',fontSize:12,fontFamily:'Outfit' }}
                      value={activeTicket.status} onChange={e => handleStatusChange(activeTicket.id,'status',e.target.value)}>
                      {['open','in_progress','resolved','closed'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select style={{ background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:8,padding:'6px 10px',color:'var(--text-primary)',fontSize:12,fontFamily:'Outfit' }}
                      value={activeTicket.priority} onChange={e => handleStatusChange(activeTicket.id,'priority',e.target.value)}>
                      {['low','medium','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,padding:16,marginBottom:14,maxHeight:360,overflowY:'auto' }}>
                  {(activeTicket.messages || []).map(msg => {
                    const isUser = msg.sender_role === 'user';
                    return (
                      <div key={msg.id} style={{ display:'flex',flexDirection:isUser?'row':'row-reverse',gap:8,marginBottom:12,alignItems:'flex-end' }}>
                        <div style={{ width:30,height:30,borderRadius:'50%',background:isUser?'linear-gradient(135deg,#00E5A0,#00B5CC)':'var(--gradient-primary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0 }}>{isUser?'👤':'👨‍💼'}</div>
                        <div style={{ maxWidth:'78%' }}>
                          <div style={{ fontSize:9,color:'var(--text-muted)',marginBottom:3,textAlign:isUser?'left':'right' }}>{msg.sender_name} · {formatDateTime(msg.created_at)}</div>
                          <div style={{ background:isUser?'rgba(0,229,160,0.08)':'rgba(108,99,255,0.12)',border:`1px solid ${isUser?'rgba(0,229,160,0.2)':'rgba(108,99,255,0.25)'}`,borderRadius:isUser?'4px 12px 12px 12px':'12px 4px 12px 12px',padding:'8px 12px',fontSize:12,lineHeight:1.6 }}>{msg.message}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={msgEndRef} />
                </div>
                {activeTicket.status !== 'closed' && (
                  <div style={{ background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,padding:16 }}>
                    <textarea style={{ width:'100%',background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 14px',color:'var(--text-primary)',fontFamily:'Outfit',fontSize:13,outline:'none',minHeight:80,resize:'vertical',boxSizing:'border-box' }}
                      placeholder="Type reply…" value={adminReply} onChange={e => setAdminReply(e.target.value)} onKeyDown={e => e.key==='Enter'&&e.ctrlKey&&handleAdminReply()} />
                    <div style={{ display:'flex',justifyContent:'flex-end',marginTop:8 }}>
                      <button onClick={handleAdminReply} disabled={supportLoading || !adminReply.trim()}
                        style={{ background:'var(--gradient-primary)',border:'none',borderRadius:8,padding:'9px 18px',color:'white',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'Outfit' }}>
                        {supportLoading ? '⏳ Sending…' : '📤 Send Reply'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ FAQ TAB ══════════════ */}
      {tab === 'faq' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 }}>
          {/* Add / Edit FAQ form */}
          <div className="glass-card" style={{ padding: 24 }}>
            <SectionTitle icon="✍️">{faqEdit ? 'Edit FAQ' : 'Add New FAQ'}</SectionTitle>
            <div style={{ marginBottom: 12 }}>
              <label style={labelSx}>Category</label>
              <select value={faqForm.category} onChange={e => setFaqForm(f => ({ ...f, category: e.target.value }))} style={{ ...inputSx, cursor: 'pointer' }}>
                {['general','account','payments','cards','loans','upi','kyc','security'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelSx}>Question</label>
              <textarea value={faqForm.question} onChange={e => setFaqForm(f => ({ ...f, question: e.target.value }))} rows={3}
                placeholder="Type the question…" style={{ ...inputSx, minHeight: 70, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelSx}>Answer</label>
              <textarea value={faqForm.answer} onChange={e => setFaqForm(f => ({ ...f, answer: e.target.value }))} rows={5}
                placeholder="Type the detailed answer…" style={{ ...inputSx, minHeight: 100, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {faqEdit && (
                <button onClick={() => { setFaqEdit(null); setFaqForm({ question:'',answer:'',category:'general' }); }}
                  style={{ flex: 1, background:'transparent',border:'1px solid var(--border)',borderRadius:10,padding:'10px 0',color:'var(--text-secondary)',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'Outfit,sans-serif' }}>
                  Cancel
                </button>
              )}
              <button onClick={saveFAQ} disabled={faqLoading}
                style={{ flex: 2, background:'var(--gradient-primary)',border:'none',borderRadius:10,padding:'10px 0',color:'white',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'Outfit,sans-serif',opacity:faqLoading?0.7:1 }}>
                {faqLoading ? '⏳ Saving…' : faqEdit ? '💾 Update FAQ' : '➕ Add FAQ'}
              </button>
            </div>
          </div>

          {/* FAQ List */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>❓ All FAQs ({faqs.length})</div>
            {faqs.length === 0 && <div className="glass-card"><div className="empty-state"><div className="empty-state-icon">❓</div><p>No FAQs yet. Add your first one!</p></div></div>}
            {faqs.map(f => (
              <div key={f.id} className="glass-card" style={{ padding: 18, marginBottom: 10, border: faqEdit?.id === f.id ? '1px solid rgba(108,99,255,0.5)' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <Badge color="#6C63FF">{f.category}</Badge>
                      {!f.is_active && <Badge color="#FF5757">Hidden</Badge>}
                    </div>
                    <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>Q: {f.question}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>A: {f.answer}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                    <button onClick={() => { setFaqEdit(f); setFaqForm({ question: f.question, answer: f.answer, category: f.category }); }}
                      style={{ background:'rgba(108,99,255,0.15)',border:'1px solid rgba(108,99,255,0.3)',borderRadius:7,padding:'6px 11px',color:'var(--primary-light)',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'Outfit,sans-serif' }}>✏️ Edit</button>
                    <button onClick={() => adminAPI.updateFAQ(f.id, { is_active: !f.is_active }).then(() => { toast.success(f.is_active?'FAQ hidden':'FAQ shown'); fetchFAQs(); }).catch(() => toast.error('Failed'))}
                      style={{ background:'rgba(255,184,76,0.12)',border:'1px solid rgba(255,184,76,0.3)',borderRadius:7,padding:'6px 11px',color:'#FFB84C',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'Outfit,sans-serif' }}>{f.is_active?'👁 Hide':'👁 Show'}</button>
                    <button onClick={() => deleteFAQ(f.id)}
                      style={{ background:'rgba(255,87,87,0.12)',border:'1px solid rgba(255,87,87,0.3)',borderRadius:7,padding:'6px 11px',color:'#FF5757',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'Outfit,sans-serif' }}>🗑 Del</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ BROADCAST TAB ══════════════ */}
      {tab === 'broadcast' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Send Message Card */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>📢 Send Message to User</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 22 }}>Send a notification, email or open a support ticket on behalf of any user. Updates instantly.</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelSx}>Select User *</label>
                <select value={broadcastForm.user_id} onChange={e => setBroadcastForm(f => ({ ...f, user_id: e.target.value }))} style={{ ...inputSx, width: '100%' }}>
                  <option value="">— Choose a user —</option>
                  {broadcastUsers.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
                </select>
              </div>
              <div>
                <label style={labelSx}>Channel</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {[['notification','🔔 Notification'],['email','📧 Email'],['ticket','🎫 Ticket']].map(([v,l]) => (
                    <button key={v} onClick={() => setBroadcastForm(f => ({ ...f, channel: v }))}
                      style={{ padding:'9px 4px',borderRadius:9,border:`2px solid ${broadcastForm.channel===v?'#6C63FF':'rgba(255,255,255,0.08)'}`,background:broadcastForm.channel===v?'rgba(108,99,255,0.15)':'rgba(255,255,255,0.03)',color:broadcastForm.channel===v?'#a89dff':'var(--text-muted)',fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:'Outfit,sans-serif',transition:'all 0.18s' }}>{l}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelSx}>Notification Type</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['info','ℹ️ Info','#5BC8FB'],['success','✅ Success','#00E5A0'],['warning','⚠️ Warning','#FFB84C'],['error','❌ Alert','#FF5757'],['system','⚙️ System','#6C63FF']].map(([v,l,c]) => (
                  <button key={v} onClick={() => setBroadcastForm(f => ({ ...f, type: v }))}
                    style={{ padding:'7px 12px',borderRadius:8,border:`2px solid ${broadcastForm.type===v?c:'rgba(255,255,255,0.08)'}`,background:broadcastForm.type===v?`${c}18`:'transparent',color:broadcastForm.type===v?c:'var(--text-muted)',fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:'Outfit,sans-serif',transition:'all 0.18s' }}>{l}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelSx}>Title / Subject *</label>
              <input value={broadcastForm.title} onChange={e => setBroadcastForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Important account update" style={inputSx} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelSx}>Message Body *</label>
              <textarea value={broadcastForm.body} onChange={e => setBroadcastForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Write your message here…" rows={4} style={{ ...inputSx, resize: 'vertical', lineHeight: 1.6, minHeight: 90 }} />
            </div>

            {/* Preview */}
            {broadcastForm.title && broadcastForm.body && broadcastForm.user_id && (
              <div style={{ marginBottom: 16, padding: '14px 18px', background: 'rgba(108,99,255,0.07)', border: '1px solid rgba(108,99,255,0.25)', borderRadius: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>📋 Preview</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{broadcastForm.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{broadcastForm.body}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>→ Sending via <strong>{broadcastForm.channel}</strong> as <strong>{broadcastForm.type}</strong> to <strong>{broadcastUsers.find(u => u.id === broadcastForm.user_id)?.full_name || '...'}</strong></div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setBroadcastForm({ user_id: '', title: '', body: '', type: 'info', channel: 'notification' })}
                style={{ background:'transparent',border:'1px solid var(--border)',borderRadius:10,padding:'11px 20px',color:'var(--text-secondary)',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'Outfit,sans-serif' }}>🗑 Clear</button>
              <button onClick={async () => {
                if (!broadcastForm.user_id || !broadcastForm.title || !broadcastForm.body) { toast.error('Fill all required fields'); return; }
                setBroadcastLoading(true);
                try {
                  const r = await adminAPI.sendMessage(broadcastForm.user_id, { title: broadcastForm.title, body: broadcastForm.body, type: broadcastForm.type, channel: broadcastForm.channel });
                  toast.success(r.data.message || 'Message sent!');
                  setBroadcastHistory(h => [{ ...broadcastForm, user_name: broadcastUsers.find(u=>u.id===broadcastForm.user_id)?.full_name, sent_at: new Date().toISOString(), id: Date.now() }, ...h.slice(0,19)]);
                  setBroadcastForm(f => ({ ...f, title: '', body: '' }));
                } catch (err) { toast.error(err.response?.data?.message || 'Failed to send'); }
                finally { setBroadcastLoading(false); }
              }} disabled={broadcastLoading || !broadcastForm.user_id || !broadcastForm.title || !broadcastForm.body}
                style={{ flex:1,background:'linear-gradient(135deg,#6C63FF,#00E5A0)',border:'none',borderRadius:10,padding:'12px 24px',color:'white',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'Outfit,sans-serif',opacity:broadcastLoading?0.7:1 }}>
                {broadcastLoading ? '⏳ Sending…' : broadcastForm.channel==='ticket' ? '🎫 Send & Create Ticket' : broadcastForm.channel==='email' ? '📧 Send Email' : '🔔 Send Notification'}
              </button>
            </div>
          </div>

          {/* Recent Broadcasts */}
          {broadcastHistory.length > 0 && (
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>📋 Sent This Session ({broadcastHistory.length})</div>
              {broadcastHistory.map(h => (
                <div key={h.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{h.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{h.body}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>→ {h.user_name} · {h.channel} · {h.type}</div>
                  </div>
                  <Badge color="#00E5A0">✅ Sent</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ DATABASE VIEWER TAB ══════════════ */}
      {tab === 'database' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>🗄️ Database Viewer</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Read-only live view of {dbStats?.database || '...'} database</div>
            </div>
            <button onClick={fetchDbStats} disabled={dbLoading}
              style={{ background:'rgba(108,99,255,0.15)',border:'1px solid rgba(108,99,255,0.3)',borderRadius:10,padding:'9px 16px',color:'var(--primary-light)',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'Outfit,sans-serif' }}>
              {dbLoading ? '⏳' : '🔄 Refresh'}
            </button>
          </div>

          {/* 24h Activity */}
          {dbStats?.last_24h && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              {[['🆕 New Users (24h)', dbStats.last_24h.new_users, '#6C63FF'],['💸 Transactions (24h)', dbStats.last_24h.transactions, '#00E5A0'],['📊 Volume (24h)', formatINR(dbStats.last_24h.transaction_volume), '#FFB84C']].map(([l,v,c]) => (
                <div key={l} className="glass-card" style={{ padding: 18, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{l}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{typeof v === 'number' ? v.toLocaleString('en-IN') : v}</div>
                </div>
              ))}
            </div>
          )}

          {/* Live Row Counts */}
          {dbStats?.live_counts && (
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>📊 Live Row Counts</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {Object.entries(dbStats.live_counts).map(([table, count]) => (
                  <div key={table} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{table.replace(/_/g,' ')}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#6C63FF' }}>{typeof count === 'number' ? count.toLocaleString('en-IN') : count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table Sizes */}
          {dbStats?.tables && (
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>📋 All Tables</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: 600 }}>
                  <thead><tr><th>Table</th><th>Estimated Rows</th><th>Size (KB)</th><th>Created</th><th>Last Updated</th></tr></thead>
                  <tbody>
                    {dbStats.tables.map(t => (
                      <tr key={t.name}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-light)' }}>{t.name}</td>
                        <td style={{ fontWeight: 700 }}>{Number(t.row_count || 0).toLocaleString('en-IN')}</td>
                        <td>{t.size_kb ?? '—'} KB</td>
                        <td style={{ fontSize: 12 }}>{t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN') : '—'}</td>
                        <td style={{ fontSize: 12 }}>{t.updated_at ? new Date(t.updated_at).toLocaleDateString('en-IN') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preset Query Runner */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>🔍 Preset Query Runner</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Safe read-only preset queries — no raw SQL allowed</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
              {[['top_users_balance','💰 Top Users by Balance'],['top_transactions','💸 Largest Transactions'],['pending_kyc','📋 Pending KYC'],['active_loans','🏦 Active Loans'],['fraud_transactions','⚠️ Fraud Transactions'],['inactive_users','😴 Inactive Users (30d)'],['daily_stats','📅 Daily Stats (30d)'],['loan_summary','📊 Loan Summary']].map(([id,label]) => (
                <button key={id} onClick={() => setDbQuery(id)}
                  style={{ padding:'10px 14px',borderRadius:9,border:`2px solid ${dbQuery===id?'#6C63FF':'rgba(255,255,255,0.08)'}`,background:dbQuery===id?'rgba(108,99,255,0.15)':'rgba(255,255,255,0.03)',color:dbQuery===id?'#a89dff':'var(--text-secondary)',fontWeight:600,fontSize:12,cursor:'pointer',fontFamily:'Outfit,sans-serif',textAlign:'left',transition:'all 0.18s' }}>{label}</button>
              ))}
            </div>
            <button onClick={async () => {
              if (!dbQuery) { toast.error('Select a query first'); return; }
              setDbQueryLoading(true);
              setDbQueryResult(null);
              try { const r = await adminAPI.runDbQuery({ query_id: dbQuery }); setDbQueryResult(r.data.data); }
              catch (err) { toast.error(err.response?.data?.message || 'Query failed'); }
              finally { setDbQueryLoading(false); }
            }} disabled={dbQueryLoading || !dbQuery}
              style={{ background:'linear-gradient(135deg,#6C63FF,#00B5CC)',border:'none',borderRadius:10,padding:'11px 28px',color:'white',fontWeight:800,fontSize:13,cursor:'pointer',fontFamily:'Outfit,sans-serif',marginBottom:16,opacity:dbQueryLoading||!dbQuery?0.6:1 }}>
              {dbQueryLoading ? '⏳ Running…' : '▶ Run Query'}
            </button>

            {dbQueryResult && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>✅ {dbQueryResult.count} rows returned</div>
                <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                  {dbQueryResult.rows?.length > 0 ? (
                    <table className="data-table" style={{ minWidth: 600, fontSize: 12 }}>
                      <thead><tr>{Object.keys(dbQueryResult.rows[0]).map(k => <th key={k}>{k}</th>)}</tr></thead>
                      <tbody>{dbQueryResult.rows.map((row, i) => (
                        <tr key={i}>{Object.values(row).map((v, j) => <td key={j} style={{ fontFamily: typeof v === 'number' ? 'monospace' : undefined }}>{v === null ? '—' : String(v)}</td>)}</tr>
                      ))}</tbody>
                    </table>
                  ) : <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No results</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Loan Review Modal ══ */}
      {loanModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:1002,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',padding:20 }} onClick={e => e.target===e.currentTarget&&setLoanModal(null)}>
          <div style={{ background:'#13132a',border:'1px solid rgba(108,99,255,0.3)',borderRadius:18,width:'100%',maxWidth:520,padding:28 }}>
            <div style={{ fontSize:18,fontWeight:800,marginBottom:18 }}>⚖️ Loan Review — {loanModal.loan_type?.toUpperCase()}</div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:0,marginBottom:16 }}>
              <Row label="Requested" value={formatINR(loanModal.amount_requested)} />
              <Row label="Tenure" value={`${loanModal.tenure_months} months`} />
              <Row label="Purpose" value={loanModal.purpose} />
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14 }}>
              {[['approve','✅ Approve','#00E5A0'],['reject','❌ Reject','#FF5757']].map(([v,l,c]) => (
                <button key={v} onClick={() => setLoanForm(f => ({ ...f, action: v }))} style={{ padding:'12px',borderRadius:10,border:`2px solid ${loanForm.action===v?c:'rgba(255,255,255,0.08)'}`,background:loanForm.action===v?`${c}18`:'transparent',color:loanForm.action===v?c:'var(--text-muted)',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'Outfit,sans-serif',transition:'all 0.2s' }}>{l}</button>
              ))}
            </div>
            {loanForm.action === 'approve' && (
              <div style={{ marginBottom:12 }}>
                <label style={labelSx}>Amount to Approve (₹)</label>
                <input type="number" value={loanForm.amount_approved} onChange={e => setLoanForm(f => ({ ...f, amount_approved: e.target.value }))} style={inputSx} />
              </div>
            )}
            <div style={{ marginBottom:18 }}>
              <label style={labelSx}>Admin Remarks</label>
              <textarea value={loanForm.admin_remarks} onChange={e => setLoanForm(f => ({ ...f, admin_remarks: e.target.value }))} style={{ ...inputSx, minHeight:70,resize:'vertical',lineHeight:1.5 }} placeholder="Reason / notes…" />
            </div>
            <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
              <button onClick={() => setLoanModal(null)} style={{ background:'transparent',border:'1px solid var(--border)',borderRadius:10,padding:'10px 20px',color:'var(--text-secondary)',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'Outfit,sans-serif' }}>Cancel</button>
              <button onClick={handleApproveLoan} style={{ background:loanForm.action==='approve'?'linear-gradient(135deg,#00E5A0,#00B5CC)':'linear-gradient(135deg,#FF5757,#FF2D55)',border:'none',borderRadius:10,padding:'10px 24px',color:'white',fontWeight:800,fontSize:13,cursor:'pointer',fontFamily:'Outfit,sans-serif' }}>
                {loanForm.action === 'approve' ? '✅ Approve Loan' : '❌ Reject Loan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Loan TAB Review Modal ══ */}
      {loanTabModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',zIndex:1003,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)',padding:20 }}
          onClick={e => e.target===e.currentTarget && !loanTabLoading && setLoanTabModal(null)}>
          <div style={{ background:'linear-gradient(145deg,#13132a,#1a1a38)',border:'1px solid rgba(108,99,255,0.35)',borderRadius:20,width:'100%',maxWidth:560,padding:32,boxShadow:'0 32px 100px rgba(0,0,0,0.9)',maxHeight:'90vh',overflowY:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22 }}>
              <div>
                <div style={{ fontSize:20,fontWeight:800 }}>⚖️ Loan Application Review</div>
                <div style={{ fontSize:12,color:'var(--text-muted)',marginTop:4 }}>{loanTabModal.full_name} · {loanTabModal.email}</div>
              </div>
              <button onClick={() => setLoanTabModal(null)} disabled={loanTabLoading} style={{ background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:24,lineHeight:1 }}>×</button>
            </div>
            <div style={{ background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:'14px 18px',marginBottom:20 }}>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px 0',fontSize:13 }}>
                {[['Loan Type',loanTabModal.loan_type?.toUpperCase()],['Requested',formatINR(loanTabModal.amount_requested)],['Tenure',`${loanTabModal.tenure_months} mo`],['Rate',`${loanTabModal.interest_rate}% p.a.`],['Monthly EMI',formatINR(loanTabModal.emi_amount)],['Total Payable',formatINR(loanTabModal.total_payable)]].map(([l,v]) => (
                  <div key={l}><div style={{ fontSize:10,color:'var(--text-muted)',fontWeight:700,textTransform:'uppercase',marginBottom:2 }}>{l}</div><div style={{ fontWeight:700 }}>{v||'—'}</div></div>
                ))}
              </div>
              {loanTabModal.purpose && <div style={{ marginTop:10,paddingTop:10,borderTop:'1px solid rgba(255,255,255,0.06)',fontSize:12,color:'var(--text-muted)' }}>💬 Purpose: {loanTabModal.purpose}</div>}
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16 }}>
              {[['approve','✅ Approve & Disburse','#00E5A0'],['reject','❌ Reject Application','#FF5757']].map(([v,l,c]) => (
                <button key={v} onClick={() => setLoanTabForm(f => ({ ...f, action:v }))} style={{ padding:'13px',borderRadius:12,cursor:'pointer',fontFamily:'Outfit,sans-serif',fontWeight:700,fontSize:13,transition:'all 0.2s',border:`2px solid ${loanTabForm.action===v?c:'rgba(255,255,255,0.08)'}`,background:loanTabForm.action===v?`${c}18`:'transparent',color:loanTabForm.action===v?c:'var(--text-muted)' }}>{l}</button>
              ))}
            </div>
            {loanTabForm.action === 'approve' && (
              <div style={{ marginBottom:14 }}>
                <label style={labelSx}>Amount to Disburse (₹)</label>
                <input type="number" value={loanTabForm.amount_approved} onChange={e => setLoanTabForm(f => ({ ...f,amount_approved:e.target.value }))} style={inputSx} />
                <div style={{ background:'rgba(0,229,160,0.07)',border:'1px solid rgba(0,229,160,0.2)',borderRadius:10,padding:'10px 14px',fontSize:12,color:'var(--success)',marginTop:10,display:'flex',gap:8,alignItems:'center' }}>
                  <span>💰</span><span>Approving will <strong>immediately credit {formatINR(loanTabForm.amount_approved||loanTabModal.amount_requested)}</strong> to the user's account and notify them.</span>
                </div>
              </div>
            )}
            {loanTabForm.action === 'reject' && (
              <div style={{ background:'rgba(255,87,87,0.07)',border:'1px solid rgba(255,87,87,0.2)',borderRadius:10,padding:'10px 14px',fontSize:12,color:'var(--error)',marginBottom:14,display:'flex',gap:8,alignItems:'center' }}>
                <span>❌</span><span>User will be <strong>notified of rejection</strong> with your remarks.</span>
              </div>
            )}
            <div style={{ marginBottom:20 }}>
              <label style={labelSx}>Admin Remarks {loanTabForm.action==='reject'&&<span style={{ color:'var(--error)' }}>*</span>}</label>
              <textarea value={loanTabForm.admin_remarks} onChange={e => setLoanTabForm(f => ({ ...f,admin_remarks:e.target.value }))} style={{ ...inputSx,minHeight:70,resize:'vertical',lineHeight:1.5 }} placeholder={loanTabForm.action==='approve'?'Optional note…':'Rejection reason (required)…'} />
            </div>
            <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
              <button onClick={() => setLoanTabModal(null)} disabled={loanTabLoading} style={{ background:'transparent',border:'1px solid var(--border)',borderRadius:10,padding:'12px 22px',color:'var(--text-secondary)',fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:'Outfit,sans-serif' }}>Cancel</button>
              <button onClick={handleLoanTabDecision} disabled={loanTabLoading||(loanTabForm.action==='reject'&&!loanTabForm.admin_remarks.trim())}
                style={{ background:loanTabForm.action==='approve'?'linear-gradient(135deg,#00E5A0,#00B5CC)':'linear-gradient(135deg,#FF5757,#FF2D55)',border:'none',borderRadius:10,padding:'12px 28px',color:'white',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'Outfit,sans-serif',opacity:loanTabLoading?0.7:1,display:'flex',alignItems:'center',gap:8 }}>
                {loanTabLoading?<><span className="spinner" style={{ width:16,height:16,borderWidth:2 }} />Processing…</>:loanTabForm.action==='approve'?'✅ Approve & Credit Account':'❌ Reject Application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Money Adjust Modal ══ */}
      {moneyModal && (

        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.78)',zIndex:1001,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)',padding:20 }} onClick={e => e.target===e.currentTarget&&!moneyLoading&&setMoneyModal(null)}>
          <div style={{ background:'linear-gradient(145deg,#13132a,#1a1a35)',border:'1px solid rgba(0,229,160,0.25)',borderRadius:20,width:'100%',maxWidth:480,padding:30,boxShadow:'0 28px 90px rgba(0,0,0,0.85)' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22 }}>
              <div>
                <div style={{ fontSize:20,fontWeight:800 }}>💰 Adjust Balance</div>
                <div style={{ fontSize:12,color:'var(--text-muted)',marginTop:3 }}>{moneyModal.full_name} · {moneyModal.email}</div>
              </div>
              <button onClick={() => setMoneyModal(null)} disabled={moneyLoading} style={{ background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:22,lineHeight:1 }}>×</button>
            </div>
            <div style={{ background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:'14px 18px',marginBottom:22,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div>
                <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:0.8 }}>Current Balance</div>
                <div style={{ fontSize:22,fontWeight:800,color:'#00E5A0',marginTop:4 }}>{formatINR(moneyModal.balance ?? moneyModal.total_balance ?? 0)}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:0.8 }}>Account</div>
                <div style={{ fontSize:13,fontWeight:600,marginTop:4,fontFamily:'monospace' }}>{moneyModal.account_number || '—'}</div>
              </div>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18 }}>
              {[['credit','💰 Add Money','#00E5A0'],['debit','💸 Deduct Money','#FF5757']].map(([val,label,color]) => (
                <button key={val} onClick={() => { setMoneyForm(f => ({ ...f, type: val })); setMoneySuccess(null); }}
                  style={{ padding:'13px 10px',borderRadius:12,border:`2px solid ${moneyForm.type===val?color:'rgba(255,255,255,0.08)'}`,background:moneyForm.type===val?`${color}18`:'rgba(255,255,255,0.03)',color:moneyForm.type===val?color:'var(--text-muted)',fontWeight:800,fontSize:13,cursor:'pointer',fontFamily:'Outfit,sans-serif',transition:'all 0.2s' }}>{label}</button>
              ))}
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={labelSx}>Amount (₹)</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:16,color:moneyForm.type==='credit'?'#00E5A0':'#FF5757',fontWeight:800 }}>₹</span>
                <input type="number" min="1" step="0.01" value={moneyForm.amount} onChange={e => { setMoneyForm(f => ({ ...f, amount: e.target.value })); setMoneySuccess(null); }} placeholder="Enter amount…"
                  style={{ ...inputSx, paddingLeft:34, border:`1px solid ${moneyForm.type==='credit'?'rgba(0,229,160,0.3)':'rgba(255,87,87,0.3)'}`, fontSize:16, fontWeight:700 }} />
              </div>
            </div>
            <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:18 }}>
              {[500,1000,5000,10000,50000].map(v => (
                <button key={v} onClick={() => { setMoneyForm(f => ({ ...f, amount: String(v) })); setMoneySuccess(null); }}
                  style={{ background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,padding:'5px 13px',fontSize:12,fontWeight:600,cursor:'pointer',color:'var(--text-secondary)',fontFamily:'Outfit,sans-serif' }}>
                  ₹{v.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={labelSx}>Reason / Remarks</label>
              <input type="text" value={moneyForm.reason} onChange={e => setMoneyForm(f => ({ ...f, reason: e.target.value }))}
                placeholder={moneyForm.type==='credit'?'e.g. Cashback, refund…':'e.g. Loan repayment, penalty…'} style={inputSx} />
            </div>
            {moneyForm.amount && parseFloat(moneyForm.amount) > 0 && (() => {
              const cur = parseFloat(moneyModal.balance ?? moneyModal.total_balance ?? 0);
              const adj = parseFloat(moneyForm.amount);
              const next = moneyForm.type === 'credit' ? cur + adj : cur - adj;
              return (
                <div style={{ background:next<0?'rgba(255,87,87,0.08)':'rgba(0,229,160,0.07)',border:`1px solid ${next<0?'rgba(255,87,87,0.3)':'rgba(0,229,160,0.25)'}`,borderRadius:12,padding:'12px 16px',marginBottom:18,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:0.8 }}>New Balance</div>
                    <div style={{ fontSize:20,fontWeight:800,color:next<0?'#FF5757':'#00E5A0',marginTop:3 }}>{formatINR(next)}</div>
                  </div>
                  <div style={{ fontSize:24 }}>{moneyForm.type==='credit'?'📈':'📉'}</div>
                </div>
              );
            })()}
            {moneySuccess && (
              <div style={{ background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.35)',borderRadius:12,padding:'12px 16px',marginBottom:16,textAlign:'center' }}>
                <div style={{ fontSize:18,marginBottom:4 }}>✅</div>
                <div style={{ fontWeight:700,color:'#00E5A0',fontSize:14 }}>{moneySuccess.message}</div>
                <div style={{ fontSize:12,color:'var(--text-muted)',marginTop:3 }}>New Balance: {formatINR(moneySuccess.data?.new_balance)}</div>
              </div>
            )}
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setMoneyModal(null)} disabled={moneyLoading} style={{ flex:1,background:'transparent',border:'1px solid var(--border)',borderRadius:11,padding:'12px 0',color:'var(--text-secondary)',fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:'Outfit,sans-serif' }}>Cancel</button>
              <button onClick={handleMoneyAdjust} disabled={moneyLoading||!moneyForm.amount||parseFloat(moneyForm.amount)<=0}
                style={{ flex:2,background:moneyForm.type==='credit'?'linear-gradient(135deg,#00E5A0,#00B5CC)':'linear-gradient(135deg,#FF5757,#FF2D55)',border:'none',borderRadius:11,padding:'12px 0',color:'white',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'Outfit,sans-serif',opacity:(moneyLoading||!moneyForm.amount)?0.6:1 }}>
                {moneyLoading ? '⏳ Processing…' : moneyForm.type==='credit' ? '💰 Add Money' : '💸 Deduct Money'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Give Loan Modal (Admin Issues Loan) ══ */}
      {giveLoanUser && (() => {
        const emi = calcEMI(giveLoanForm.amount, giveLoanForm.interest_rate, giveLoanForm.tenure_months);
        const hasAmt = parseFloat(giveLoanForm.amount) > 0;

        const handleGiveLoan = async () => {
          if (!giveLoanForm.amount || parseFloat(giveLoanForm.amount) <= 0) { toast.error('Enter a valid amount'); return; }
          setGiveLoanLoading(true);
          try {
            const r = await adminAPI.giveLoan(giveLoanUser.id, {
              loan_type:      giveLoanForm.loan_type,
              amount:         parseFloat(giveLoanForm.amount),
              interest_rate:  parseFloat(giveLoanForm.interest_rate),
              tenure_months:  parseInt(giveLoanForm.tenure_months),
              purpose:        giveLoanForm.purpose,
              auto_credit:    giveLoanForm.auto_credit,
            });
            toast.success(r.data.message || 'Loan issued successfully!');
            setGiveLoanUser(null);
            // Refresh user detail if open
            if (detailUser?.user?.id === giveLoanUser.id) openUserDetail(giveLoanUser.id);
            adminAPI.getStats().then(rs => setStats(rs.data.data)).catch(() => {});
          } catch (err) { toast.error(err.response?.data?.message || 'Failed to issue loan'); }
          finally { setGiveLoanLoading(false); }
        };

        return (
          <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)',padding:20 }}
            onClick={e => e.target === e.currentTarget && !giveLoanLoading && setGiveLoanUser(null)}>
            <div style={{ background:'linear-gradient(145deg,#0e0e22,#161630)',border:'1px solid rgba(108,99,255,0.4)',borderRadius:22,width:'100%',maxWidth:600,padding:32,boxShadow:'0 40px 120px rgba(0,0,0,0.95)',maxHeight:'92vh',overflowY:'auto' }}>

              {/* Header */}
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24 }}>
                <div>
                  <div style={{ fontSize:22,fontWeight:800,background:'linear-gradient(135deg,#6C63FF,#00E5A0)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' }}>🏛️ Issue Loan to User</div>
                  <div style={{ fontSize:12,color:'var(--text-muted)',marginTop:5 }}>{giveLoanUser.full_name} · {giveLoanUser.email}</div>
                </div>
                <button onClick={() => setGiveLoanUser(null)} disabled={giveLoanLoading}
                  style={{ background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:26,lineHeight:1 }}>×</button>
              </div>

              {/* Loan Type Selector */}
              <div style={{ marginBottom:18 }}>
                <label style={labelSx}>Loan Type</label>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8 }}>
                  {[['personal','👤 Personal'],['home','🏠 Home'],['auto','🚗 Auto'],['education','🎓 Education'],['business','💼 Business'],['gold','🪙 Gold']].map(([v,l]) => (
                    <button key={v} onClick={() => setGiveLoanForm(f => ({ ...f, loan_type:v }))}
                      style={{ padding:'10px 6px',borderRadius:10,border:`2px solid ${giveLoanForm.loan_type===v?'#6C63FF':'rgba(255,255,255,0.08)'}`,background:giveLoanForm.loan_type===v?'rgba(108,99,255,0.15)':'rgba(255,255,255,0.03)',color:giveLoanForm.loan_type===v?'#a89dff':'var(--text-muted)',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'Outfit,sans-serif',transition:'all 0.2s' }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Amount + Rate + Tenure */}
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16 }}>
                <div>
                  <label style={labelSx}>Loan Amount (₹) *</label>
                  <input type="number" min="1000" step="1000" value={giveLoanForm.amount}
                    onChange={e => setGiveLoanForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="e.g. 100000" style={{ ...inputSx, fontSize:15, fontWeight:700 }} />
                  <div style={{ display:'flex',gap:5,flexWrap:'wrap',marginTop:6 }}>
                    {[50000,100000,250000,500000].map(v => (
                      <button key={v} onClick={() => setGiveLoanForm(f => ({ ...f, amount: String(v) }))}
                        style={{ background:'rgba(108,99,255,0.1)',border:'1px solid rgba(108,99,255,0.2)',borderRadius:14,padding:'3px 8px',fontSize:10,fontWeight:700,cursor:'pointer',color:'var(--primary-light)',fontFamily:'Outfit,sans-serif' }}>
                        ₹{(v/1000).toFixed(0)}K
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelSx}>Interest Rate (% p.a.) *</label>
                  <input type="number" min="0" max="36" step="0.1" value={giveLoanForm.interest_rate}
                    onChange={e => setGiveLoanForm(f => ({ ...f, interest_rate: e.target.value }))}
                    style={inputSx} />
                  <div style={{ display:'flex',gap:5,flexWrap:'wrap',marginTop:6 }}>
                    {[8,10,12,14,18].map(v => (
                      <button key={v} onClick={() => setGiveLoanForm(f => ({ ...f, interest_rate: String(v) }))}
                        style={{ background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.2)',borderRadius:14,padding:'3px 8px',fontSize:10,fontWeight:700,cursor:'pointer',color:'#00E5A0',fontFamily:'Outfit,sans-serif' }}>
                        {v}%
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelSx}>Tenure (Months) *</label>
                  <input type="number" min="1" max="360" step="1" value={giveLoanForm.tenure_months}
                    onChange={e => setGiveLoanForm(f => ({ ...f, tenure_months: e.target.value }))}
                    style={inputSx} />
                  <div style={{ display:'flex',gap:5,flexWrap:'wrap',marginTop:6 }}>
                    {[6,12,24,36,60,120].map(v => (
                      <button key={v} onClick={() => setGiveLoanForm(f => ({ ...f, tenure_months: String(v) }))}
                        style={{ background:'rgba(255,184,76,0.08)',border:'1px solid rgba(255,184,76,0.2)',borderRadius:14,padding:'3px 8px',fontSize:10,fontWeight:700,cursor:'pointer',color:'#FFB84C',fontFamily:'Outfit,sans-serif' }}>
                        {v}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Purpose */}
              <div style={{ marginBottom:16 }}>
                <label style={labelSx}>Purpose / Remarks</label>
                <input type="text" value={giveLoanForm.purpose}
                  onChange={e => setGiveLoanForm(f => ({ ...f, purpose: e.target.value }))}
                  placeholder="e.g. Home renovation, Vehicle purchase…" style={inputSx} />
              </div>

              {/* Live EMI Calculator Result */}
              {hasAmt && (
                <div style={{ background:'linear-gradient(135deg,rgba(108,99,255,0.12),rgba(0,229,160,0.08))',border:'1px solid rgba(108,99,255,0.3)',borderRadius:16,padding:'16px 20px',marginBottom:16 }}>
                  <div style={{ fontSize:11,fontWeight:800,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:12 }}>📊 Live EMI Calculator</div>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,textAlign:'center' }}>
                    {[
                      ['Monthly EMI', `₹${emi.emi.toLocaleString('en-IN',{maximumFractionDigits:2})}`, '#6C63FF'],
                      ['Principal',   `₹${parseFloat(giveLoanForm.amount||0).toLocaleString('en-IN')}`, '#00E5A0'],
                      ['Total Interest', `₹${emi.interest.toLocaleString('en-IN',{maximumFractionDigits:2})}`, '#FFB84C'],
                      ['Total Payable', `₹${emi.total.toLocaleString('en-IN',{maximumFractionDigits:2})}`, '#FF6B9D'],
                    ].map(([lbl,val,clr]) => (
                      <div key={lbl} style={{ background:'rgba(255,255,255,0.04)',borderRadius:10,padding:'10px 6px' }}>
                        <div style={{ fontSize:9,color:'var(--text-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:0.8,marginBottom:5 }}>{lbl}</div>
                        <div style={{ fontSize:14,fontWeight:800,color:clr }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {/* Breakdown bar */}
                  {emi.total > 0 && (
                    <div style={{ marginTop:14 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--text-muted)',marginBottom:4 }}>
                        <span>Principal ({((parseFloat(giveLoanForm.amount||0)/emi.total)*100).toFixed(1)}%)</span>
                        <span>Interest ({((emi.interest/emi.total)*100).toFixed(1)}%)</span>
                      </div>
                      <div style={{ height:8,borderRadius:99,overflow:'hidden',display:'flex',gap:0 }}>
                        <div style={{ width:`${(parseFloat(giveLoanForm.amount||0)/emi.total)*100}%`,background:'linear-gradient(90deg,#6C63FF,#00E5A0)',transition:'width 0.4s ease' }} />
                        <div style={{ flex:1,background:'rgba(255,184,76,0.4)' }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Auto-credit toggle */}
              <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:20,padding:'12px 16px',background:'rgba(0,229,160,0.06)',border:'1px solid rgba(0,229,160,0.2)',borderRadius:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700,fontSize:13 }}>💰 Auto-Credit to Account</div>
                  <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:2 }}>
                    {giveLoanForm.auto_credit ? 'Loan amount will be immediately credited to user\'s account' : 'Only loan record will be created — no money movement'}
                  </div>
                </div>
                <button onClick={() => setGiveLoanForm(f => ({ ...f, auto_credit: !f.auto_credit }))}
                  style={{ width:48,height:26,borderRadius:99,border:'none',cursor:'pointer',transition:'all 0.3s',background:giveLoanForm.auto_credit?'linear-gradient(135deg,#00E5A0,#00B5CC)':'rgba(255,255,255,0.12)',position:'relative',flexShrink:0 }}>
                  <span style={{ position:'absolute',top:3,left:giveLoanForm.auto_credit?24:3,width:20,height:20,borderRadius:'50%',background:'white',transition:'left 0.3s',boxShadow:'0 1px 4px rgba(0,0,0,0.4)' }} />
                </button>
              </div>

              {/* Confirmation summary */}
              {hasAmt && giveLoanForm.auto_credit && (
                <div style={{ background:'rgba(255,184,76,0.07)',border:'1px solid rgba(255,184,76,0.25)',borderRadius:12,padding:'12px 16px',marginBottom:18,fontSize:12,color:'#FFB84C',display:'flex',gap:8,alignItems:'flex-start' }}>
                  <span style={{ fontSize:16,flexShrink:0 }}>⚠️</span>
                  <span>This will <strong>immediately credit ₹{parseFloat(giveLoanForm.amount||0).toLocaleString('en-IN')}</strong> to <strong>{giveLoanUser.full_name}</strong>'s account and create a loan with {giveLoanForm.tenure_months} monthly EMIs of ₹{emi.emi.toLocaleString('en-IN',{maximumFractionDigits:2})} each.</span>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display:'flex',gap:12,justifyContent:'flex-end' }}>
                <button onClick={() => setGiveLoanUser(null)} disabled={giveLoanLoading}
                  style={{ background:'transparent',border:'1px solid var(--border)',borderRadius:11,padding:'12px 24px',color:'var(--text-secondary)',fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:'Outfit,sans-serif' }}>
                  Cancel
                </button>
                <button onClick={handleGiveLoan} disabled={giveLoanLoading || !hasAmt}
                  style={{ background:'linear-gradient(135deg,#6C63FF,#00E5A0)',border:'none',borderRadius:11,padding:'12px 30px',color:'white',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'Outfit,sans-serif',opacity:giveLoanLoading||!hasAmt?0.6:1,display:'flex',alignItems:'center',gap:8 }}>
                  {giveLoanLoading
                    ? <><span className="spinner" style={{ width:16,height:16,borderWidth:2 }} />Processing…</>
                    : `🏛️ Issue ${giveLoanForm.auto_credit ? '& Credit' : ''} Loan`}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ══ Reset Password Modal ══ */}
      {resetPwUser && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:2100,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)',padding:20 }}
          onClick={e => e.target === e.currentTarget && !resetPwLoading && setResetPwUser(null)}>
          <div style={{ background:'linear-gradient(145deg,#0e0e22,#161630)',border:'1px solid rgba(255,184,76,0.35)',borderRadius:20,width:'100%',maxWidth:460,padding:30,boxShadow:'0 40px 120px rgba(0,0,0,0.95)' }}>

            {/* Header */}
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22 }}>
              <div>
                <div style={{ fontSize:20,fontWeight:800,color:'#FFB84C' }}>🔑 Reset Password</div>
                <div style={{ fontSize:12,color:'var(--text-muted)',marginTop:4 }}>{resetPwUser.full_name}</div>
              </div>
              <button onClick={() => setResetPwUser(null)} disabled={resetPwLoading}
                style={{ background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:24,lineHeight:1 }}>×</button>
            </div>

            {/* Warning */}
            <div style={{ background:'rgba(255,184,76,0.08)',border:'1px solid rgba(255,184,76,0.25)',borderRadius:12,padding:'12px 14px',marginBottom:20,fontSize:12,color:'#FFB84C',display:'flex',gap:8,alignItems:'flex-start' }}>
              <span style={{ fontSize:16,flexShrink:0 }}>⚠️</span>
              <span>This will <strong>override</strong> the user's current password. They will be notified via in-app notification.</span>
            </div>

            {/* New Password */}
            <div style={{ marginBottom:14 }}>
              <label style={labelSx}>New Password *</label>
              <div style={{ position:'relative' }}>
                <input
                  type={resetPwShow.pw ? 'text' : 'password'}
                  value={resetPwForm.new_password}
                  onChange={e => setResetPwForm(f => ({ ...f, new_password: e.target.value }))}
                  placeholder="Min 8 characters"
                  style={{ ...inputSx, paddingRight: 44 }}
                />
                <button type="button" onClick={() => setResetPwShow(s => ({ ...s, pw: !s.pw }))}
                  style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:17,color:'var(--text-muted)',lineHeight:1 }}>
                  {resetPwShow.pw ? '🙈' : '👁️'}
                </button>
              </div>
              {/* Strength bar */}
              {resetPwForm.new_password && (() => {
                const pw = resetPwForm.new_password;
                const score = [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
                const colors = ['#FF5757','#FF5757','#FFB84C','#00E5A0','#00E5A0'];
                const labels = ['','Weak','Fair','Good','Strong'];
                return (
                  <div style={{ marginTop:8 }}>
                    <div style={{ display:'flex',gap:4,marginBottom:4 }}>
                      {[1,2,3,4].map(i => <div key={i} style={{ flex:1,height:3,borderRadius:99,background:i<=score?colors[score]:'rgba(255,255,255,0.1)',transition:'background 0.3s' }} />)}
                    </div>
                    <div style={{ fontSize:10,color:colors[score],fontWeight:700 }}>{labels[score]}</div>
                  </div>
                );
              })()}
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom:20 }}>
              <label style={labelSx}>Confirm Password *</label>
              <div style={{ position:'relative' }}>
                <input
                  type={resetPwShow.confirm ? 'text' : 'password'}
                  value={resetPwForm.confirm}
                  onChange={e => setResetPwForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Re-enter new password"
                  style={{ ...inputSx, paddingRight: 44 }}
                />
                <button type="button" onClick={() => setResetPwShow(s => ({ ...s, confirm: !s.confirm }))}
                  style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:17,color:'var(--text-muted)',lineHeight:1 }}>
                  {resetPwShow.confirm ? '🙈' : '👁️'}
                </button>
              </div>
              {resetPwForm.confirm && resetPwForm.new_password !== resetPwForm.confirm && (
                <div style={{ fontSize:11,color:'#FF5757',marginTop:4 }}>⚠️ Passwords do not match</div>
              )}
              {resetPwForm.confirm && resetPwForm.new_password === resetPwForm.confirm && resetPwForm.new_password.length >= 8 && (
                <div style={{ fontSize:11,color:'#00E5A0',marginTop:4 }}>✅ Passwords match</div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setResetPwUser(null)} disabled={resetPwLoading}
                style={{ background:'transparent',border:'1px solid var(--border)',borderRadius:10,padding:'11px 20px',color:'var(--text-secondary)',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'Outfit,sans-serif' }}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!resetPwForm.new_password || resetPwForm.new_password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
                  if (resetPwForm.new_password !== resetPwForm.confirm) { toast.error('Passwords do not match'); return; }
                  setResetPwLoading(true);
                  try {
                    const r = await adminAPI.resetPassword(resetPwUser.id, { new_password: resetPwForm.new_password });
                    toast.success(r.data.message || 'Password reset successfully!');
                    setResetPwUser(null);
                  } catch (err) { toast.error(err.response?.data?.message || 'Failed to reset password'); }
                  finally { setResetPwLoading(false); }
                }}
                disabled={resetPwLoading || !resetPwForm.new_password || resetPwForm.new_password !== resetPwForm.confirm || resetPwForm.new_password.length < 8}
                style={{ flex:1,background:'linear-gradient(135deg,#FFB84C,#FF6B35)',border:'none',borderRadius:10,padding:'12px 0',color:'white',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'Outfit,sans-serif',opacity:resetPwLoading||!resetPwForm.new_password||resetPwForm.new_password!==resetPwForm.confirm?0.6:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                {resetPwLoading
                  ? <><span className="spinner" style={{ width:16,height:16,borderWidth:2 }} />Resetting…</>
                  : '🔑 Reset Password'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ══ Create User Modal ══ */}
      {createUserModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:2200,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)',padding:20,overflowY:'auto' }}
          onClick={e => e.target === e.currentTarget && !createUserLoading && setCreateUserModal(false)}>
          <div style={{ background:'linear-gradient(145deg,#0e0e22,#161630)',border:'1px solid rgba(108,99,255,0.35)',borderRadius:20,width:'100%',maxWidth:580,padding:30,boxShadow:'0 40px 120px rgba(0,0,0,0.9)',margin:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24 }}>
              <div style={{ fontSize:20,fontWeight:800 }}>➕ Create New User</div>
              <button onClick={() => setCreateUserModal(false)} style={{ background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:24,lineHeight:1 }}>×</button>
            </div>

            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14 }}>
              <div><label style={labelSx}>Full Name *</label><input value={createUserForm.full_name} onChange={e => setCreateUserForm(f=>({...f,full_name:e.target.value}))} placeholder="John Doe" style={inputSx} /></div>
              <div><label style={labelSx}>Email *</label><input type="email" value={createUserForm.email} onChange={e => setCreateUserForm(f=>({...f,email:e.target.value}))} placeholder="user@example.com" style={inputSx} /></div>
              <div><label style={labelSx}>Phone *</label><input value={createUserForm.phone} onChange={e => setCreateUserForm(f=>({...f,phone:e.target.value}))} placeholder="10-digit mobile" style={inputSx} /></div>
              <div><label style={labelSx}>Gender</label>
                <select value={createUserForm.gender} onChange={e => setCreateUserForm(f=>({...f,gender:e.target.value}))} style={{...inputSx,width:'100%'}}>
                  <option value="">— Select —</option>
                  {['Male','Female','Transgender','Prefer not to say'].map(g=><option key={g} value={g.toLowerCase()}>{g}</option>)}
                </select>
              </div>
              <div><label style={labelSx}>Role</label>
                <select value={createUserForm.role} onChange={e => setCreateUserForm(f=>({...f,role:e.target.value}))} style={{...inputSx,width:'100%'}}>
                  <option value="user">👤 User</option>
                  <option value="admin">👑 Admin</option>
                </select>
              </div>
              <div><label style={labelSx}>Account Type</label>
                <select value={createUserForm.account_type} onChange={e => setCreateUserForm(f=>({...f,account_type:e.target.value}))} style={{...inputSx,width:'100%'}}>
                  <option value="savings">💰 Savings</option>
                  <option value="current">🏢 Current</option>
                </select>
              </div>
              <div><label style={labelSx}>Initial Balance (₹)</label><input type="number" min="0" value={createUserForm.initial_balance} onChange={e => setCreateUserForm(f=>({...f,initial_balance:e.target.value}))} placeholder="0" style={inputSx} /></div>
              <div><label style={labelSx}>Occupation</label><input value={createUserForm.occupation} onChange={e => setCreateUserForm(f=>({...f,occupation:e.target.value}))} placeholder="e.g. Software Engineer" style={inputSx} /></div>
            </div>

            <div style={{ marginBottom:18 }}>
              <label style={labelSx}>Password * (min 8 characters)</label>
              <div style={{ position:'relative' }}>
                <input type={createUserPwShow?'text':'password'} value={createUserForm.password} onChange={e => setCreateUserForm(f=>({...f,password:e.target.value}))} placeholder="Strong password" style={{...inputSx,paddingRight:44}} />
                <button type="button" onClick={() => setCreateUserPwShow(v=>!v)} style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:17,color:'var(--text-muted)',lineHeight:1 }}>
                  {createUserPwShow?'🙈':'👁️'}
                </button>
              </div>
            </div>

            <div style={{ background:'rgba(0,229,160,0.06)',border:'1px solid rgba(0,229,160,0.2)',borderRadius:10,padding:'10px 14px',marginBottom:20,fontSize:12,color:'var(--text-secondary)',lineHeight:1.6 }}>
              ℹ️ A UPI ID (<strong>{createUserForm.email ? `${createUserForm.email.split('@')[0]}@moneymitra` : '...'}</strong>) will be auto-created. User will receive a welcome notification.
            </div>

            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setCreateUserModal(false)} style={{ background:'transparent',border:'1px solid var(--border)',borderRadius:10,padding:'11px 20px',color:'var(--text-secondary)',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'Outfit,sans-serif' }}>Cancel</button>
              <button
                onClick={async () => {
                  const cf = createUserForm;
                  if (!cf.full_name || !cf.email || !cf.phone || !cf.password) { toast.error('Name, email, phone & password are required'); return; }
                  if (cf.password.length < 8) { toast.error('Password must be at least 8 chars'); return; }
                  if (!/^[6-9]\d{9}$/.test(cf.phone)) { toast.error('Enter a valid 10-digit Indian phone'); return; }
                  setCreateUserLoading(true);
                  try {
                    const r = await adminAPI.createUser({ ...cf, initial_balance: parseFloat(cf.initial_balance) || 0 });
                    toast.success(`✅ User created! Account #${r.data.data.accountNumber}`);
                    setCreateUserModal(false);
                    fetchUsers();
                  } catch (err) { toast.error(err.response?.data?.message || 'Failed to create user'); }
                  finally { setCreateUserLoading(false); }
                }}
                disabled={createUserLoading}
                style={{ flex:1,background:'linear-gradient(135deg,#6C63FF,#00E5A0)',border:'none',borderRadius:10,padding:'12px 0',color:'white',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'Outfit,sans-serif',opacity:createUserLoading?0.7:1 }}>
                {createUserLoading ? '⏳ Creating…' : '✅ Create User Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Admin Close Account Modal ══ */}
      {adminCloseModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:2200,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)',padding:20 }}
          onClick={e => e.target === e.currentTarget && !adminCloseLoading && setAdminCloseModal(null)}>
          <div style={{ background:'linear-gradient(145deg,#0e0e22,#1a0a0a)',border:'1px solid rgba(255,87,87,0.4)',borderRadius:20,width:'100%',maxWidth:460,padding:30,boxShadow:'0 40px 120px rgba(255,87,87,0.2)' }}>
            <div style={{ textAlign:'center',marginBottom:22 }}>
              <div style={{ fontSize:40,marginBottom:10 }}>⛔</div>
              <div style={{ fontSize:20,fontWeight:800,color:'#FF5757' }}>Close Account</div>
              <div style={{ fontSize:13,color:'var(--text-muted)',marginTop:4 }}>{adminCloseModal.full_name} · {adminCloseModal.email}</div>
            </div>

            <div style={{ background:'rgba(255,87,87,0.08)',border:'1px solid rgba(255,87,87,0.2)',borderRadius:12,padding:'12px 14px',marginBottom:20,fontSize:12,color:'#FFB84C',lineHeight:1.7 }}>
              ⚠️ This will <strong>permanently deactivate</strong> the account. The user will be logged out and notified. <strong>No password required</strong> for admin override.
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={labelSx}>Closure Reason (sent to user)</label>
              <textarea value={adminCloseForm.reason} onChange={e => setAdminCloseForm(f=>({...f,reason:e.target.value}))}
                placeholder="e.g. Suspicious activity, Policy violation…" rows={3}
                style={{...inputSx,resize:'vertical',lineHeight:1.6,minHeight:72}} />
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={labelSx}>Type CLOSE to confirm *</label>
              <input value={adminCloseForm.confirm_text} onChange={e => setAdminCloseForm(f=>({...f,confirm_text:e.target.value}))}
                placeholder="CLOSE"
                style={{ width:'100%',background:'rgba(255,255,255,0.04)',border:`2px solid ${adminCloseForm.confirm_text==='CLOSE'?'#FF5757':'var(--border)'}`,borderRadius:10,padding:'10px 14px',color:'white',fontSize:15,fontFamily:'Outfit,sans-serif',fontWeight:800,letterSpacing:3,outline:'none',boxSizing:'border-box' }} />
            </div>

            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setAdminCloseModal(null)} disabled={adminCloseLoading}
                style={{ background:'transparent',border:'1px solid var(--border)',borderRadius:10,padding:'11px 20px',color:'var(--text-secondary)',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'Outfit,sans-serif' }}>Cancel</button>
              <button
                onClick={async () => {
                  if (adminCloseForm.confirm_text !== 'CLOSE') { toast.error('Type CLOSE to confirm'); return; }
                  setAdminCloseLoading(true);
                  try {
                    const r = await adminAPI.closeUserAccount(adminCloseModal.id, { confirm_text:'CLOSE', reason: adminCloseForm.reason });
                    toast.success(r.data.message || 'Account closed');
                    setAdminCloseModal(null);
                    setShowDetail(false);
                    fetchUsers();
                  } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
                  finally { setAdminCloseLoading(false); }
                }}
                disabled={adminCloseLoading || adminCloseForm.confirm_text !== 'CLOSE'}
                style={{ flex:1,background:'linear-gradient(135deg,#FF5757,#c0392b)',border:'none',borderRadius:10,padding:'12px 0',color:'white',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'Outfit,sans-serif',opacity:adminCloseLoading||adminCloseForm.confirm_text!=='CLOSE'?0.6:1 }}>
                {adminCloseLoading ? '⏳ Closing…' : '⛔ Close Account Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
