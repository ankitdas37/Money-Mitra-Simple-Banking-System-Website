const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('✅ Connected to MySQL');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS beneficiaries (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      user_id VARCHAR(36) NOT NULL,
      account_number VARCHAR(18) NOT NULL,
      account_holder_name VARCHAR(100),
      nickname VARCHAR(60) NOT NULL,
      bank_name VARCHAR(100) DEFAULT 'Money Mitra Bank',
      ifsc_code VARCHAR(11) DEFAULT 'MMIT0001001',
      is_verified BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY uq_user_account (user_id, account_number),
      INDEX idx_ben_user (user_id)
    )
  `);

  console.log('✅ beneficiaries table created (or already exists)');
  await conn.end();
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
