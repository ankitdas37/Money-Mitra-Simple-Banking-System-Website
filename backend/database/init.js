const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDB() {
  let connection;
  try {
    // Connect without database first
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true
    });

    console.log('✅ Connected to MySQL');

    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await connection.query(schema);
    console.log('✅ Schema applied successfully');

    console.log('\n🎉 Database initialized! Run: npm run db:seed');
  } catch (err) {
    console.error('❌ DB init failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

initDB();
