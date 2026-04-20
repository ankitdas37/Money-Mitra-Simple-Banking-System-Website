import React, { useEffect, useState } from 'react';
import { cardAPI, accountAPI } from '../services/api';
import { formatINR } from '../utils/helpers';
import toast from 'react-hot-toast';

const NET_GRAD = {
  visa:       'linear-gradient(135deg,#0d1b5e 0%,#1a3a8f 50%,#2451b3 100%)',
  mastercard: 'linear-gradient(135deg,#3a0a1e 0%,#7b1535 50%,#b01f4a 100%)',
  rupay:      'linear-gradient(135deg,#0a2e12 0%,#145c22 50%,#1e8a34 100%)',
};
const NET_LOGO = { visa: 'VISA', mastercard: '●● Mastercard', rupay: 'RuPay' };

// ── Toggle switch ──────────────────────────────────────────────────────────────
function Toggle({ on, onChange, disabled }) {
  return (
    <div onClick={() => !disabled && onChange(!on)} style={{
      width: 44, height: 24, borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
      background: on ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
      position: 'relative', transition: 'background 0.25s', flexShrink: 0,
      opacity: disabled ? 0.4 : 1,
    }}>
      <div style={{
        position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18,
        borderRadius: '50%', background: '#fff', transition: 'left 0.25s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
      }} />
    </div>
  );
}

