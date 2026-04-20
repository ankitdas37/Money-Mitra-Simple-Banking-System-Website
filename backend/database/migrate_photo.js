const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  const [cols] = await conn.query('SHOW COLUMNS FROM users');
  const exists = cols.some(c => c.Field === 'profile_photo');
  if (!exists) {
    await conn.query('ALTER TABLE users ADD COLUMN profile_photo MEDIUMTEXT NULL');
    console.log('Added profile_photo column (MEDIUMTEXT for base64 storage)');
  } else {
    console.log('profile_photo already exists');
  }
  await conn.end();
  console.log('Done!');
  process.exit(0);
}
migrate().catch(e => { console.error(e.message); process.exit(1); });
