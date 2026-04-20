const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });

  console.log('Running Help & Support schema migration...');

  // ── support_tickets ────────────────────────────────────────────
  await conn.query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id            VARCHAR(36)   COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
      user_id       VARCHAR(36)   COLLATE utf8mb4_unicode_ci NOT NULL,
      ticket_number VARCHAR(30)   COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
      subject       VARCHAR(200)  COLLATE utf8mb4_unicode_ci NOT NULL,
      category      ENUM('account','payment','kyc','card','loan','upi','other') NOT NULL DEFAULT 'other',
      priority      ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'low',
      status        ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
      created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ support_tickets table ready');

  // ── support_messages ───────────────────────────────────────────
  await conn.query(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id           VARCHAR(36)  COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
      ticket_id    VARCHAR(36)  COLLATE utf8mb4_unicode_ci NOT NULL,
      sender_role  ENUM('user','admin')  NOT NULL,
      sender_name  VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL,
      message      TEXT         COLLATE utf8mb4_unicode_ci NOT NULL,
      is_read      TINYINT(1)   NOT NULL DEFAULT 0,
      created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ support_messages table ready');

  await conn.end();
  console.log('✅ Help & Support migration complete!');
  process.exit(0);
}

migrate().catch(e => { console.error('Migration failed:', e.message); process.exit(1); });
