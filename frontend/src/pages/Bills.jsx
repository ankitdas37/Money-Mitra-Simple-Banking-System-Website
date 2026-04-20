import React, { useEffect, useState } from 'react';
import { billAPI, accountAPI } from '../services/api';
import { formatINR, formatDate } from '../utils/helpers';
import toast from 'react-hot-toast';

// ── All 28 States + 8 UTs ─────────────────────────────────────────────
const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand',
  'Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
  'Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal',
  // UTs
  'Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu',
  'Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry',
];

// ── Service Providers by category + state ───────────────────────────────
const PROVIDERS = {
  electricity: {
    'Andhra Pradesh':       ['APSPDCL','APEPDCL'],
    'Arunachal Pradesh':    ['APDCL'],
    'Assam':                ['APDCL'],
    'Bihar':                ['NBPDCL','SBPDCL'],
    'Chhattisgarh':         ['CSPDCL'],
    'Goa':                  ['Goa Electricity Dept'],
    'Gujarat':              ['DGVCL','MGVCL','PGVCL','UGVCL'],
    'Haryana':              ['DHBVN','UHBVN'],
    'Himachal Pradesh':     ['HPSEBL'],
    'Jharkhand':            ['JBVNL'],
    'Karnataka':            ['BESCOM','GESCOM','HESCOM','MESCOM','CESC Mangalore'],
    'Kerala':               ['KSEB'],
    'Madhya Pradesh':       ['MPEB','MPPKVVCL','MPWZ'],
    'Maharashtra':          ['MSEDCL','Tata Power Mumbai','Adani Electricity Mumbai','BEST Mumbai'],
    'Manipur':              ['MSPDCL'],
    'Meghalaya':            ['MePDCL'],
    'Mizoram':              ['Mizoram Power & Electricity Dept'],
    'Nagaland':             ['DoP Nagaland'],
    'Odisha':               ['CESU','NESCO','SOUTHCO','WESCO'],
    'Punjab':               ['PSPCL'],
    'Rajasthan':            ['JVVNL','AVVNL','JdVVNL'],
    'Sikkim':               ['Sikkim Power Dept'],
    'Tamil Nadu':           ['TNEB / TANGEDCO'],
    'Telangana':            ['TSSPDCL','TSNPDCL'],
    'Tripura':              ['TSECL'],
    'Uttar Pradesh':        ['DVVNL','MVVNL','PuVVNL','PVVNL','Torrent Power (Agra)'],
    'Uttarakhand':          ['UPCL'],
    'West Bengal':          ['WBSEDCL','CESC Kolkata'],
    'Delhi':                ['BSES Rajdhani','BSES Yamuna','Tata Power Delhi'],
    'Chandigarh':           ['Chandigarh Electricity Dept'],
    'Puducherry':           ['PREDESCOS Puducherry'],
    'Jammu & Kashmir':      ['JKPDCL'],
    'Ladakh':               ['Ladakh Power Dept'],
    'Andaman & Nicobar Islands':['ANIIDCO'],
    'Lakshadweep':          ['Lakshadweep Electricity Dept'],
    'Dadra & Nagar Haveli and Daman & Diu': ['DDDPDCL'],
    'Goa':                  ['Goa Electricity Dept'],
  },
  water: {
    'Maharashtra':  ['MCGM (Mumbai)','PMC (Pune)','NMC (Nagpur)'],
    'Delhi':        ['Delhi Jal Board'],
    'Uttar Pradesh':['Jal Nigam UP'],
    'Karnataka':    ['BWSSB (Bengaluru)'],
    'Tamil Nadu':   ['CMWSSB (Chennai)','TWAD Board'],
    'Gujarat':      ['AMC (Ahmedabad)','SMC (Surat)'],
    'Rajasthan':    ['PHED Rajasthan','JMC Water'],
    'Telangana':    ['HMWSSB (Hyderabad)'],
    'Andhra Pradesh':['GWMC','GVMC'],
    'Punjab':       ['PWSSB'],
    'Haryana':      ['HSVP Water'],
    'West Bengal':  ['KMC Water (Kolkata)'],
    'Kerala':       ['KWA Kerala'],
    'Madhya Pradesh':['MP Jal Nigam'],
    'Bihar':        ['PHED Bihar'],
    'Odisha':       ['PHEO Odisha'],
  },
  mobile: {
    '': ['Jio Prepaid','Jio Postpaid','Airtel Prepaid','Airtel Postpaid',
         'Vi (Vodafone Idea) Prepaid','Vi (Vodafone Idea) Postpaid',
         'BSNL Prepaid','BSNL Postpaid','MTNL Mumbai','MTNL Delhi'],
  },
  broadband: {
    '': ['Jio Fiber','Airtel Xstream Fiber','ACT Fibernet','BSNL Broadband',
         'Excitel','Hathway','Den Networks','Tikona','YOU Broadband',
         'MTNL Broadband','Sify Broadband','RailWire'],
  },
  gas: {
    'Maharashtra':  ['Mahanagar Gas (MGL)','Adani Gas Mumbai'],
    'Gujarat':      ['Gujarat Gas','Adani Gas Gujarat','Sabarmati Gas'],
    'Delhi':        ['Indraprastha Gas (IGL)','Brahmaputra Gas'],
    'Uttar Pradesh':['Gail Gas','Green Gas Limited','AG&P Pratham'],
    'Rajasthan':    ['Adani Gas Rajasthan'],
    'Telangana':    ['Central UP Gas','TNGCL'],
    'Andhra Pradesh':['HPCL PNG'],
    'Karnataka':    ['GAIL Gas Karnataka'],
    'Tamil Nadu':   ['TIDCO PNG'],
    'West Bengal':  ['Bengal Gas','GAIL Gas WB'],
    'Punjab':       ['THINK Gas','Haryana City Gas'],
    'Haryana':      ['Haryana City Gas (HCGL)'],
    'Madhya Pradesh':['Avantika Gas','GAIL Gas MP'],
    'Odisha':       ['Odisha LNG'],
  },
  dth: {
    '': ['Tata Play (Tata Sky)','Airtel Digital TV','Dish TV','Sun Direct',
         'Videocon D2H / D2h','GTPL','NXT Digital','InCablenet'],
  },
  fastag: {
    '': ['Paytm Payments Bank FASTag','HDFC Bank FASTag','ICICI Bank FASTag',
         'SBI FASTag','Axis Bank FASTag','Kotak Bank FASTag','IDFC First FASTag',
         'Bank of Baroda FASTag','Airtel Payments Bank FASTag','IndusInd FASTag',
         'IDBI Bank FASTag','Punjab National Bank FASTag'],
  },
  insurance: {
    '': ['LIC of India','SBI Life Insurance','HDFC Life','ICICI Prudential Life',
         'Bajaj Allianz Life','Max Life Insurance','Kotak Life Insurance',
         'New India Assurance','United India Insurance','National Insurance',
         'Oriental Insurance','Reliance General Insurance','Tata AIG',
         'Care Health Insurance','Star Health Insurance','Niva Bupa'],
  },
  ott: {
    '': ['Netflix','Amazon Prime Video','Disney+ Hotstar','Sony LIV','ZEE5',
         'Apple TV+','YouTube Premium','Jio Cinema Premium','MX Player Gold',
         'Aha','Voot Select','ALTBalaji','Lionsgate Play'],
  },
  other: {
    '': ['HDFC Bank Credit Card','ICICI Bank Credit Card','SBI Card',
         'Axis Bank Credit Card','Kotak Credit Card','American Express',
         'IDFC First Credit Card','IndusInd Credit Card',
         'Standard Chartered Credit Card','Citibank Credit Card',
         'RBL Credit Card','Yes Bank Credit Card'],
  },
};

