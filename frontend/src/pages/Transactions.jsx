import React, { useEffect, useState, useCallback, useRef } from 'react';
import { transactionAPI, userAPI, accountAPI } from '../services/api';
import { formatINR, formatDateTime, TXN_STYLES } from '../utils/helpers';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Helpers ─────────────────────────────────────────────────────────────────
// toINR — used in the UI (supports ₹)
function toINR(v) {
  return '₹' + parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// fmtPDF — jsPDF built-in fonts DO NOT support ₹ symbol, use Rs. instead
function fmtPDF(v) {
  const abs = Math.abs(parseFloat(v || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return 'Rs. ' + abs;
}

function fmtPDFSigned(v, isCredit) {
  const abs = Math.abs(parseFloat(v || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (isCredit ? '+ Rs. ' : '- Rs. ') + abs;
}

// ── PDF Generator ────────────────────────────────────────────────────────────

// Helper: load image URL → base64 dataURL
async function loadImageAsBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function generatePDF({ user, accounts, transactions, filters }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const navy = [13, 20, 60];
  const purple = [108, 99, 255];
  const green = [0, 200, 150];
  const gray = [120, 130, 160];
  const light = [230, 232, 245];
  const white = [255, 255, 255];

  // Load logo
  const logoBase64 = await loadImageAsBase64('/logo.png');

  // ── PAGE 1: Account Details ────────────────────────────────────────────────
  // Header navy background
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 60, 'F');
  // Purple left accent strip
  doc.setFillColor(...purple);
  doc.rect(0, 0, 4, 60, 'F');

  // Logo image
  if (logoBase64) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(10, 7, 44, 44, 6, 6, 'F');
    doc.addImage(logoBase64, 'PNG', 11, 8, 42, 42);
  } else {
    doc.setFillColor(...purple);
    doc.roundedRect(10, 7, 44, 44, 6, 6, 'F');
    doc.setTextColor(...white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('MM', 32, 34, { align: 'center' });
  }

  // Bank name + subtitle
  doc.setTextColor(...white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Money Mitra Bank', 62, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(200, 205, 240);
  doc.text('Account Statement & Transaction History', 62, 31);
  doc.setFontSize(8.5);
  doc.setTextColor(160, 170, 210);
  doc.text('Generated: ' + new Date().toLocaleString('en-IN'), 62, 39);
  doc.text('Ref: MM-STMT-' + Date.now().toString().slice(-8), 62, 46);
  // Green verified badge
  doc.setFillColor(...green);
  doc.roundedRect(62, 50, 46, 6, 2, 2, 'F');
  doc.setTextColor(...navy);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL BANK DOCUMENT', 65, 54.5);


  let y = 72;
  doc.setFillColor(...purple);
  doc.rect(10, y - 6, W - 20, 8, 'F');
  doc.setTextColor(...white);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ACCOUNT HOLDER INFORMATION', 14, y);
  y += 10;

  // User info grid
  const userRows = [
    ['Full Name', user.full_name || '-'],
    ['Username', user.username || '-'],
    ['Email Address', user.email || '-'],
    ['Phone Number', user.phone || '-'],
    ['Date of Birth', user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('en-IN') : '-'],
    ['KYC Status', user.kyc_status?.toUpperCase() || 'PENDING'],
    ['Member Since', user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN') : '-'],
  ];

  doc.setFillColor(...light);
  doc.rect(10, y - 3, W - 20, userRows.length * 8 + 4, 'F');

  userRows.forEach(([label, value], i) => {
    const row_y = y + i * 8;
    if (i % 2 === 0) {
      doc.setFillColor(220, 222, 240);
      doc.rect(10, row_y - 3, W - 20, 8, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...navy);
    doc.text(label + ':', 14, row_y + 2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 80);
    doc.text(String(value), 70, row_y + 2);
  });

  y += userRows.length * 8 + 10;

  // ── Section: Bank Accounts ─────────────────────────────────────────────────
  doc.setFillColor(...green);
  doc.rect(10, y - 6, W - 20, 8, 'F');
  doc.setTextColor(...white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('BANK ACCOUNT DETAILS', 14, y);
  y += 6;

  if (accounts.length === 0) {
    doc.setTextColor(...gray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('No accounts found.', 14, y + 8);
    y += 16;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Account Number', 'IFSC Code', 'Type', 'Status', 'Current Balance', 'Bank Name']],
      body: accounts.map(acc => [
        acc.account_number || '-',
        acc.ifsc_code || 'MMIB0001234',
        (acc.account_type || '').toUpperCase(),
        (acc.status || '').toUpperCase(),
        fmtPDF(acc.balance),
        acc.bank_name || 'Money Mitra Bank',
      ]),
      styles: { fontSize: 8.5, cellPadding: 3, font: 'helvetica' },
      headStyles: { fillColor: navy, textColor: white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [238, 240, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 38 },
        1: { fontStyle: 'bold', cellWidth: 28 },
        4: { halign: 'right', fontStyle: 'bold', textColor: [0, 140, 80] },
      },
      margin: { left: 10, right: 10 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // ── IFSC / Branch info box ─────────────────────────────────────────────────
  doc.setFillColor(235, 238, 255);
  doc.roundedRect(10, y, W - 20, 22, 3, 3, 'F');
  doc.setDrawColor(...purple);
  doc.setLineWidth(0.5);
  doc.roundedRect(10, y, W - 20, 22, 3, 3, 'D');
  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Bank Details', 14, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Bank Name: Money Mitra Bank Ltd.', 14, y + 13);
  doc.text('IFSC Code: MMIB0001234  |  Branch: Digital Banking Division  |  MICR: 400002001', 14, y + 19);

  // ── PAGE 2: Transaction History ────────────────────────────────────────────
  doc.addPage();

  // Header navy bg
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 48, 'F');
  // Purple accent
  doc.setFillColor(...purple);
  doc.rect(0, 0, 4, 48, 'F');

  // Logo (small version)
  if (logoBase64) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(10, 6, 34, 34, 5, 5, 'F');
    doc.addImage(logoBase64, 'PNG', 11, 7, 32, 32);
  }

  doc.setTextColor(...white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Transaction History', 52, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(180, 185, 220);
  doc.text('Account Holder: ' + (user.full_name || '-') + '  |  Period: ' + (filters.start_date || 'All') + ' to ' + (filters.end_date || 'Present'), 52, 27);
  doc.text('Total Transactions: ' + transactions.length, 52, 34);
  doc.setFontSize(7.5);
  doc.setTextColor(140, 150, 200);
  doc.text('Generated: ' + new Date().toLocaleString('en-IN'), 52, 41);

  // Summary stats
  const creditTypes = ['credit', 'upi_receive', 'loan_credit', 'refund'];
  const totalCredit = transactions.filter(t => creditTypes.includes(t.type)).reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const totalDebit = transactions.filter(t => !creditTypes.includes(t.type)).reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const netFlow = totalCredit - totalDebit;

  y = 56;
  const statBoxes = [
    { label: 'Total Credits', value: fmtPDF(totalCredit), color: [0, 150, 90] },
    { label: 'Total Debits', value: fmtPDF(totalDebit), color: [210, 50, 50] },
    { label: 'Net Flow', value: (netFlow >= 0 ? '+' : '-') + ' Rs. ' + Math.abs(netFlow).toLocaleString('en-IN', { minimumFractionDigits: 2 }), color: netFlow >= 0 ? [0, 150, 90] : [210, 50, 50] },
    { label: 'Transactions', value: String(transactions.length) + ' records', color: [80, 70, 200] },
  ];

  const bw = (W - 20 - 9) / 4;
  statBoxes.forEach((s, i) => {
    const bx = 10 + i * (bw + 3);
    doc.setFillColor(...light);
    doc.roundedRect(bx, y, bw, 20, 2, 2, 'F');
    // colored left stripe
    doc.setFillColor(...s.color);
    doc.roundedRect(bx, y, 2, 20, 1, 1, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...gray);
    doc.text(s.label, bx + 5, y + 7);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...s.color);
    // Wrap long amounts
    doc.text(s.value, bx + 5, y + 15, { maxWidth: bw - 6 });
  });

  y += 28;

  // Transaction table
  if (transactions.length === 0) {
    doc.setTextColor(...gray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('No transactions found for the selected filters.', 14, y + 20);
  } else {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Date & Time', 'Type', 'Description', 'Reference No.', 'Amount', 'Bal. After', 'Status']],
      body: transactions.map((txn, idx) => {
        const isCredit = ['credit', 'upi_receive', 'loan_credit', 'refund'].includes(txn.type);
        const style = TXN_STYLES[txn.type] || TXN_STYLES.debit;
        return [
          idx + 1,
          txn.created_at ? new Date(txn.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '-',
          style.label,
          txn.description || '-',
          txn.reference_number || '-',
          fmtPDFSigned(txn.amount, isCredit),
          txn.balance_after != null ? fmtPDF(txn.balance_after) : '-',
          (txn.status || '').toUpperCase(),
        ];
      }),
      styles: { fontSize: 7.5, cellPadding: 2.5, font: 'helvetica', overflow: 'ellipsize' },
      headStyles: { fillColor: navy, textColor: white, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [244, 245, 255] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 26 },
        2: { cellWidth: 20 },
        3: { cellWidth: 42 },
        4: { cellWidth: 30, fontSize: 7 },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 16, halign: 'center' },
      },
      didParseCell(data) {
        if (data.column.index === 5 && data.section === 'body') {
          const row = transactions[data.row.index];
          const isCredit = ['credit', 'upi_receive', 'loan_credit', 'refund'].includes(row?.type);
          data.cell.styles.textColor = isCredit ? [0, 140, 80] : [200, 40, 40];
        }
        if (data.column.index === 6 && data.section === 'body') {
          data.cell.styles.textColor = [60, 80, 140];
        }
        if (data.column.index === 7 && data.section === 'body') {
          const status = String(data.cell.raw);
          data.cell.styles.textColor = status === 'COMPLETED' ? [0, 140, 80] : status === 'FAILED' ? [200, 40, 40] : [160, 100, 0];
        }
      },
      margin: { left: 10, right: 10 },
    });
  }

  // ── Footer on every page ───────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...navy);
    doc.rect(0, H - 14, W, 14, 'F');
    doc.setTextColor(160, 170, 210);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Money Mitra Bank Ltd.  |  Digital Banking Division  |  support@moneymitra.in  |  1800-XXX-0000', 14, H - 7);
    doc.text(`Page ${i} of ${pageCount}`, W - 24, H - 7);
    doc.setFontSize(6.5);
    doc.setTextColor(120, 130, 160);
    doc.text('⚠ CONFIDENTIAL: This statement is for personal use only. Do not share with unauthorized persons.', 14, H - 2.5);
  }

  // Download
  const filename = `MoneyMitra_Statement_${user.full_name?.replace(/\s+/g, '_') || 'User'}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}

// ── Transactions Page ────────────────────────────────────────────────────────
export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [filters, setFilters] = useState({ type: '', start_date: '', end_date: '', min_amount: '', max_amount: '', search: '' });
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [newTxnFlash, setNewTxnFlash] = useState(false);
  const [lastCount, setLastCount] = useState(0);
  const currentPageRef = useRef(1);
  const pollingRef = useRef(null);

  // Silent background fetch (no loading spinner, used for polling)
  const silentFetch = useCallback(async (page = 1) => {
    try {
      const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const res = await transactionAPI.getAll({ ...cleanFilters, page, limit: 20 });
      const newData = res.data.data || [];
      const newTotal = res.data.pagination?.total || 0;
      setTransactions(newData);
      setPagination(res.data.pagination || {});
      // Flash animation when new transactions appear
      setLastCount(prev => {
        if (newTotal > prev && prev > 0) {
          setNewTxnFlash(true);
          toast.success('🔄 New transaction received!', { duration: 2500, id: 'txn-live' });
          setTimeout(() => setNewTxnFlash(false), 1500);
        }
        return newTotal;
      });
    } catch { /* silent */ }
  }, [filters]);

  const fetchTxns = useCallback(async (page = 1) => {
    currentPageRef.current = page;
    setLoading(true);
    try {
      const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const res = await transactionAPI.getAll({ ...cleanFilters, page, limit: 20 });
      const newData = res.data.data || [];
      setTransactions(newData);
      setPagination(res.data.pagination || {});
      setLastCount(res.data.pagination?.total || 0);
    } catch { toast.error('Failed to load transactions'); }
    finally { setLoading(false); }
  }, [filters]);

  // Initial load
  useEffect(() => { fetchTxns(1); }, []);

  // Live polling every 10 seconds
  useEffect(() => {
    if (!isLive) { clearInterval(pollingRef.current); return; }
    pollingRef.current = setInterval(() => {
      silentFetch(currentPageRef.current);
    }, 10000);
    return () => clearInterval(pollingRef.current);
  }, [isLive, silentFetch]);

  // Listen for instant refresh when transfer completes on Transfer page
  useEffect(() => {
    const handler = () => {
      silentFetch(currentPageRef.current);
    };
    window.addEventListener('transfer-completed', handler);
    return () => window.removeEventListener('transfer-completed', handler);
  }, [silentFetch]);

  const handleSearch = (e) => { e.preventDefault(); fetchTxns(1); };
  const handleReset = () => {
    setFilters({ type: '', start_date: '', end_date: '', min_amount: '', max_amount: '', search: '' });
    setTimeout(() => fetchTxns(1), 100);
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      toast.loading('Preparing your statement PDF...', { id: 'pdf' });

      // Fetch ALL transactions matching current filters (no pagination limit)
      const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const [userRes, accRes, txnRes] = await Promise.all([
        userAPI.getProfile(),
        accountAPI.getAll(),
        transactionAPI.getAll({ ...cleanFilters, limit: 9999, page: 1 }),
      ]);

      const filename = await generatePDF({
        user: userRes.data.data,
        accounts: accRes.data.data || [],
        transactions: txnRes.data.data || [],
        filters,
      });

      toast.success(`📄 ${filename} downloaded!`, { id: 'pdf', duration: 4000 });
      setShowPdfModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF', { id: 'pdf' });
    } finally { setPdfLoading(false); }
  };

  return (
    <div>
      {/* Live pulse CSS */}
      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes txnFlash { 0%{background:rgba(0,229,160,0.18)} 100%{background:transparent} }
        .live-dot { width:8px;height:8px;border-radius:50%;background:#00e5a0;animation:livePulse 1.5s ease-in-out infinite; }
        .txn-flash { animation:txnFlash 1.2s ease-out; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">📊 Transaction History</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <p className="page-subtitle" style={{ margin: 0 }}>Complete record of all your financial activity</p>
            {/* Live Toggle */}
            <button
              onClick={() => setIsLive(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: isLive ? 'rgba(0,229,160,0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${isLive ? 'rgba(0,229,160,0.35)' : 'var(--border)'}`,
                borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif', fontSize: 12, fontWeight: 600,
                color: isLive ? '#00e5a0' : 'var(--text-muted)', transition: 'all 0.2s'
              }}
            >
              {isLive ? <span className="live-dot" /> : <span style={{ width:8,height:8,borderRadius:'50%',background:'var(--text-muted)',display:'inline-block' }} />}
              {isLive ? 'LIVE' : 'PAUSED'}
            </button>
          </div>
        </div>

        {/* Download PDF button */}
        <button onClick={() => setShowPdfModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg,#e53935,#c62828)',
            border: 'none', borderRadius: 12, padding: '12px 22px',
            cursor: 'pointer', color: '#fff', fontFamily: 'Outfit, sans-serif',
            fontWeight: 700, fontSize: 14, boxShadow: '0 4px 18px rgba(229,57,53,0.35)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
          <span style={{ fontSize: 18 }}>📄</span> Download Statement
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
        <form onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Search</label>
            <input type="text" className="input-field" placeholder="Description or ref no."
              value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Type</label>
            <select className="input-field" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} style={{ background: 'var(--bg-input)' }}>
              <option value="" style={{ background: '#1a1a3e' }}>All Types</option>
              {Object.entries(TXN_STYLES).map(([k, v]) => <option key={k} value={k} style={{ background: '#1a1a3e' }}>{v.icon} {v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>From Date</label>
            <input type="date" className="input-field" value={filters.start_date} onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>To Date</label>
            <input type="date" className="input-field" value={filters.end_date} onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} />
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '12px 20px' }}>🔍</button>
          <button type="button" className="btn-secondary" onClick={handleReset} style={{ padding: '12px 20px' }}>↺</button>
        </form>
      </div>

      {/* Amount Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>₹</span>
          <input type="number" placeholder="Min amount" value={filters.min_amount}
            onChange={e => setFilters(f => ({ ...f, min_amount: e.target.value }))}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', fontSize: 13, width: 100, outline: 'none' }} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
          <input type="number" placeholder="Max amount" value={filters.max_amount}
            onChange={e => setFilters(f => ({ ...f, max_amount: e.target.value }))}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', fontSize: 13, width: 100, outline: 'none' }} />
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          {pagination.total || 0} transactions found
        </div>
      </div>

      {/* Transactions Table */}
      <div className={`glass-card ${newTxnFlash ? 'txn-flash' : ''}`} style={{ overflow: 'hidden', transition: 'background 0.3s' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
        ) : transactions.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">📊</div><p>No transactions found</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>From / To</th>
                <th>Date & Time</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(txn => {
                const style = TXN_STYLES[txn.type] || TXN_STYLES.debit;
                // Credit types = money coming IN to the user
                const CREDIT_TYPES = ['credit', 'upi_receive', 'loan_credit', 'refund', 'loan_disbursement'];
                const isCredit = CREDIT_TYPES.includes(txn.type);

                // Direction label + colors
                const dirLabel  = isCredit ? 'Credit' : 'Debit';
                const dirColor  = isCredit ? 'var(--success)' : 'var(--error)';
                const dirBg     = isCredit ? 'rgba(0,229,160,0.10)' : 'rgba(255,87,87,0.10)';
                const dirBorder = isCredit ? 'rgba(0,229,160,0.25)' : 'rgba(255,87,87,0.25)';
                const dirArrow  = isCredit ? '↓' : '↑';
                const dirSign   = isCredit ? '+' : '−';   // minus sign, not hyphen

                return (
                  <tr key={txn.id}>
                    {/* Type column */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: dirBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: `1px solid ${dirBorder}` }}>
                          {dirArrow}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: dirColor }}>{dirLabel}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{style.icon} {style.label}</div>
                        </div>
                      </div>
                    </td>

                    {/* Description column */}
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 600, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{txn.description || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{txn.reference_number}</div>
                      {txn.fraud_flagged && <div style={{ fontSize: 10, color: 'var(--warning)', marginTop: 2 }}>⚠️ Fraud Flagged</div>}
                    </td>

                    {/* From / To column */}
                    <td>
                      <div style={{ fontSize: 12 }}>
                        {txn.type === 'transfer' && txn.to_user_name && (
                          <span style={{ color: 'var(--error)' }}>↑ To: <strong>{txn.to_user_name}</strong></span>
                        )}
                        {txn.type === 'credit' && txn.from_user_name && (
                          <span style={{ color: 'var(--success)' }}>↓ From: <strong>{txn.from_user_name}</strong></span>
                        )}
                        {!['transfer', 'credit'].includes(txn.type) && (
                          <>
                            {txn.from_user_name && <span>↑ {txn.from_user_name}</span>}
                            {txn.to_user_name && <span style={{ display: 'block' }}>↓ {txn.to_user_name}</span>}
                            {!txn.from_user_name && !txn.to_user_name && '—'}
                          </>
                        )}
                      </div>
                    </td>

                    {/* Date column */}
                    <td><div style={{ fontSize: 12 }}>{formatDateTime(txn.created_at)}</div></td>

                    {/* Amount column */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: dirColor, letterSpacing: '-0.5px' }}>
                        {dirSign} {formatINR(txn.amount)}
                      </div>
                      {txn.balance_after !== null && txn.balance_after !== undefined && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bal: {formatINR(txn.balance_after)}</div>
                      )}
                    </td>

                    {/* Status column */}
                    <td>
                      <span className={`badge ${txn.status === 'completed' ? 'badge-success' : txn.status === 'failed' ? 'badge-error' : 'badge-warning'}`}>
                        {txn.status}
                      </span>
                    </td>
                  </tr>
                );
              })}


            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
            {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => fetchTxns(p)} style={{
                width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: pagination.page === p ? 'var(--gradient-primary)' : 'var(--bg-card)',
                color: pagination.page === p ? 'white' : 'var(--text-secondary)',
                fontWeight: 600, fontSize: 13, fontFamily: 'Outfit, sans-serif',
                border: pagination.page !== p ? '1px solid var(--border)' : 'none'
              }}>{p}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── PDF Download Modal ────────────────────────────────────────────────── */}
      {showPdfModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          backdropFilter: 'blur(8px)',
        }} onClick={e => { if (e.target === e.currentTarget) setShowPdfModal(false); }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 22,
            padding: 32, maxWidth: 480, width: '100%', boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          }}>
            {/* Icon */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 56, marginBottom: 10 }}>📄</div>
              <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Download Account Statement</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Your PDF will include full account details and all transaction history
              </div>
            </div>

            {/* What's included */}
            <div style={{ background: 'rgba(108,99,255,0.07)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 14, padding: '14px 18px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-light)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Included in PDF</div>
              {[
                ['👤', 'Full Name, Email & Phone Number'],
                ['🏦', 'Account Number & IFSC Code'],
                ['💳', 'Account Type, Balance & Bank Name'],
                ['🔐', 'KYC Status & Member Since Date'],
                ['📊', 'Complete Transaction History'],
                ['📈', 'Credit / Debit Summary & Net Flow'],
              ].map(([icon, text]) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7, fontSize: 13 }}>
                  <span>{icon}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{text}</span>
                </div>
              ))}
            </div>

            {/* Security note */}
            <div style={{ background: 'rgba(255,184,76,0.07)', border: '1px solid rgba(255,184,76,0.25)', borderRadius: 12, padding: '10px 14px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>🔒</span>
              <div style={{ fontSize: 12, color: 'var(--warning)' }}>
                <strong>Security Notice:</strong> Password is never included in statements. Keep this PDF confidential — it contains sensitive financial information.
              </div>
            </div>

            {/* Current filters */}
            {(filters.start_date || filters.end_date || filters.type) && (
              <div style={{ background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                📅 Applying current filters:
                {filters.type && ` Type: ${filters.type}`}
                {filters.start_date && ` | From: ${filters.start_date}`}
                {filters.end_date && ` | To: ${filters.end_date}`}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={handleDownloadPDF} disabled={pdfLoading} style={{
                flex: 2, padding: '14px 0', borderRadius: 12, border: 'none', cursor: pdfLoading ? 'not-allowed' : 'pointer',
                background: pdfLoading ? 'rgba(220,60,60,0.4)' : 'linear-gradient(135deg,#e53935,#c62828)',
                color: '#fff', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: pdfLoading ? 'none' : '0 4px 18px rgba(229,57,53,0.3)',
              }}>
                {pdfLoading ? (
                  <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block' }} /> Generating PDF...</>
                ) : (
                  <><span style={{ fontSize: 18 }}>⬇️</span> Download PDF Statement</>
                )}
              </button>
              <button onClick={() => setShowPdfModal(false)} className="btn-secondary" style={{ flex: 1, padding: '14px 0', fontSize: 14 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
