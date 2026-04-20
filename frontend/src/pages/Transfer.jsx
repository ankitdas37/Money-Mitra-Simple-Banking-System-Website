import React, { useEffect, useState } from 'react';
import { accountAPI, transactionAPI, beneficiaryAPI } from '../services/api';
import { formatINR, formatDateTime } from '../utils/helpers';
import toast from 'react-hot-toast';

const TABS = ['transfer', 'beneficiaries'];

const AVATAR_EMOJIS = ['🦊','🐺','🦋','🐉','🦅','🌸','⚡','🌙','🔮'];
const getAvatar = (id) => AVATAR_EMOJIS[(id - 1) % AVATAR_EMOJIS.length] || '👤';

export default function Transfer() {
  const [accounts, setAccounts]         = useState([]);
  const [directory, setDirectory]       = useState([]);   // all other users' accounts
  const [filteredDir, setFilteredDir]   = useState([]);
  const [dirSearch, setDirSearch]       = useState('');
  const [showPicker, setShowPicker]     = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState(null);

  const [beneficiaries, setBeneficiaries] = useState([]);
  const [form, setForm] = useState({ from_account_id: '', to_account_number: '', amount: '', description: '', category: 'transfer' });
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [balanceMap, setBalanceMap] = useState({});
  const [activeTab, setActiveTab]   = useState('transfer');

  // Add Beneficiary modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [benForm, setBenForm]   = useState({ account_number: '', nickname: '', bank_name: '', ifsc_code: '' });
  const [benLoading, setBenLoading] = useState(false);

  useEffect(() => {
    accountAPI.getAll().then(res => {
      const accs = res.data.data.filter(a => a.status === 'active');
      setAccounts(accs);
      if (accs.length > 0) setForm(f => ({ ...f, from_account_id: accs[0].id }));
      const map = {};
      accs.forEach(a => { map[a.id] = a.balance; });
      setBalanceMap(map);
    }).catch(() => toast.error('Failed to load accounts'));

    // Load all other users' accounts for recipient picker
    accountAPI.getDirectory()
      .then(res => {
        const dir = res.data.data || [];
        setDirectory(dir);
        setFilteredDir(dir);
      })
      .catch(() => {});

    loadBeneficiaries();
  }, []);

  // Filter directory by search
  useEffect(() => {
    if (!dirSearch.trim()) { setFilteredDir(directory); return; }
    const q = dirSearch.toLowerCase();
    setFilteredDir(directory.filter(a =>
      a.full_name.toLowerCase().includes(q) ||
      a.account_number.includes(q) ||
      a.account_type.toLowerCase().includes(q)
    ));
  }, [dirSearch, directory]);

  const loadBeneficiaries = () => {
    beneficiaryAPI.getAll()
      .then(res => setBeneficiaries(res.data.data || []))
      .catch(() => {});
  };

  const selectFromDirectory = (acc) => {
    setSelectedRecipient(acc);
    setForm(f => ({ ...f, to_account_number: acc.account_number }));
    setShowPicker(false);
    setDirSearch('');
    toast.success(`📋 Selected: ${acc.full_name}`);
  };

  const clearRecipient = () => {
    setSelectedRecipient(null);
    setForm(f => ({ ...f, to_account_number: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (parseFloat(form.amount) <= 0) return toast.error('Amount must be greater than ₹0');
    if (parseFloat(form.amount) > parseFloat(balanceMap[form.from_account_id] || 0)) {
      return toast.error('Insufficient balance');
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await transactionAPI.transfer({ ...form, amount: parseFloat(form.amount) });
      setResult(res.data.data);
      toast.success('✅ Transfer successful!');
      setBalanceMap(prev => ({ ...prev, [form.from_account_id]: res.data.data.new_balance }));
      setForm(f => ({ ...f, to_account_number: '', amount: '', description: '' }));
      setSelectedRecipient(null);
      window.dispatchEvent(new CustomEvent('transfer-completed', { detail: res.data.data }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBeneficiary = async (e) => {
    e.preventDefault();
    setBenLoading(true);
    try {
      const res = await beneficiaryAPI.add(benForm);
      toast.success(res.data.message || 'Beneficiary added!');
      setBenForm({ account_number: '', nickname: '', bank_name: '', ifsc_code: '' });
      setShowAddModal(false);
      loadBeneficiaries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add beneficiary');
    } finally {
      setBenLoading(false);
    }
  };

  const handleDeleteBeneficiary = async (id, nickname) => {
    if (!window.confirm(`Remove "${nickname}" from your beneficiaries?`)) return;
    try {
      await beneficiaryAPI.remove(id);
      toast.success('Beneficiary removed');
      loadBeneficiaries();
    } catch {
      toast.error('Failed to remove beneficiary');
    }
  };

  const selectBeneficiary = (ben) => {
    setForm(f => ({ ...f, to_account_number: ben.account_number }));
    setSelectedRecipient({ full_name: ben.nickname, account_number: ben.account_number, account_type: 'saved', avatar_id: 1 });
    setActiveTab('transfer');
    toast.success(`Selected: ${ben.nickname}`);
  };

  const selectedBalance = balanceMap[form.from_account_id] || 0;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <style>{`
        .acc-card:hover { border-color: var(--primary) !important; transform: translateY(-1px); }
        .dir-row:hover  { background: rgba(108,99,255,0.08) !important; cursor: pointer; }
        .dir-row.selected { background: rgba(108,99,255,0.14) !important; border-color: var(--primary) !important; }
      `}</style>

      <div className="page-header">
        <h1 className="page-title">💸 Transfer Money</h1>
        <p className="page-subtitle">Send funds to any Money Mitra account instantly</p>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-card)', borderRadius: 12, padding: 4, border: '1px solid var(--border)' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 14, transition: 'all 0.2s',
            background: activeTab === tab ? 'var(--primary)' : 'transparent',
            color: activeTab === tab ? '#fff' : 'var(--text-muted)',
          }}>
            {tab === 'transfer' ? '🔁 Transfer' : `👥 Beneficiaries (${beneficiaries.length})`}
          </button>
        ))}
      </div>

      {/* ── TRANSFER TAB ─────────────────── */}
      {activeTab === 'transfer' && (
        <>
          {/* From Account Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            {accounts.map(acc => (
              <button key={acc.id} className="acc-card" onClick={() => setForm(f => ({ ...f, from_account_id: acc.id }))} style={{
                background: form.from_account_id === acc.id ? 'rgba(108,99,255,0.12)' : 'var(--bg-card)',
                border: `1px solid ${form.from_account_id === acc.id ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.2s', color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif'
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'capitalize' }}>{acc.account_type}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{formatINR(acc.balance)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>···· {acc.account_number.slice(-4)}</div>
              </button>
            ))}
          </div>

          <div className="glass-card" style={{ padding: 28 }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* From Account select */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  From Account <span style={{ color: 'var(--success)', fontSize: 12 }}>Balance: {formatINR(selectedBalance)}</span>
                </label>
                <select className="input-field" value={form.from_account_id} onChange={e => setForm({ ...form, from_account_id: e.target.value })}
                  style={{ background: 'var(--bg-input)' }}>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id} style={{ background: '#1a1a3e' }}>
                      {acc.account_type.toUpperCase()} — {acc.account_number} — {formatINR(acc.balance)}
                    </option>
                  ))}
                </select>
              </div>

              {/* ── Recipient Selector ── */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Recipient Account
                  </label>
                  <button type="button" onClick={() => setShowPicker(v => !v)} style={{
                    background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.3)',
                    borderRadius: 8, padding: '4px 12px', cursor: 'pointer',
                    color: 'var(--primary)', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 12,
                  }}>
                    {showPicker ? '✕ Close' : '👥 Browse All Users'}
                  </button>
                </div>

                {/* Selected recipient chip */}
                {selectedRecipient ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'rgba(0,229,160,0.07)', border: '1px solid rgba(0,229,160,0.25)',
                    borderRadius: 12, padding: '12px 16px', marginBottom: 10
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', background: 'rgba(108,99,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0
                    }}>
                      {getAvatar(selectedRecipient.avatar_id)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedRecipient.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {selectedRecipient.account_number} · {selectedRecipient.account_type?.toUpperCase()}
                      </div>
                    </div>
                    <button type="button" onClick={clearRecipient} style={{
                      background: 'rgba(255,87,87,0.1)', border: '1px solid rgba(255,87,87,0.25)',
                      borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--error)', fontSize: 14
                    }}>✕</button>
                  </div>
                ) : (
                  <input type="text" className="input-field" placeholder="Enter 12-digit account number or browse users ↑"
                    value={form.to_account_number} onChange={e => setForm({ ...form, to_account_number: e.target.value })}
                    required maxLength={18} />
                )}

                {/* ── User / Account Directory Picker ── */}
                {showPicker && (
                  <div style={{
                    marginTop: 10, background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.35)'
                  }}>
                    {/* Search bar */}
                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                      <input
                        type="text"
                        placeholder="🔍  Search by name or account number…"
                        value={dirSearch}
                        onChange={e => setDirSearch(e.target.value)}
                        autoFocus
                        style={{
                          width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
                          borderRadius: 9, padding: '9px 14px', color: 'var(--text-primary)',
                          fontFamily: 'Outfit, sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Account list */}
                    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                      {filteredDir.length === 0 ? (
                        <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                          No accounts found
                        </div>
                      ) : (
                        filteredDir.map(acc => (
                          <div
                            key={acc.id}
                            className={`dir-row${selectedRecipient?.account_number === acc.account_number ? ' selected' : ''}`}
                            onClick={() => selectFromDirectory(acc)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 14,
                              padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                              transition: 'all 0.15s',
                              background: selectedRecipient?.account_number === acc.account_number
                                ? 'rgba(108,99,255,0.14)' : 'transparent'
                            }}
                          >
                            {/* Avatar */}
                            <div style={{
                              width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                              background: 'rgba(108,99,255,0.15)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22
                            }}>
                              {getAvatar(acc.avatar_id)}
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{acc.full_name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 1 }}>
                                {acc.account_number}
                              </div>
                            </div>

                            {/* Account type badge */}
                            <div style={{
                              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                              background: 'rgba(108,99,255,0.12)', color: 'var(--primary)',
                              border: '1px solid rgba(108,99,255,0.25)', borderRadius: 6, padding: '3px 8px', flexShrink: 0
                            }}>
                              {acc.account_type}
                            </div>

                            {/* Select arrow */}
                            <div style={{ color: 'var(--text-muted)', fontSize: 18, flexShrink: 0 }}>›</div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Footer count */}
                    <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {filteredDir.length} account{filteredDir.length !== 1 ? 's' : ''} available
                    </div>
                  </div>
                )}

                {/* Saved Beneficiary Chips */}
                {!showPicker && beneficiaries.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Quick select from saved beneficiaries:</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {beneficiaries.map(ben => (
                        <button key={ben.id} type="button" onClick={() => selectBeneficiary(ben)} style={{
                          background: form.to_account_number === ben.account_number ? 'rgba(108,99,255,0.18)' : 'var(--bg-card)',
                          border: `1px solid ${form.to_account_number === ben.account_number ? 'var(--primary)' : 'var(--border)'}`,
                          borderRadius: 20, padding: '5px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                          fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', transition: 'all 0.18s'
                        }}>
                          <span style={{ fontSize: 16 }}>{ben.is_verified ? '✅' : '👤'}</span>
                          <span style={{ fontWeight: 600 }}>{ben.nickname}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>···{ben.account_number.slice(-4)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Amount (₹)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 18, fontWeight: 700 }}>₹</span>
                  <input type="number" className="input-field" placeholder="0.00" min="1" step="0.01"
                    value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                    required style={{ paddingLeft: 36 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {[500, 1000, 2000, 5000, 10000].map(amt => (
                    <button key={amt} type="button" onClick={() => setForm(f => ({ ...f, amount: amt }))} style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
                      padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)',
                      fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s'
                    }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Category</label>
                  <select className="input-field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    style={{ background: 'var(--bg-input)' }}>
                    {['transfer', 'family', 'rent', 'food', 'shopping', 'travel', 'general'].map(c => (
                      <option key={c} value={c} style={{ background: '#1a1a3e' }}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Remark (Optional)</label>
                  <input type="text" className="input-field" placeholder="Add a note..." maxLength={100}
                    value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>

              {parseFloat(form.amount) > 50000 && (
                <div style={{ background: 'rgba(255,184,76,0.08)', border: '1px solid rgba(255,184,76,0.2)', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)' }}>Large Transaction Notice</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Transactions above ₹50,000 are flagged for review. This is normal.</div>
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={loading || !form.from_account_id || !form.amount || !form.to_account_number}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    Processing Transfer...
                  </span>
                ) : `Send ${form.amount ? formatINR(form.amount) : '₹0.00'} →`}
              </button>
            </form>

            {result && (
              <div style={{ marginTop: 24, background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 32 }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: 16 }}>Transfer Successful!</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Your money has been sent</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    ['Amount Sent', formatINR(result.amount)],
                    ['New Balance', formatINR(result.new_balance)],
                    ['Reference', result.reference_number],
                    ['Status', '✅ Completed'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, fontFamily: label === 'Reference' ? 'monospace' : 'inherit' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── BENEFICIARIES TAB ─────────────────── */}
      {activeTab === 'beneficiaries' && (
        <div className="glass-card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Saved Beneficiaries</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Save recipients for faster future transfers</div>
            </div>
            <button onClick={() => setShowAddModal(true)} className="btn-primary" style={{ padding: '10px 18px', fontSize: 13 }}>
              + Add Beneficiary
            </button>
          </div>

          {beneficiaries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No beneficiaries yet</div>
              <div style={{ fontSize: 13 }}>Add one to transfer money faster next time</div>
              <button onClick={() => setShowAddModal(true)} className="btn-primary" style={{ marginTop: 20, padding: '10px 24px' }}>
                + Add First Beneficiary
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {beneficiaries.map(ben => (
                <div key={ben.id} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', background: 'rgba(108,99,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0
                  }}>
                    {ben.is_verified ? '✅' : '👤'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{ben.nickname}</span>
                      {ben.is_verified && (
                        <span style={{ fontSize: 10, background: 'rgba(0,229,160,0.1)', color: 'var(--success)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>
                          VERIFIED
                        </span>
                      )}
                    </div>
                    {ben.account_holder_name && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{ben.account_holder_name}</div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                      {ben.account_number} · {ben.bank_name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => selectBeneficiary(ben)} style={{
                      background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.25)',
                      borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: 'var(--primary)',
                      fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 13, transition: 'all 0.18s'
                    }}>Send ₹</button>
                    <button onClick={() => handleDeleteBeneficiary(ben.id, ben.nickname)} style={{
                      background: 'rgba(255,75,75,0.08)', border: '1px solid rgba(255,75,75,0.2)',
                      borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: 'var(--error)',
                      fontFamily: 'Outfit, sans-serif', fontSize: 16, transition: 'all 0.18s'
                    }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ADD BENEFICIARY MODAL ─────────────────── */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          backdropFilter: 'blur(4px)'
        }} onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18,
            padding: 32, width: '100%', maxWidth: 440, boxShadow: '0 24px 60px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>👥 Add Beneficiary</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Save a recipient for future transfers</div>
              </div>
              <button onClick={() => setShowAddModal(false)} style={{
                background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: 4
              }}>✕</button>
            </div>

            <form onSubmit={handleAddBeneficiary} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Account Number <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input type="text" className="input-field" placeholder="12-digit account number"
                  value={benForm.account_number} onChange={e => setBenForm({ ...benForm, account_number: e.target.value })}
                  required maxLength={18} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Nickname <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input type="text" className="input-field" placeholder="e.g. Mom, Landlord, Office Rent"
                  value={benForm.nickname} onChange={e => setBenForm({ ...benForm, nickname: e.target.value })}
                  required maxLength={60} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Bank Name</label>
                  <input type="text" className="input-field" placeholder="Money Mitra Bank"
                    value={benForm.bank_name} onChange={e => setBenForm({ ...benForm, bank_name: e.target.value })} maxLength={100} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>IFSC Code</label>
                  <input type="text" className="input-field" placeholder="MMIT0001001"
                    value={benForm.ifsc_code} onChange={e => setBenForm({ ...benForm, ifsc_code: e.target.value.toUpperCase() })} maxLength={11} />
                </div>
              </div>
              <div style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.15)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                💡 If the account exists in Money Mitra, it will be auto-verified and the holder name will be fetched.
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{
                  flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'Outfit, sans-serif',
                  fontWeight: 600, cursor: 'pointer', fontSize: 14
                }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={benLoading}>
                  {benLoading ? 'Saving...' : '+ Add Beneficiary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