function getProviders(category, state) {
  const cat = PROVIDERS[category];
  if (!cat) return [];
  // If category has state-specific providers
  if (cat[state] && cat[state].length > 0) return cat[state];
  // Fallback: national providers stored under empty key ''
  if (cat['']) return cat[''];
  // If no exact match, return providers from any available state (fallback)
  const allVals = Object.values(cat).flat();
  return [...new Set(allVals)];
}

// ── Category definitions ───────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'electricity', label: 'Electricity', icon: '💡',  grad: 'linear-gradient(135deg,#3a2800,#7a5200)', color: '#f5a623' },
  { key: 'water',       label: 'Water',       icon: '🌊',  grad: 'linear-gradient(135deg,#002040,#004080)', color: '#4fc3f7' },
  { key: 'mobile',      label: 'Mobile',      icon: '📱',  grad: 'linear-gradient(135deg,#003010,#006030)', color: '#66bb6a' },
  { key: 'broadband',   label: 'Broadband',   icon: '📶',  grad: 'linear-gradient(135deg,#001440,#002880)', color: '#42a5f5' },
  { key: 'gas',         label: 'Gas',         icon: '🔥',  grad: 'linear-gradient(135deg,#400010,#800020)', color: '#ef5350' },
  { key: 'dth',         label: 'DTH / TV',    icon: '📺',  grad: 'linear-gradient(135deg,#280040,#500080)', color: '#ab47bc' },
  { key: 'fastag',      label: 'FASTag',      icon: '🚗',  grad: 'linear-gradient(135deg,#003838,#006060)', color: '#26c6da' },
  { key: 'insurance',   label: 'Insurance',   icon: '🛡️',  grad: 'linear-gradient(135deg,#1a1040,#362080)', color: '#7e57c2' },
  { key: 'ott',         label: 'OTT / Sub',   icon: '🎬',  grad: 'linear-gradient(135deg,#400000,#800000)', color: '#ff5722' },
  { key: 'other',       label: 'Credit Card', icon: '💳',  grad: 'linear-gradient(135deg,#1a0040,#340080)', color: '#ba68c8' },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

