/**
 * Fix script — updates all user passwords with correct bcrypt hashes
 * Run: node database/fix-passwords.js
 */
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixPasswords() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('✅ Connected to database');

  // Generate correct hashes
  const userHash = await bcrypt.hash('User@1234', 12);
  const adminHash = await bcrypt.hash('Admin@123', 12);

  // Update all regular users
  await conn.query(
    `UPDATE users SET password_hash = ? WHERE role = 'user'`,
    [userHash]
  );

  // Update admin
  await conn.query(
    `UPDATE users SET password_hash = ? WHERE role = 'admin'`,
    [adminHash]
  );

  const [rows] = await conn.query('SELECT email, role FROM users');
  console.log('\n📋 Updated passwords:');
  rows.forEach(r => console.log(`   ${r.role === 'admin' ? '👑' : '👤'} ${r.email} → ${r.role === 'admin' ? 'Admin@123' : 'User@1234'}`));

  await conn.end();
  console.log('\n✅ All passwords fixed! You can now login.');
}

fixPasswords().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
