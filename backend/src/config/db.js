const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT || 3306,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // ── Performance settings ─────────────────────────────────────
  waitForConnections: true,
  connectionLimit:    20,          // was 10 — handle more concurrent requests
  queueLimit:         0,
  connectTimeout:     10000,       // 10s max to get a connection
  enableKeepAlive:    true,        // prevent dropped idle connections
  keepAliveInitialDelay: 10000,

  // ── Encoding ─────────────────────────────────────────────────
  timezone: '+05:30',              // IST
  charset:  'utf8mb4',

  // ── Reduce latency: reuse prepared statements ─────────────────
  namedPlaceholders: false,
  multipleStatements: false,
});

// Test connection on startup
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected — money_mitra database ready');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   Check your .env DB_* settings and ensure MySQL is running');
  });

module.exports = pool;
