const db = require('../src/config/db');

async function migrateFaq() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS faqs (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0,
        created_by VARCHAR(36),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_faq_category (category),
        INDEX idx_faq_active (is_active)
      )
    `);
    console.log('✅ FAQs table ready');
    process.exit(0);
  } catch (err) {
    console.error('❌ FAQ migration failed:', err.message);
    process.exit(1);
  }
}

migrateFaq();
