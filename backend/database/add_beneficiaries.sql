-- ================================================================
-- MONEY MITRA - Add Beneficiaries Table Migration
-- ================================================================

USE money_mitra;

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
);
