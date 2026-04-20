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

  // Get existing columns in cards table
  const [cols] = await conn.query(`SHOW COLUMNS FROM cards`);
  const existing = cols.map(c => c.Field);

  const toAdd = [
    { name: 'online_enabled',           sql: `ALTER TABLE cards ADD COLUMN online_enabled BOOLEAN DEFAULT TRUE` },
    { name: 'international_enabled',    sql: `ALTER TABLE cards ADD COLUMN international_enabled BOOLEAN DEFAULT FALSE` },
    { name: 'nfc_enabled',              sql: `ALTER TABLE cards ADD COLUMN nfc_enabled BOOLEAN DEFAULT TRUE` },
    { name: 'is_permanently_blocked',   sql: `ALTER TABLE cards ADD COLUMN is_permanently_blocked BOOLEAN DEFAULT FALSE` },
  ];

  for (const col of toAdd) {
    if (existing.includes(col.name)) {
      console.log(`⏭️  Column '${col.name}' already exists — skipping`);
    } else {
      await conn.query(col.sql);
      console.log(`✅ Added column '${col.name}'`);
    }
  }

  console.log('✅ Cards migration complete!');
  await conn.end();
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
