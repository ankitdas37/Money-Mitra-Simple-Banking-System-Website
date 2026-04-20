// Avatar emojis — original set
export const AVATARS = ['🦊', '🐺', '🦋', '🐉', '🦅', '🌸', '⚡', '🌙', '🔮'];

// Format INR currency
export const formatINR = (amount) => {
  if (amount === null || amount === undefined) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
};

// Short INR (e.g. ₹1.25L)
export const formatINRShort = (amount) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
};

// Format date
export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

// Format date + time
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

// Transaction type icons & colors
export const TXN_STYLES = {
  credit:       { icon: '↓', color: '#00E5A0', bg: 'rgba(0,229,160,0.1)',    label: 'Money Received' },
  debit:        { icon: '↑', color: '#FF5757', bg: 'rgba(255,87,87,0.1)',    label: 'Debit' },
  transfer:     { icon: '↑', color: '#6C63FF', bg: 'rgba(108,99,255,0.1)',   label: 'Transfer Out' },
  upi_send:     { icon: '⚡', color: '#FF6B9D', bg: 'rgba(255,107,157,0.1)', label: 'UPI Sent' },
  upi_receive:  { icon: '⚡', color: '#00E5A0', bg: 'rgba(0,229,160,0.1)',   label: 'UPI Received' },
  bill_payment: { icon: '📄', color: '#FFB84C', bg: 'rgba(255,184,76,0.1)',  label: 'Bill' },
  loan_credit:  { icon: '🏦', color: '#5BC8FB', bg: 'rgba(91,200,251,0.1)', label: 'Loan' },
  emi_debit:    { icon: '📅', color: '#FF5757', bg: 'rgba(255,87,87,0.1)',   label: 'EMI' },
  refund:       { icon: '↩', color: '#00E5A0', bg: 'rgba(0,229,160,0.1)',    label: 'Refund' },
};

// Bill category icons
export const BILL_ICONS = {
  electricity: '⚡',
  water: '💧',
  gas: '🔥',
  broadband: '📡',
  mobile: '📱',
  dth: '📺',
  fastag: '🚗',
  insurance: '🛡️',
  ott: '🎬',
  other: '📋'
};

// Loan type details
export const LOAN_TYPES = {
  personal: { label: 'Personal Loan', rate: 12.5, icon: '👤', maxAmount: 2500000 },
  home: { label: 'Home Loan', rate: 8.5, icon: '🏠', maxAmount: 50000000 },
  education: { label: 'Education Loan', rate: 9.0, icon: '🎓', maxAmount: 5000000 },
  vehicle: { label: 'Vehicle Loan', rate: 10.0, icon: '🚗', maxAmount: 3000000 },
  gold: { label: 'Gold Loan', rate: 7.5, icon: '🥇', maxAmount: 2000000 },
};

// Card network logos
export const CARD_NETWORKS = {
  visa: '💳 VISA',
  mastercard: '💳 MASTERCARD',
  rupay: '💳 RuPay'
};
