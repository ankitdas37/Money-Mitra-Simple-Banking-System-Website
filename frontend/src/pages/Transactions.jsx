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
  const navy   = [13, 20, 60];
  const purple = [108, 99, 255];
  const green  = [0, 180, 120];
  const teal   = [0, 180, 200];
  const gray   = [120, 130, 160];
  const light  = [235, 237, 252];
  const white  = [255, 255, 255];
  const gold   = [200, 150, 0];
  const red    = [220, 50, 50];

  const stmtRef = 'MM-STMT-' + Date.now().toString().slice(-8);
  const genDate = new Date().toLocaleString('en-IN');

  // Load logo & profile photo
  const logoBase64  = await loadImageAsBase64('/logo.png');
  const photoBase64 = user.profile_photo || null;

  // ─── HELPERS ──────────────────────────────────────────────────────────────────
  function drawPageHeader(pageTitle, pageSubtitle, bgH = 52) {
    doc.setFillColor(...navy);
    doc.rect(0, 0, W, bgH, 'F');
    doc.setFillColor(...purple);
    doc.rect(0, 0, 5, bgH, 'F');
    if (logoBase64) {
      doc.setFillColor(...white);
      doc.roundedRect(10, 7, 36, 36, 5, 5, 'F');
      doc.addImage(logoBase64, 'PNG', 11, 8, 34, 34);
    } else {
      doc.setFillColor(...purple);
      doc.roundedRect(10, 7, 36, 36, 5, 5, 'F');
      doc.setTextColor(...white); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text('MM', 28, 29, { align: 'center' });
    }
    doc.setTextColor(...white); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('Money Mitra Bank', 53, 19);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(200, 210, 250);
    doc.text(pageTitle, 53, 28);
    doc.setFontSize(7.5); doc.setTextColor(150, 160, 220);
    doc.text(pageSubtitle + '  |  Ref: ' + stmtRef, 53, 36);
    doc.text('Generated: ' + genDate, 53, 43);
    doc.setFillColor(...green);
    doc.roundedRect(W - 52, 15, 42, 7, 2, 2, 'F');
    doc.setTextColor(...navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
    doc.text('OFFICIAL DOCUMENT', W - 51, 20);
  }

  function drawSectionHeader(label, color, yPos) {
    doc.setFillColor(...color);
    doc.rect(10, yPos - 6, W - 20, 9, 'F');
    doc.setTextColor(...white); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text(label, 14, yPos);
  }

  function drawInfoGrid(rows, startY) {
    const rowH = 8;
    doc.setFillColor(...light);
    doc.rect(10, startY - 3, W - 20, rows.length * rowH + 4, 'F');
    rows.forEach(([label, value, vColor], i) => {
      const ry = startY + i * rowH;
      if (i % 2 === 0) { doc.setFillColor(220, 223, 248); doc.rect(10, ry - 3, W - 20, rowH, 'F'); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...navy);
      doc.text(label + ':', 14, ry + 2);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...(vColor || [40, 40, 90]));
      doc.text(String(value ?? '-'), 85, ry + 2);
    });
    return startY + rows.length * rowH + 6;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Profile Cover: Personal Info + Identity + KYC
  // ════════════════════════════════════════════════════════════════════════════
  drawPageHeader('Account Holder Statement', 'Complete Banking & Identity Report');
  let y = 60;

  // Profile hero card
  doc.setFillColor(240, 241, 255);
  doc.roundedRect(10, y, W - 20, 38, 4, 4, 'F');
  doc.setDrawColor(...purple); doc.setLineWidth(0.4);
  doc.roundedRect(10, y, W - 20, 38, 4, 4, 'D');

  const photoX = 18, photoY = y + 5, photoSize = 28;
  if (photoBase64) {
    try {
      doc.setFillColor(...white);
      doc.circle(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2 + 1, 'F');
      const fmt = photoBase64.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(photoBase64, fmt, photoX, photoY, photoSize, photoSize);
    } catch {
      doc.setFillColor(...purple);
      doc.circle(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 'F');
      doc.setTextColor(...white); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text((user.full_name || 'U')[0].toUpperCase(), photoX + photoSize / 2, photoY + photoSize / 2 + 4, { align: 'center' });
    }
  } else {
    doc.setFillColor(...purple);
    doc.circle(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 'F');
    doc.setTextColor(...white); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text((user.full_name || 'U')[0].toUpperCase(), photoX + photoSize / 2, photoY + photoSize / 2 + 4, { align: 'center' });
  }

  const nx = photoX + photoSize + 10;
  doc.setTextColor(...navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text(user.full_name || '-', nx, y + 13);
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 70, 130);
  doc.text('Email : ' + (user.email || '-'), nx, y + 21);
  doc.text('Phone : ' + (user.phone || '-'), nx, y + 29);

  const kycBadgeColor = user.kyc_status === 'verified' ? [...green] : user.kyc_status === 'rejected' ? [...red] : [...gold];
  doc.setFillColor(...kycBadgeColor);
  doc.roundedRect(W - 52, y + 8, 40, 10, 3, 3, 'F');
  doc.setTextColor(...white); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('KYC: ' + (user.kyc_status || 'PENDING').toUpperCase(), W - 50, y + 14.5);
  doc.setFillColor(...navy); doc.roundedRect(W - 52, y + 22, 40, 9, 3, 3, 'F');
  doc.setTextColor(...purple); doc.setFontSize(7.5);
  doc.text((user.role || 'user').toUpperCase() + ' ACCOUNT', W - 50, y + 28);

  y += 44;

  // Personal Information
  drawSectionHeader('PERSONAL INFORMATION', [...purple], y + 6);
  y += 10;
  y = drawInfoGrid([
    ['Full Name',           user.full_name || '-'],
    ['Email Address',       user.email || '-'],
    ['Phone Number',        user.phone || '-'],
    ['Date of Birth',       user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('en-IN') : '-'],
    ['Gender',             (user.gender || '-').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())],
    ['Nationality',         user.nationality || 'Indian'],
    ['Occupation',          user.occupation || '-'],
    ['Annual Income',       user.annual_income || '-'],
    ['Residential Address', user.residential_address || '-'],
    ['Account Opened On',   user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'],
    ['Last Login',          user.last_login ? new Date(user.last_login).toLocaleString('en-IN') : '-'],
  ], y);

  y += 3;

  // Identity Details
  drawSectionHeader('IDENTITY DETAILS', [...teal], y + 6);
  y += 10;
  const rawAadhaar = user.aadhaar_number || '';
  const maskedAadhaar = rawAadhaar.length >= 4 ? 'XXXX XXXX ' + rawAadhaar.slice(-4) : (rawAadhaar || 'Not Submitted');
  y = drawInfoGrid([
    ['PAN Number',       user.pan_number || 'Not Submitted'],
    ['Aadhaar Number',   maskedAadhaar],
    ['CKYC Number',      user.ckyc_number || '-'],
    ['Risk Category',    user.risk_category ? user.risk_category.toUpperCase() : '-'],
    ['KYC Status',       (user.kyc_status || 'PENDING').toUpperCase(),
      user.kyc_status === 'verified' ? [...green] : user.kyc_status === 'rejected' ? [...red] : [...gold]],
    ['KYC Submitted On', user.kyc_submitted_at
      ? new Date(user.kyc_submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      : 'Not Submitted'],
    ['CKYC Lock Status', user.ckyc_locked ? 'LOCKED (Permanently set)' : 'Unlocked',
      user.ckyc_locked ? [...red] : [...green]],
  ], y);

  // Aadhaar privacy notice
  doc.setFillColor(255, 250, 220); doc.setDrawColor(...gold); doc.setLineWidth(0.35);
  doc.roundedRect(10, y + 2, W - 20, 10, 2, 2, 'FD');
  doc.setTextColor(130, 90, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.text('PRIVACY NOTICE: Aadhaar is partially masked per UIDAI guidelines. PAN & CKYC stored as per RBI norms.', 14, y + 8.5);

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 2 — Bank Account Details
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader('Bank Account Details', 'Accounts, IFSC & Balance Overview');
  y = 60;

  drawSectionHeader('BANK ACCOUNT DETAILS', [...green], y + 6);
  y += 10;

  if (accounts.length === 0) {
    doc.setTextColor(...gray); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.text('No bank accounts found.', 14, y + 10); y += 20;
  } else {
    accounts.forEach((acc, idx) => {
      const cardH = 64;
      doc.setFillColor(240, 242, 255); doc.roundedRect(10, y, W - 20, cardH, 4, 4, 'F');
      doc.setFillColor(...navy); doc.roundedRect(10, y, 5, cardH, 2, 2, 'F');
      doc.setDrawColor(...purple); doc.setLineWidth(0.3); doc.roundedRect(10, y, W - 20, cardH, 4, 4, 'D');
      // header strip
      doc.setFillColor(...navy); doc.roundedRect(15, y + 4, W - 30, 11, 2, 2, 'F');
      doc.setTextColor(...white); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text(`Account ${idx + 1}  —  ${(acc.account_type || 'SAVINGS').toUpperCase()} ACCOUNT`, 19, y + 11);
      doc.setFillColor(...green); doc.roundedRect(W - 60, y + 5, 46, 9, 2, 2, 'F');
      doc.setTextColor(...white); doc.setFontSize(8);
      doc.text('Balance: ' + fmtPDF(acc.balance), W - 58, y + 11);
      // two columns
      const col1 = [['Account Number', acc.account_number || '-'], ['IFSC Code', acc.ifsc_code || 'MMIT0001001'], ['Account Type', (acc.account_type || 'savings').toUpperCase()], ['Min. Balance', fmtPDF(acc.min_balance || 1000)]];
      const col2 = [['Bank Name', acc.bank_name || 'Money Mitra Bank'], ['Branch', acc.branch || 'Digital Branch - India'], ['Status', (acc.status || 'ACTIVE').toUpperCase()], ['Interest Rate', parseFloat(acc.interest_rate || 3.5).toFixed(2) + '% p.a.']];
      const cY = y + 20, rH = 9, cx = W / 2 + 4;
      col1.forEach(([lbl, val], i) => {
        const ry = cY + i * rH;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...navy); doc.text(lbl + ':', 18, ry);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 40, 100); doc.text(String(val), 60, ry);
      });
      col2.forEach(([lbl, val], i) => {
        const ry = cY + i * rH;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...navy); doc.text(lbl + ':', cx, ry);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 40, 100); doc.text(String(val), cx + 32, ry);
      });
      y += cardH + 6;
    });
  }

  // Bank legal info box
  doc.setFillColor(245, 246, 255); doc.setDrawColor(...navy); doc.setLineWidth(0.3);
  doc.roundedRect(10, y, W - 20, 28, 3, 3, 'FD');
  doc.setFillColor(...navy); doc.roundedRect(10, y, W - 20, 10, 2, 2, 'F');
  doc.setTextColor(...white); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
  doc.text('BANKING DETAILS', 14, y + 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...navy);
  doc.text('Bank Name  :  Money Mitra Bank Ltd.', 14, y + 16);
  doc.text('IFSC Code  :  MMIT0001001   |   Branch  :  Digital Banking Division, India   |   MICR  :  400002001', 14, y + 23);
  y += 34;

  // UPI & Primary Account Summary
  if (accounts.length > 0) {
    const pa = accounts[0];
    y += 2;
    drawSectionHeader('UPI & PRIMARY ACCOUNT SUMMARY', [...teal], y + 6);
    y += 10;
    y = drawInfoGrid([
      ['Primary Account No.', pa.account_number || '-'],
      ['Primary UPI Handle',  pa.primary_upi || ((user.email?.split('@')[0] || '') + '@moneymitra')],
      ['Current Balance',     fmtPDF(pa.balance), [...green]],
      ['Account Status',      (pa.status || 'active').toUpperCase(), pa.status === 'active' ? [...green] : [...red]],
      ['Total Accounts',      String(accounts.length)],
    ], y);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 3 — Transaction History
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader('Transaction History', 'Complete Financial Activity Log', 52);
  y = 60;

  const creditTypes = ['credit', 'upi_receive', 'loan_credit', 'refund'];
  const totalCredit = transactions.filter(t => creditTypes.includes(t.type)).reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const totalDebit  = transactions.filter(t => !creditTypes.includes(t.type)).reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const netFlow = totalCredit - totalDebit;

  const statBoxes = [
    { label: 'Total Credits', value: fmtPDF(totalCredit), color: green },
    { label: 'Total Debits',  value: fmtPDF(totalDebit),  color: [...red] },
    { label: 'Net Flow', value: (netFlow >= 0 ? '+ ' : '- ') + 'Rs. ' + Math.abs(netFlow).toLocaleString('en-IN', { minimumFractionDigits: 2 }), color: netFlow >= 0 ? green : [...red] },
    { label: 'Transactions', value: String(transactions.length) + ' records', color: [...purple] },
  ];
  const bw = (W - 20 - 9) / 4;
  statBoxes.forEach((s, i) => {
    const bx = 10 + i * (bw + 3);
    doc.setFillColor(...light); doc.roundedRect(bx, y, bw, 22, 2, 2, 'F');
    doc.setFillColor(...s.color); doc.roundedRect(bx, y, 3, 22, 1, 1, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...gray);
    doc.text(s.label, bx + 6, y + 8);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...s.color);
    doc.text(s.value, bx + 6, y + 17, { maxWidth: bw - 8 });
  });
  y += 30;

  if (filters.start_date || filters.end_date || filters.type) {
    doc.setFillColor(230, 255, 245); doc.setDrawColor(...green); doc.setLineWidth(0.3);
    doc.roundedRect(10, y, W - 20, 9, 2, 2, 'FD');
    doc.setTextColor(0, 100, 60); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    let ft = 'Filters Applied:';
    if (filters.type) ft += '  Type: ' + filters.type;
    if (filters.start_date) ft += '  |  From: ' + filters.start_date;
    if (filters.end_date) ft += '  |  To: ' + filters.end_date;
    doc.text(ft, 14, y + 6); y += 13;
  }

  if (transactions.length === 0) {
    doc.setTextColor(...gray); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text('No transactions found for the selected filters.', 14, y + 20);
  } else {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Date & Time', 'Type', 'Description', 'Reference No.', 'Amount', 'Bal. After', 'Status']],
      body: transactions.map((txn, idx) => {
        const isCredit = creditTypes.includes(txn.type);
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
        2: { cellWidth: 22 },
        3: { cellWidth: 40 },
        4: { cellWidth: 28, fontSize: 7 },
        5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 16, halign: 'center' },
      },
      didParseCell(data) {
        if (data.column.index === 5 && data.section === 'body') {
          data.cell.styles.textColor = creditTypes.includes(transactions[data.row.index]?.type) ? [0, 140, 80] : [200, 40, 40];
        }
        if (data.column.index === 6 && data.section === 'body') data.cell.styles.textColor = [60, 80, 140];
        if (data.column.index === 7 && data.section === 'body') {
          const s = String(data.cell.raw);
          data.cell.styles.textColor = s === 'COMPLETED' ? [0, 140, 80] : s === 'FAILED' ? [200, 40, 40] : [160, 100, 0];
        }
      },
      margin: { left: 10, right: 10 },
    });
  }

  // ─── FOOTER on every page ──────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Navy band
    doc.setFillColor(...navy);
    doc.rect(0, H - 18, W, 10, 'F');
    doc.setTextColor(160, 170, 210); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text('Money Mitra Bank Ltd.  |  Digital Banking Division  |  support@moneymitra.in  |  Helpline: 1800-XXX-0000', 14, H - 11);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(200, 210, 255);
    doc.text(`Page ${i} of ${pageCount}`, W - 26, H - 11);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(130, 140, 190);
    doc.text('CONFIDENTIAL — For authorized use only', 14, H - 21);
    // Purple college footer strip
    doc.setFillColor(...purple);
    doc.rect(0, H - 8, W, 8, 'F');
    doc.setTextColor(230, 228, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    doc.text(
      'College Minor Project  \u00B7  4th Sem  \u00B7  CST  \u00B7  Roll No: 34, 36, 37, 38, 39, 40',
      W / 2, H - 3.2, { align: 'center' }
    );
  }

  const filename = `MoneyMitra_Statement_${user.full_name?.replace(/\s+/g, '_') || 'User'}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}
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
    <div style={{ width: '100%' }}>
      {/* Live pulse CSS */}
      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes txnFlash { 0%{background:rgba(0,229,160,0.18)} 100%{background:transparent} }
        .live-dot { width:8px;height:8px;border-radius:50%;background:#00e5a0;animation:livePulse 1.5s ease-in-out infinite; }
        .txn-flash { animation:txnFlash 1.2s ease-out; }
        .download-btn { padding: 12px 24px; font-size: 14px; }
        
        /* Direct mobile overrides to prevent CSS caching issues */
        @media (max-width: 768px) { 
          .download-btn { width: 100% !important; justify-content: center !important; margin-top: 12px; } 
          .grid-responsive-4, .grid-responsive-2 { display: flex !important; flex-direction: column !important; }
          .dashboard-header-flex { display: flex !important; flex-direction: column !important; align-items: stretch !important; }
          
          /* Force Transaction Table to Cards */
          .data-table, .data-table tbody, .data-table tr, .data-table td { display: block !important; width: 100% !important; }
          .data-table thead { display: none !important; }
          .data-table tr { margin-bottom: 16px !important; background: var(--bg-card) !important; border: 1px solid var(--border) !important; border-radius: 12px !important; padding: 12px !important; }
          .data-table td { display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 10px 0 !important; border-bottom: 1px solid rgba(255,255,255,0.06) !important; text-align: right !important; }
          .data-table td:last-child { border-bottom: none !important; }
          .data-table td::before { content: attr(data-label) !important; font-weight: 700 !important; font-size: 11px !important; text-transform: uppercase !important; color: var(--text-muted) !important; margin-right: 12px !important; text-align: left !important; }
        }
      `}</style>

      <div className="dashboard-header-flex" style={{ marginBottom: 16 }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">📊 Transaction History</h1>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
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
          className="download-btn"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'linear-gradient(135deg,#e53935,#c62828)',
            border: 'none', borderRadius: 12,
            cursor: 'pointer', color: '#fff', fontFamily: 'Outfit, sans-serif',
            fontWeight: 700, boxShadow: '0 4px 18px rgba(229,57,53,0.35)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
          <span style={{ fontSize: 18 }}>📄</span> Download Statement
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <form onSubmit={handleSearch}>
          <div className="grid-responsive-4" style={{ gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Search</label>
              <input type="text" className="input-field" placeholder="Description or ref no."
                value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Type</label>
              <select className="input-field" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} style={{ background: 'var(--bg-input)' }}>
                <option value="" style={{ background: '#1a1a3e' }}>All Types</option>
                {Object.entries(TXN_STYLES).map(([k, v]) => <option key={k} value={k} style={{ background: '#1a1a3e' }}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>From Date</label>
              <input type="date" className="input-field" value={filters.start_date} onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>To Date</label>
              <input type="date" className="input-field" value={filters.end_date} onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          
          {/* Amount Filters */}
          <div className="grid-responsive-2" style={{ gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Min Amount</label>
              <input type="number" className="input-field" placeholder="0.00" value={filters.min_amount}
                onChange={e => setFilters(f => ({ ...f, min_amount: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Max Amount</label>
              <input type="number" className="input-field" placeholder="10000.00" value={filters.max_amount}
                onChange={e => setFilters(f => ({ ...f, max_amount: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', padding: '0 8px' }}>
              {pagination.total || 0} transactions found
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" className="btn-secondary" onClick={handleReset} style={{ padding: '12px 24px', flex: '1 1 auto' }}>
                Reset
              </button>
              <button type="submit" className="btn-primary" style={{ padding: '12px 24px', flex: '1 1 auto', display: 'flex', justifyContent: 'center', gap: 8 }}>
                <span>🔍</span> Apply Filters
              </button>
            </div>
          </div>
        </form>
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
                    <td data-label="Type">
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
                    <td data-label="Description">
                      <div style={{ fontSize: 13, fontWeight: 600, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{txn.description || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{txn.reference_number}</div>
                      {txn.fraud_flagged && <div style={{ fontSize: 10, color: 'var(--warning)', marginTop: 2 }}>⚠️ Fraud Flagged</div>}
                    </td>

                    {/* From / To column */}
                    <td data-label="From / To">
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
                    <td data-label="Date & Time"><div style={{ fontSize: 12 }}>{formatDateTime(txn.created_at)}</div></td>

                    {/* Amount column */}
                    <td data-label="Amount" style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: dirColor, letterSpacing: '-0.5px' }}>
                        {dirSign} {formatINR(txn.amount)}
                      </div>
                      {txn.balance_after !== null && txn.balance_after !== undefined && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bal: {formatINR(txn.balance_after)}</div>
                      )}
                    </td>

                    {/* Status column */}
                    <td data-label="Status">
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
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-light)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Included in PDF (3 Pages)</div>
              {[
                ['🖼️', 'Profile Photo, Full Name, Email & Phone'],
                ['🪪', 'PAN, Aadhaar (masked), CKYC & Risk Category'],
                ['✅', 'KYC Status, KYC Submitted Date & CKYC Lock'],
                ['📅', 'DOB, Gender, Occupation & Account Opening Date'],
                ['🏦', 'Account Number, IFSC Code, Branch & Bank Name'],
                ['💰', 'Balance, Interest Rate, Min. Balance & UPI Handle'],
                ['📊', 'Complete Transaction History with Reference Nos.'],
                ['📈', 'Credit / Debit Summary & Net Flow'],
                ['🎓', 'College Minor Project Footer (4th Sem · CST · Roll: 34–40)'],
              ].map(([icon, text]) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7, fontSize: 12.5 }}>
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
