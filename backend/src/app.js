const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');
const compression = require('compression');
require('dotenv').config();

// Import routes
const authRoutes         = require('./modules/auth/auth.routes');
const accountRoutes      = require('./modules/account/account.routes');
const transactionRoutes  = require('./modules/transaction/transaction.routes');
const upiRoutes          = require('./modules/upi/upi.routes');
const cardRoutes         = require('./modules/cards/cards.routes');
const billRoutes         = require('./modules/bills/bills.routes');
const loanRoutes         = require('./modules/loans/loans.routes');
const notificationRoutes = require('./modules/notifications/notifications.routes');
const adminRoutes        = require('./modules/admin/admin.routes');
const userRoutes         = require('./modules/user/user.routes');
const beneficiaryRoutes  = require('./modules/beneficiary/beneficiary.routes');
const supportRoutes      = require('./modules/support/support.routes');

// Import middleware
const { errorHandler }    = require('./middleware/errorHandler');
const { globalRateLimiter } = require('./middleware/rateLimiter');

// Initialize DB pool (connection check on load)
require('./config/db');

const app = express();

// ── Gzip Compression (speeds up all responses) ──────────────────
app.use(compression({ level: 6, threshold: 1024 }));

// ── Allowed CORS origins (localhost + any device on LAN) ─────────
const allowedOrigins = [
  process.env.FRONTEND_URL         || 'http://localhost:5173',
  process.env.FRONTEND_URL_NETWORK || 'http://192.168.1.4:5173',
  // Allow any 192.168.x.x or 10.x.x.x device on local network
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    // Allow localhost
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return callback(null, true);
    // Allow any LAN IP (192.168.x.x or 10.x.x.x or 172.16-31.x.x)
    if (/^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)) return callback(null, true);
    // Allowlist check
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Security Middleware ──────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── General Middleware ──────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(globalRateLimiter);

// ── Health Check ─────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    app: 'Money Mitra API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    network: `http://${process.env.HOST || '0.0.0.0'}:${process.env.PORT || 5000}`
  });
});

// ── API Routes ──────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/accounts',      accountRoutes);
app.use('/api/transactions',  transactionRoutes);
app.use('/api/upi',           upiRoutes);
app.use('/api/cards',         cardRoutes);
app.use('/api/bills',         billRoutes);
app.use('/api/loans',         loanRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/beneficiaries', beneficiaryRoutes);
app.use('/api/support',       supportRoutes);

// ── 404 Handler ─────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global Error Handler ─────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`\n💰 Money Mitra API`);
  console.log(`   Local  : http://localhost:${PORT}`);
  console.log(`   Network: http://192.168.1.4:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}\n`);
});

module.exports = app;
