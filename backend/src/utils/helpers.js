const { v4: uuidv4 } = require('uuid');

/**
 * Generate unique account number (12 digits)
 */
const generateAccountNumber = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return timestamp + random;
};

/**
 * Generate UPI reference number
 */
const generateReferenceNumber = () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 9999999).toString().padStart(7, '0');
  return `MM${dateStr}${random}`;
};

/**
 * Generate virtual card number (16 digits)
 */
const generateCardNumber = () => {
  const prefix = '4000'; // Visa-style
  const middle = Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
  const last4 = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `${prefix}${middle}${last4}`;
};

/**
 * Generate CVV (3 digits)
 */
const generateCVV = () => {
  return Math.floor(Math.random() * 900 + 100).toString();
};

/**
 * Generate card expiry (3-5 years from now)
 */
const generateExpiry = () => {
  const now = new Date();
  const years = Math.floor(Math.random() * 3) + 3;
  const expYear = (now.getFullYear() + years).toString();
  const expMonth = (Math.floor(Math.random() * 12) + 1).toString().padStart(2, '0');
  return { month: expMonth, year: expYear };
};

/**
 * Mask card number for display
 */
const maskCardNumber = (cardNumber) => {
  return `XXXX XXXX XXXX ${cardNumber.slice(-4)}`;
};

/**
 * Format amount in Indian Rupees
 */
const formatINR = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
};

/**
 * Calculate EMI
 * P = Principal, r = monthly interest rate, n = tenure months
 */
const calculateEMI = (principal, annualRate, tenureMonths) => {
  const r = annualRate / (12 * 100);
  if (r === 0) return principal / tenureMonths;
  const emi = principal * r * Math.pow(1 + r, tenureMonths) / (Math.pow(1 + r, tenureMonths) - 1);
  return Math.round(emi * 100) / 100;
};

/**
 * Detect fraud patterns
 * Returns { flagged: bool, reason: string }
 */
const detectFraud = (amount, recentTxnCount = 0) => {
  // Flag large transactions above ₹50,000
  if (amount > 50000) {
    return { flagged: true, reason: `Large transaction detected: ₹${amount}` };
  }
  // Flag more than 3 transfers in 1 minute
  if (recentTxnCount >= 3) {
    return { flagged: true, reason: 'Rapid transfer pattern detected' };
  }
  return { flagged: false, reason: null };
};

module.exports = {
  generateAccountNumber,
  generateReferenceNumber,
  generateCardNumber,
  generateCVV,
  generateExpiry,
  maskCardNumber,
  formatINR,
  calculateEMI,
  detectFraud
};