function daysUntilDue(due_date) {
  if (!due_date) return null;
  const diff = Math.ceil((new Date(due_date) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

function DueLabel({ due_date }) {
  const days = daysUntilDue(due_date);
  if (days === null) return null;
  if (days < 0)  return <span style={{ color: '#ff5757', fontSize: 12 }}>Overdue by {Math.abs(days)}d</span>;
  if (days === 0) return <span style={{ color: '#ffb84c', fontSize: 12 }}>Due Today!</span>;
  if (days <= 3)  return <span style={{ color: '#ffb84c', fontSize: 12 }}>Due in {days} day{days > 1 ? 's' : ''}</span>;
  return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Due in {days} days</span>;
}

// ── AutoPay toggle ─────────────────────────────────────────────────────────────
function AutoPayToggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)} style={{
      width: 40, height: 22, borderRadius: 11, cursor: 'pointer', flexShrink: 0,
      background: on ? 'var(--primary)' : 'rgba(255,255,255,0.15)',
      position: 'relative', transition: 'background 0.25s',
    }}>
      <div style={{
        position: 'absolute', top: 3, left: on ? 21 : 3, width: 16, height: 16,
        borderRadius: '50%', background: '#fff', transition: 'left 0.25s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}

// ── Main Bills Page ────────────────────────────────────────────────────────────
export default function Bills() {
  const [bills, setBills] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ account_id: '', biller_name: '', category: 'electricity', consumer_number: '', amount: '', due_date: '' });
  const [payModal, setPayModal] = useState(null);
  const [payAccountId, setPayAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoPay, setAutoPay] = useState(false);
  // NEW: state and provider selectors
  const [selectedState, setSelectedState] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');

  useEffect(() => {
    Promise.all([billAPI.getAll({ status: 'pending' }), billAPI.getAll({ status: 'overdue' }), accountAPI.getAll()])
      .then(([pend, over, accs]) => {
        const all = [...(pend.data.data || []), ...(over.data.data || [])];
        setBills(all);
        const active = accs.data.data.filter(a => a.status === 'active');
        setAccounts(active);
        if (active.length > 0) { setAddForm(f => ({ ...f, account_id: active[0].id })); setPayAccountId(active[0].id); }
      })
      .catch(() => toast.error('Failed to load bills'));
  }, []);

  const fetchBills = async () => {
    try {
      const [pend, over] = await Promise.all([billAPI.getAll({ status: 'pending' }), billAPI.getAll({ status: 'overdue' })]);
      setBills([...(pend.data.data || []), ...(over.data.data || [])]);
    } catch {}
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await billAPI.add({ ...addForm, category: selectedCategory?.key || addForm.category });
      toast.success('✅ Bill added!');
      setShowAdd(false);
      fetchBills();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handlePay = async () => {
    if (!payAccountId) return toast.error('Select account');
    setLoading(true);
    try {
      await billAPI.pay(payModal.id, { account_id: payAccountId });
      toast.success(`✅ ₹${payModal.amount} paid to ${payModal.biller_name}!`);
      setPayModal(null);
      fetchBills();
    } catch (err) { toast.error(err.response?.data?.message || 'Payment failed'); }
    finally { setLoading(false); }
  };

  const openAddForCategory = (cat) => {
    setSelectedCategory(cat);
    setAddForm(f => ({ ...f, category: cat.key, biller_name: '' }));
    setSelectedState('');
    setSelectedProvider('');
    setShowAdd(true);
  };

  // Sort bills: overdue first, then by due date
  const sortedBills = [...bills].sort((a, b) => {
    const da = daysUntilDue(a.due_date) ?? 9999;
    const db = daysUntilDue(b.due_date) ?? 9999;
    return da - db;
  });

  const totalDue = bills.reduce((s, b) => s + parseFloat(b.amount || 0), 0);

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">📄 Bills & Payments</h1>
        <p className="page-subtitle">Manage all utility bills & upcoming payments</p>
      </div>

      {/* ── Main two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT: Category Grid ── */}
        <div>
          {/* Summary bar */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Upcoming Bills', value: bills.length, color: 'var(--primary-light)' },
              { label: 'Total Due', value: formatINR(totalDue), color: 'var(--warning)' },
              { label: 'Overdue', value: bills.filter(b => (daysUntilDue(b.due_date) ?? 1) < 0).length, color: 'var(--error)' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, minWidth: 120, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Category label */}
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 16, letterSpacing: 0.5 }}>
            SELECT CATEGORY TO ADD A BILL
          </div>

          {/* Category grid — matches the screenshot */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.key} onClick={() => openAddForCategory(cat)} style={{
                background: cat.grad,
                border: `1px solid ${selectedCategory?.key === cat.key ? cat.color : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 18, padding: '22px 12px', cursor: 'pointer', textAlign: 'center',
                transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                boxShadow: selectedCategory?.key === cat.key ? `0 0 0 2px ${cat.color}44, 0 8px 24px rgba(0,0,0,0.3)` : '0 4px 16px rgba(0,0,0,0.2)',
                transform: selectedCategory?.key === cat.key ? 'translateY(-2px) scale(1.03)' : 'none',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 0 0 1px ${cat.color}66, 0 12px 28px rgba(0,0,0,0.35)`; }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = selectedCategory?.key === cat.key ? 'translateY(-2px) scale(1.03)' : 'none';
                  e.currentTarget.style.boxShadow = selectedCategory?.key === cat.key ? `0 0 0 2px ${cat.color}44, 0 8px 24px rgba(0,0,0,0.3)` : '0 4px 16px rgba(0,0,0,0.2)';
                }}
              >
                {/* Icon circle */}
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: `${cat.color}22`, border: `1.5px solid ${cat.color}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
                }}>
                  {cat.icon}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 0.2 }}>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Add Bill Form — appears below grid when category selected */}
          {showAdd && selectedCategory && (
            <div className="glass-card" style={{ padding: 24, marginTop: 20, border: `1px solid ${selectedCategory.color}44` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <span style={{ fontSize: 28 }}>{selectedCategory.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Add {selectedCategory.label} Bill</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select your state and service provider</div>
                </div>
                <button onClick={() => setShowAdd(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
              </div>

              <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                {/* Step 1: State selector (only for state-specific categories) */}
                {!PROVIDERS[selectedCategory.key]?.[''] && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      🗺️ Select State / UT *
                    </label>
                    <select className="input-field" value={selectedState}
                      onChange={e => { setSelectedState(e.target.value); setSelectedProvider(''); setAddForm(f => ({ ...f, biller_name: '' })); }}
                      style={{ background: 'var(--bg-input)' }} required>
                      <option value="" style={{ background: '#1a1a3e' }}>-- Choose your State / UT --</option>
                      {INDIAN_STATES.map(s => (
                        <option key={s} value={s} style={{ background: '#1a1a3e' }}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Step 2: Service Provider selector */}
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    🏢 Service Provider *
                  </label>
                  {(() => {
                    const providers = getProviders(selectedCategory.key, selectedState);
                    const needsState = !PROVIDERS[selectedCategory.key]?.[''] && !selectedState;
                    return (
                      <select className="input-field" value={selectedProvider}
                        onChange={e => { setSelectedProvider(e.target.value); setAddForm(f => ({ ...f, biller_name: e.target.value })); }}
                        style={{ background: 'var(--bg-input)' }}
                        required disabled={needsState}>
                        <option value="" style={{ background: '#1a1a3e' }}>
                          {needsState ? '-- Select State first --' : '-- Select Service Provider --'}
                        </option>
                        {providers.map(p => (
                          <option key={p} value={p} style={{ background: '#1a1a3e' }}>{p}</option>
                        ))}
                        <option value="__other__" style={{ background: '#1a1a3e' }}>Other (type manually)</option>
                      </select>
                    );
                  })()}
                </div>

                {/* If "Other" selected, show manual biller name input */}
                {(selectedProvider === '__other__' || (selectedProvider === '' && addForm.biller_name === '__other__')) && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      ✏️ Biller Name *
                    </label>
                    <input type="text" className="input-field" placeholder={`Enter ${selectedCategory.label} provider name`}
                      value={addForm.biller_name === '__other__' ? '' : addForm.biller_name}
                      onChange={e => setAddForm(f => ({ ...f, biller_name: e.target.value }))}
                      required />
                  </div>
                )}

                {/* Confirmed provider banner */}
                {selectedProvider && selectedProvider !== '__other__' && (
                  <div style={{ gridColumn: '1/-1', background: `${selectedCategory.color}12`, border: `1px solid ${selectedCategory.color}33`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{selectedCategory.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedProvider}</div>
                      {selectedState && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedState}</div>}
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 18 }}>✅</span>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Consumer / Account No.</label>
                  <input type="text" className="input-field" placeholder="Consumer number"
                    value={addForm.consumer_number} onChange={e => setAddForm(f => ({ ...f, consumer_number: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Amount (₹) *</label>
                  <input type="number" className="input-field" placeholder="0.00" min="1" required
                    value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Due Date</label>
                  <input type="date" className="input-field"
                    value={addForm.due_date} onChange={e => setAddForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Pay From Account</label>
                  <select className="input-field" value={addForm.account_id} onChange={e => setAddForm(f => ({ ...f, account_id: e.target.value }))} style={{ background: 'var(--bg-input)' }}>
                    {accounts.map(acc => <option key={acc.id} value={acc.id} style={{ background: '#1a1a3e' }}>{acc.account_type.toUpperCase()} ···{acc.account_number.slice(-4)} — {formatINR(acc.balance)}</option>)}
                  </select>
                </div>

                <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn-primary" style={{ flex: 2 }}
                    disabled={!addForm.biller_name || addForm.biller_name === '__other__'}>
                    ➕ Add {selectedCategory.label} Bill
                  </button>
                  <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* ── RIGHT: Upcoming Bills Panel ── */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }}>
            {/* Panel header */}
            <div style={{ padding: '20px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Upcoming Bills</div>
              <button onClick={() => { setSelectedCategory(null); setShowAdd(true); setAddForm(f => ({ ...f, biller_name: '', category: 'other' })); }}
                style={{ background: 'none', border: 'none', color: '#00c896', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                + Add Bill
              </button>
            </div>

            {/* Bills list */}
            <div style={{ padding: '0 0 8px' }}>
              {sortedBills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
                  <div style={{ fontWeight: 600 }}>No upcoming bills!</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Add a bill to track it here</div>
                </div>
              ) : sortedBills.map(bill => {
                const cat = CAT_MAP[bill.category] || CAT_MAP.other;
                const days = daysUntilDue(bill.due_date);
                const isOverdue = days !== null && days < 0;
                const isUrgent = days !== null && days <= 3 && days >= 0;
                return (
                  <div key={bill.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: isOverdue ? 'rgba(255,87,87,0.04)' : isUrgent ? 'rgba(255,184,76,0.04)' : 'transparent',
                    transition: 'background 0.2s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(108,99,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = isOverdue ? 'rgba(255,87,87,0.04)' : isUrgent ? 'rgba(255,184,76,0.04)' : 'transparent'}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, background: cat.grad,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
                    }}>
                      {cat.icon}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {bill.biller_name}
                      </div>
                      <DueLabel due_date={bill.due_date} />
                    </div>

                    {/* Amount + Pay */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>₹{parseFloat(bill.amount).toFixed(2)}</div>
                      <button onClick={() => setPayModal(bill)} style={{
                        background: 'transparent', border: `1px solid #00c896`,
                        borderRadius: 8, padding: '4px 14px', cursor: 'pointer',
                        color: '#00c896', fontSize: 12, fontWeight: 700,
                        fontFamily: 'Outfit, sans-serif', transition: 'all 0.18s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#00c896'; e.currentTarget.style.color = '#000'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#00c896'; }}
                      >
                        Pay
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total row */}
            {sortedBills.length > 0 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(108,99,255,0.04)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Total Outstanding</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--warning)' }}>{formatINR(totalDue)}</span>
              </div>
            )}

            {/* AutoPay row */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(108,99,255,0.04)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(108,99,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                🔄
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Set up AutoPay</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Never miss a due date again.<br />Schedule automatic payments.
                </div>
              </div>
              <AutoPayToggle on={autoPay} onChange={(v) => { setAutoPay(v); toast.success(v ? '✅ AutoPay enabled' : 'AutoPay disabled'); }} />
            </div>
          </div>

          {/* Paid bills quick-view */}
          <div style={{ marginTop: 16, padding: '14px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={async () => {
              const res = await billAPI.getAll({ status: 'paid' });
              toast(`📋 ${res.data.data.length} bills paid this month`, { icon: '✅' });
            }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>📋 View Paid Bills</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>See payment history</div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>›</span>
          </div>
        </div>
      </div>

      {/* ── Pay Modal ── */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            {/* Bill icon + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: CAT_MAP[payModal.category]?.grad || '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
                {CAT_MAP[payModal.category]?.icon || '📋'}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{payModal.biller_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}><DueLabel due_date={payModal.due_date} /></div>
              </div>
            </div>

            {/* Amount banner */}
            <div style={{ background: 'var(--gradient-primary)', borderRadius: 14, padding: '18px 22px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, opacity: 0.9, fontWeight: 600 }}>Amount to Pay</span>
              <span style={{ fontSize: 30, fontWeight: 900 }}>{formatINR(payModal.amount)}</span>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Pay From Account</label>
              <select className="input-field" value={payAccountId} onChange={e => setPayAccountId(e.target.value)} style={{ background: 'var(--bg-input)' }}>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id} style={{ background: '#1a1a3e' }}>
                    {acc.account_type.toUpperCase()} ···{acc.account_number.slice(-4)} — {formatINR(acc.balance)}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handlePay} disabled={loading}>
                {loading ? '⏳ Processing...' : `✅ Pay ${formatINR(payModal.amount)}`}
              </button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setPayModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
