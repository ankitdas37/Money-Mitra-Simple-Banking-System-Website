const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function seedDB() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });

    console.log('✅ Connected to money_mitra database');

    const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    await connection.query(seed);
    console.log('✅ Seed data inserted successfully');
    console.log('\n📋 Test Credentials:');
    console.log('   Admin: admin@moneymitra.in / Admin@123');
    console.log('   User1: rahul@moneymitra.in / User@1234');
    console.log('   User2: priya@moneymitra.in / User@1234');
    console.log('\n🚀 Ready! Start the server: npm run dev');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.log('⚠️  Seed data already exists (duplicate entry). Skipping.');
    } else {
      console.error('❌ Seed failed:', err.message);
    }
  } finally {
    if (connection) await connection.end();
  }
}

seedDB();