// ── Card visual (the plastic look) ────────────────────────────────────────────
function CardVisual({ card, revealed }) {
  const frozen = card.is_frozen;
  return (
    <div style={{
      background: NET_GRAD[card.card_network] || NET_GRAD.rupay,
      borderRadius: 20, padding: '22px 24px', minHeight: 190,
      position: 'relative', overflow: 'hidden', color: '#fff',
      boxShadow: frozen ? 'none' : '0 16px 48px rgba(108,99,255,0.25)',
      filter: frozen ? 'grayscale(0.6)' : 'none',
      transition: 'all 0.3s',
    }}>
      {/* BG blobs */}
      <div style={{ position:'absolute', top:-30, right:-30, width:160, height:160, background:'rgba(255,255,255,0.04)', borderRadius:'50%' }} />
      <div style={{ position:'absolute', bottom:-40, left:40, width:180, height:180, background:'rgba(255,255,255,0.03)', borderRadius:'50%' }} />

      {frozen && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.25)', borderRadius:20, zIndex:3 }}>
          <div style={{ fontSize:52, opacity:0.7 }}>🔒</div>
        </div>
      )}

      <div style={{ position:'relative', zIndex:1 }}>
        {/* Top row */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {/* Chip */}
            <div style={{ width:36, height:28, background:'linear-gradient(135deg,#d4af37,#f5c842)', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:24, height:18, border:'1.5px solid rgba(180,140,0,0.5)', borderRadius:3, display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, padding:2 }}>
                {[0,1,2,3].map(i => <div key={i} style={{ background:'rgba(180,140,0,0.3)', borderRadius:1 }} />)}
              </div>
            </div>
            {/* NFC icon */}
            {card.nfc_enabled && (
              <div style={{ fontSize:18, opacity:0.8 }}>📡</div>
            )}
          </div>
          <div style={{ fontSize:14, fontWeight:800, letterSpacing:2, opacity:0.9 }}>
            {NET_LOGO[card.card_network]}
          </div>
        </div>

        {/* Card number */}
        <div style={{ fontSize:18, fontFamily:'monospace', fontWeight:700, letterSpacing:3, marginBottom:18 }}>
          {revealed
            ? revealed.card_number
            : card.card_number_masked?.replace(/X/g,'•') || '•••• •••• •••• ' + card.card_number_last4}
        </div>

        {/* Bottom row */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
          <div>
            <div style={{ fontSize:9, opacity:0.6, letterSpacing:1, marginBottom:2 }}>CARD HOLDER</div>
            <div style={{ fontSize:13, fontWeight:600, letterSpacing:0.5 }}>{card.name_on_card}</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:9, opacity:0.6, letterSpacing:1, marginBottom:2 }}>EXPIRES</div>
            <div style={{ fontSize:13, fontWeight:700 }}>{card.expiry_month}/{card.expiry_year}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:9, opacity:0.6, letterSpacing:1, marginBottom:2 }}>
              {card.card_type?.toUpperCase()}
            </div>
            <div style={{ fontSize:11, opacity:0.8 }}>
              {card.bank_name || 'Money Mitra Bank'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Cards page ────────────────────────────────────────────────────────────
export default function Cards() {
  const [cards, setCards] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ account_id:'', card_type:'debit', card_network:'rupay' });
  const [newCard, setNewCard] = useState(null);
  const [limitModal, setLimitModal] = useState(null);
  const [revealedCards, setRevealedCards] = useState({}); // id -> revealed data
  const [blockConfirm, setBlockConfirm] = useState(null); // card object
  const [deleteConfirm, setDeleteConfirm] = useState(null); // card object
  const [settingsLoading, setSettingsLoading] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [c, a] = await Promise.all([cardAPI.getAll(), accountAPI.getAll()]);
      setCards(c.data.data || []);
      const active = a.data.data.filter(acc => acc.status === 'active');
      setAccounts(active);
      if (active.length > 0) setCreateForm(f => ({ ...f, account_id: active[0].id }));
    } catch { toast.error('Failed to load cards'); }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await cardAPI.create(createForm);
      setNewCard(res.data.data);
      toast.success('🎴 Virtual card created!');
      setShowCreate(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create card');
    } finally { setLoading(false); }
  };

  const handleFreeze = async (id) => {
    try {
      const res = await cardAPI.toggleFreeze(id);
      setCards(prev => prev.map(c => c.id === id ? { ...c, is_frozen: res.data.data.is_frozen } : c));
      toast.success(res.data.message);
    } catch { toast.error('Failed to update card'); }
  };

  const handleReveal = async (card) => {
    if (revealedCards[card.id]) {
      setRevealedCards(prev => { const n = {...prev}; delete n[card.id]; return n; });
      return;
    }
    try {
      const res = await cardAPI.reveal(card.id);
      setRevealedCards(prev => ({ ...prev, [card.id]: res.data.data }));
      toast.success('Card details revealed — keep them safe!');
    } catch { toast.error('Failed to reveal card details'); }
  };

  const handleToggleSetting = async (card, setting, value) => {
    const key = card.id + setting;
    setSettingsLoading(p => ({ ...p, [key]: true }));
    try {
      await cardAPI.updateSettings(card.id, { [setting]: value });
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, [setting]: value } : c));
      const names = { online_enabled:'Online payments', international_enabled:'International transfers', nfc_enabled:'NFC / Tap & Pay' };
      toast.success(`${names[setting]} ${value ? 'enabled' : 'disabled'}`);
    } catch { toast.error('Failed to update setting'); }
    finally { setSettingsLoading(p => { const n={...p}; delete n[key]; return n; }); }
  };

  const handleUpdateLimit = async (id, limit) => {
    try {
      await cardAPI.updateLimit(id, { spending_limit: parseFloat(limit) });
      setCards(prev => prev.map(c => c.id === id ? { ...c, spending_limit: limit } : c));
      setLimitModal(null);
      toast.success('Spending limit updated');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handlePermanentBlock = async (card) => {
    try {
      await cardAPI.permanentBlock(card.id);
      setBlockConfirm(null);
      toast.success('🚫 Card permanently blocked');
      loadData();
    } catch { toast.error('Failed to block card'); }
  };

  const handleDelete = async (card) => {
    try {
      await cardAPI.deleteCard(card.id);
      setDeleteConfirm(null);
      setCards(prev => prev.filter(c => c.id !== card.id));
      toast.success(`Card ···${card.card_number_last4} deleted`);
    } catch { toast.error('Failed to delete card'); }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:32 }}>
        <div className="page-header" style={{ marginBottom:0 }}>
          <h1 className="page-title">💳 Virtual Cards</h1>
          <p className="page-subtitle">Manage your debit & credit cards</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>+ Generate Card</button>
      </div>

      {/* Create Card Panel */}
      {showCreate && (
        <div className="glass-card" style={{ padding:24, marginBottom:24 }}>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:18 }}>🎴 Generate New Virtual Card</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:18 }}>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:7 }}>Bank Account</label>
              <select className="input-field" value={createForm.account_id}
                onChange={e => setCreateForm(f => ({ ...f, account_id: e.target.value }))}
                style={{ background:'var(--bg-input)' }}>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id} style={{ background:'#1a1a3e' }}>
                    {acc.bank_name || 'Money Mitra Bank'} — {acc.account_type} ···{acc.account_number.slice(-4)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:7 }}>Card Type</label>
              <select className="input-field" value={createForm.card_type}
                onChange={e => setCreateForm(f => ({ ...f, card_type: e.target.value }))}
                style={{ background:'var(--bg-input)' }}>
                <option value="debit" style={{ background:'#1a1a3e' }}>💳 Debit Card</option>
                <option value="credit" style={{ background:'#1a1a3e' }}>💰 Credit Card</option>
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:7 }}>Network</label>
              <select className="input-field" value={createForm.card_network}
                onChange={e => setCreateForm(f => ({ ...f, card_network: e.target.value }))}
                style={{ background:'var(--bg-input)' }}>
                <option value="rupay" style={{ background:'#1a1a3e' }}>🇮🇳 RuPay</option>
                <option value="visa" style={{ background:'#1a1a3e' }}>💠 Visa</option>
                <option value="mastercard" style={{ background:'#1a1a3e' }}>🔴 Mastercard</option>
              </select>
            </div>
          </div>
          {/* Card preview */}
          <div style={{ maxWidth:340, marginBottom:18 }}>
            <CardVisual card={{ ...createForm, card_number_masked:'•••• •••• •••• ••••', card_number_last4:'••••', name_on_card:'YOUR NAME', expiry_month:'MM', expiry_year:'YY', nfc_enabled:true, bank_name: accounts.find(a=>a.id===createForm.account_id)?.bank_name || 'Money Mitra Bank' }} />
          </div>
          <button className="btn-primary" onClick={handleCreate} disabled={loading} style={{ padding:'12px 32px' }}>
            {loading ? '⏳ Generating...' : '🎴 Generate Card'}
          </button>
        </div>
      )}

      {/* Newly Created Card */}
      {newCard && (
        <div style={{ marginBottom:24, background:'rgba(0,229,160,0.06)', border:'1px solid rgba(0,229,160,0.25)', borderRadius:18, padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <span style={{ fontSize:28 }}>✅</span>
            <div>
              <div style={{ fontWeight:700, color:'var(--success)', fontSize:16 }}>New Card Generated!</div>
              <div style={{ fontSize:12, color:'var(--warning)' }}>⚠️ Save these details now — shown only once</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:16 }}>
            {[
              ['Card Number', newCard.card_number],
              ['CVV', newCard.cvv],
              ['Expiry', newCard.expiry],
              ['Network', newCard.card_network?.toUpperCase()],
              ['Type', newCard.card_type?.toUpperCase()],
            ].map(([label, value]) => (
              <div key={label} style={{ background:'rgba(0,0,0,0.2)', borderRadius:10, padding:'10px 14px' }}>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:0.8 }}>{label}</div>
                <div style={{ fontSize:label==='Card Number'?16:18, fontFamily:'monospace', fontWeight:700, letterSpacing: label==='Card Number'?2:0 }}>{value}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setNewCard(null)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:13 }}>✕ Dismiss</button>
        </div>
      )}

      {/* Cards Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))', gap:28 }}>
        {cards.map(card => {
          const revealed = revealedCards[card.id];
          const isRevealed = !!revealed;

          return (
            <div key={card.id}>
              {/* ── Card Visual ── */}
              <CardVisual card={card} revealed={revealed} />

              {/* ── Controls Panel ── */}
              <div className="glass-card" style={{ padding:20, marginTop:14 }}>

                {/* Bank + Type header */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700 }}>{card.bank_name || 'Money Mitra Bank'}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                      {card.card_network?.toUpperCase()} · {card.card_type?.toUpperCase()} · ···{card.card_number_last4}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <span className={`badge ${card.card_type==='credit'?'badge-warning':'badge-info'}`}>{card.card_type}</span>
                    <span className={`badge ${card.is_frozen?'badge-error':'badge-success'}`}>{card.is_frozen?'Frozen':'Active'}</span>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                  <div style={{ background:'var(--bg-input)', borderRadius:10, padding:'10px 12px' }}>
                    <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', marginBottom:3 }}>Daily Limit</div>
                    <div style={{ fontSize:15, fontWeight:700 }}>{formatINR(card.spending_limit)}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)' }}>Spent today: {formatINR(card.current_day_spent || 0)}</div>
                  </div>
                  {card.card_type === 'credit' ? (
                    <div style={{ background:'var(--bg-input)', borderRadius:10, padding:'10px 12px' }}>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', marginBottom:3 }}>Credit Limit</div>
                      <div style={{ fontSize:15, fontWeight:700 }}>{formatINR(card.credit_limit)}</div>
                      <div style={{ fontSize:10, color:'var(--warning)' }}>Due: {formatINR(card.outstanding_balance || 0)}</div>
                    </div>
                  ) : (
                    <div style={{ background:'var(--bg-input)', borderRadius:10, padding:'10px 12px' }}>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', marginBottom:3 }}>Linked Account</div>
                      <div style={{ fontFamily:'monospace', fontSize:14, fontWeight:700 }}>···{card.account_number?.slice(-4)}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>{card.account_type}</div>
                    </div>
                  )}
                </div>

                {/* ── Feature Toggles ── */}
                <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px', marginBottom:14 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:10, letterSpacing:0.5 }}>CARD CONTROLS</div>
                  {[
                    { key:'online_enabled',         icon:'🛒', label:'Online & E-Commerce',         desc:'Allow online purchases & shopping' },
                    { key:'international_enabled',  icon:'🌍', label:'International Transfers',      desc:'Allow overseas & cross-border payments' },
                    { key:'nfc_enabled',            icon:'📡', label:'NFC / Tap & Pay',              desc:'Contactless payments at POS terminals' },
                  ].map(({ key, icon, label, desc }) => (
                    <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, gap:10 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                          <span>{icon}</span> {label}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{desc}</div>
                      </div>
                      <Toggle
                        on={!!card[key]}
                        disabled={card.is_frozen}
                        onChange={val => handleToggleSetting(card, key, val)}
                      />
                    </div>
                  ))}
                </div>

                {/* ── Action Buttons row 1 ── */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
                  <button onClick={() => handleReveal(card)} style={{
                    background: isRevealed ? 'rgba(255,184,76,0.12)' : 'rgba(108,99,255,0.1)',
                    border: `1px solid ${isRevealed ? 'rgba(255,184,76,0.3)' : 'rgba(108,99,255,0.25)'}`,
                    borderRadius:10, padding:'9px 6px', cursor:'pointer', fontSize:12,
                    color: isRevealed ? 'var(--warning)' : 'var(--primary-light)',
                    fontFamily:'Outfit, sans-serif', fontWeight:600, transition:'all 0.2s'
                  }}>
                    {isRevealed ? '🙈 Hide' : '👁️ Reveal'}
                  </button>
                  <button onClick={() => handleFreeze(card.id)} style={{
                    background: card.is_frozen ? 'rgba(0,229,160,0.1)' : 'rgba(108,99,255,0.1)',
                    border: `1px solid ${card.is_frozen ? 'rgba(0,229,160,0.25)' : 'rgba(108,99,255,0.25)'}`,
                    borderRadius:10, padding:'9px 6px', cursor:'pointer', fontSize:12,
                    color: card.is_frozen ? 'var(--success)' : 'var(--primary-light)',
                    fontFamily:'Outfit, sans-serif', fontWeight:600, transition:'all 0.2s'
                  }}>
                    {card.is_frozen ? '🔓 Unfreeze' : '🔒 Freeze'}
                  </button>
                  <button onClick={() => setLimitModal(card)} style={{
                    background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)',
                    borderRadius:10, padding:'9px 6px', cursor:'pointer', fontSize:12,
                    color:'var(--text-secondary)', fontFamily:'Outfit, sans-serif', fontWeight:600
                  }}>
                    📊 Set Limit
                  </button>
                </div>

                {/* ── Action Buttons row 2 ── */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <button onClick={() => setBlockConfirm(card)} style={{
                    background:'rgba(255,184,76,0.06)', border:'1px solid rgba(255,184,76,0.2)',
                    borderRadius:10, padding:'9px 0', cursor:'pointer', fontSize:12,
                    color:'var(--warning)', fontFamily:'Outfit, sans-serif', fontWeight:600
                  }}>
                    🚫 Permanent Block
                  </button>
                  <button onClick={() => setDeleteConfirm(card)} style={{
                    background:'rgba(255,75,75,0.06)', border:'1px solid rgba(255,75,75,0.2)',
                    borderRadius:10, padding:'9px 0', cursor:'pointer', fontSize:12,
                    color:'var(--error)', fontFamily:'Outfit, sans-serif', fontWeight:600
                  }}>
                    🗑️ Delete Card
                  </button>
                </div>

                {/* Revealed details strip */}
                {isRevealed && (
                  <div style={{ marginTop:14, background:'rgba(255,184,76,0.06)', border:'1px solid rgba(255,184,76,0.2)', borderRadius:12, padding:'12px 16px' }}>
                    <div style={{ fontSize:11, color:'var(--warning)', fontWeight:700, marginBottom:8 }}>🔓 CARD DETAILS — Keep confidential</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <div>
                        <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>FULL CARD NUMBER</div>
                        <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, letterSpacing:2 }}>{revealed.card_number}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>CVV</div>
                        <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:14 }}>•••</div>
                        <div style={{ fontSize:10, color:'var(--text-muted)' }}>Check physical card or creation message</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:10, marginTop:10 }}>
                      <button onClick={() => { navigator.clipboard.writeText(revealed.card_number.replace(/\s/g,'')); toast.success('Card number copied!'); }}
                        style={{ background:'rgba(108,99,255,0.12)', border:'1px solid rgba(108,99,255,0.25)', borderRadius:8, padding:'5px 12px', cursor:'pointer', fontSize:11, color:'var(--primary-light)', fontFamily:'Outfit, sans-serif', fontWeight:600 }}>
                        📋 Copy Number
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {cards.length === 0 && (
          <div style={{ gridColumn:'1/-1' }}>
            <div className="empty-state">
              <div className="empty-state-icon">💳</div>
              <p>No cards yet. Generate your first virtual card!</p>
              <button className="btn-primary" style={{ marginTop:16 }} onClick={() => setShowCreate(true)}>+ Generate Card</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Set Limit Modal ── */}
      {limitModal && (
        <div className="modal-overlay" onClick={() => setLimitModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>📊 Update Daily Spending Limit</h3>
            <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:16 }}>
              Card ···{limitModal.card_number_last4} · Current: {formatINR(limitModal.spending_limit)}
            </p>
            <input type="number" className="input-field" placeholder="New limit (₹)" min="1000" max="500000"
              defaultValue={limitModal.spending_limit} id="newLimit" style={{ marginBottom:20 }} />
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn-primary" style={{ flex:1 }}
                onClick={() => handleUpdateLimit(limitModal.id, document.getElementById('newLimit').value)}>
                ✅ Save Limit
              </button>
              <button className="btn-secondary" style={{ flex:1 }} onClick={() => setLimitModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Permanent Block Confirm Modal ── */}
      {blockConfirm && (
        <div className="modal-overlay" onClick={() => setBlockConfirm(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ fontSize:52, marginBottom:12 }}>⛔</div>
              <h3 style={{ fontWeight:800, fontSize:18, marginBottom:8 }}>Permanently Block Card?</h3>
              <p style={{ fontSize:13, color:'var(--text-secondary)' }}>
                Card <strong>···{blockConfirm.card_number_last4}</strong> will be permanently blocked and <span style={{ color:'var(--error)' }}>cannot be reactivated</span>. This action is irreversible.
              </p>
            </div>
            <div style={{ background:'rgba(255,75,75,0.06)', border:'1px solid rgba(255,75,75,0.2)', borderRadius:10, padding:'12px 14px', marginBottom:20, fontSize:12, color:'var(--error)' }}>
              ⚠️ After blocking, you will need to generate a new card.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => handlePermanentBlock(blockConfirm)} style={{
                flex:2, padding:'12px 0', background:'rgba(255,75,75,0.15)', border:'1px solid rgba(255,75,75,0.4)',
                borderRadius:10, color:'var(--error)', fontFamily:'Outfit, sans-serif', fontWeight:700, cursor:'pointer', fontSize:14
              }}>🚫 Yes, Block Permanently</button>
              <button className="btn-secondary" style={{ flex:1 }} onClick={() => setBlockConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ fontSize:52, marginBottom:12 }}>🗑️</div>
              <h3 style={{ fontWeight:800, fontSize:18, marginBottom:8 }}>Delete Card?</h3>
              <p style={{ fontSize:13, color:'var(--text-secondary)' }}>
                Card <strong>···{deleteConfirm.card_number_last4}</strong> ({deleteConfirm.card_type}) will be permanently deleted from your account.
              </p>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => handleDelete(deleteConfirm)} style={{
                flex:2, padding:'12px 0', background:'rgba(255,75,75,0.12)', border:'1px solid rgba(255,75,75,0.3)',
                borderRadius:10, color:'var(--error)', fontFamily:'Outfit, sans-serif', fontWeight:700, cursor:'pointer', fontSize:14
              }}>🗑️ Yes, Delete</button>
              <button className="btn-secondary" style={{ flex:1 }} onClick={() => setDeleteConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
