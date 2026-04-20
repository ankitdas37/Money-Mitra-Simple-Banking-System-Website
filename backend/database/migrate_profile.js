const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  console.log('✅ Connected to MySQL');

  const [cols] = await conn.query('SHOW COLUMNS FROM users');
  const existing = cols.map(c => c.Field);

  const toAdd = [
    // Personal Details
    { name: 'date_of_birth',         sql: "ALTER TABLE users ADD COLUMN date_of_birth DATE NULL" },
    { name: 'residential_address',   sql: "ALTER TABLE users ADD COLUMN residential_address TEXT NULL" },
    { name: 'corporate_address',     sql: "ALTER TABLE users ADD COLUMN corporate_address TEXT NULL" },
    { name: 'gender',                sql: "ALTER TABLE users ADD COLUMN gender ENUM('male','female','other','prefer_not_to_say') NULL" },
    { name: 'nationality',           sql: "ALTER TABLE users ADD COLUMN nationality VARCHAR(50) DEFAULT 'Indian'" },
    { name: 'occupation',            sql: "ALTER TABLE users ADD COLUMN occupation VARCHAR(100) NULL" },
    { name: 'annual_income',         sql: "ALTER TABLE users ADD COLUMN annual_income VARCHAR(50) NULL" },
    // KYC Docs
    { name: 'pan_number',            sql: "ALTER TABLE users ADD COLUMN pan_number VARCHAR(10) NULL UNIQUE" },
    { name: 'aadhaar_number',        sql: "ALTER TABLE users ADD COLUMN aadhaar_number VARCHAR(12) NULL UNIQUE" },
    { name: 'ckyc_number',           sql: "ALTER TABLE users ADD COLUMN ckyc_number VARCHAR(14) NULL UNIQUE" },
    { name: 'risk_category',         sql: "ALTER TABLE users ADD COLUMN risk_category ENUM('low','medium','high') DEFAULT 'low'" },
    { name: 'kyc_submitted_at',      sql: "ALTER TABLE users ADD COLUMN kyc_submitted_at DATETIME NULL" },
    // Pending changes (OTP+admin verification)
    { name: 'pending_phone',         sql: "ALTER TABLE users ADD COLUMN pending_phone VARCHAR(15) NULL" },
    { name: 'pending_email',         sql: "ALTER TABLE users ADD COLUMN pending_email VARCHAR(100) NULL" },
    { name: 'pending_pan',           sql: "ALTER TABLE users ADD COLUMN pending_pan VARCHAR(10) NULL" },
    { name: 'pending_aadhaar',       sql: "ALTER TABLE users ADD COLUMN pending_aadhaar VARCHAR(12) NULL" },
    { name: 'pending_ckyc',          sql: "ALTER TABLE users ADD COLUMN pending_ckyc VARCHAR(14) NULL" },
    { name: 'pending_risk',          sql: "ALTER TABLE users ADD COLUMN pending_risk ENUM('low','medium','high') NULL" },
    { name: 'pending_change_type',   sql: "ALTER TABLE users ADD COLUMN pending_change_type VARCHAR(50) NULL COMMENT 'phone|email|kyc'" },
    { name: 'pending_otp',           sql: "ALTER TABLE users ADD COLUMN pending_otp VARCHAR(6) NULL" },
    { name: 'pending_otp_expires',   sql: "ALTER TABLE users ADD COLUMN pending_otp_expires DATETIME NULL" },
    { name: 'phone_verified',        sql: "ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE" },
    { name: 'email_verified',        sql: "ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE" },
  ];

  for (const col of toAdd) {
    if (existing.includes(col.name)) {
      console.log(`⏭️  '${col.name}' already exists`);
    } else {
      await conn.query(col.sql);
      console.log(`✅ Added '${col.name}'`);
    }
  }

  console.log('✅ Profile migration complete!');
  await conn.end(); process.exit(0);
}
migrate().catch(err => { console.error('❌', err.message); process.exit(1); });
