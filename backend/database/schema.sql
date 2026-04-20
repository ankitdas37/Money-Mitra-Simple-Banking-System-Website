-- ================================================================
-- MONEY MITRA - Database Schema (MySQL)
-- Digital Banking Simulation Platform
-- All monetary values are in Indian Rupees (INR / ₹)
-- ================================================================

CREATE DATABASE IF NOT EXISTS money_mitra CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE money_mitra;

-- ----------------------------------------------------------------
-- USERS TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(15) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar_id INT DEFAULT 1 COMMENT 'Anime avatar selection 1-9',
  role ENUM('user', 'admin') DEFAULT 'user',
  kyc_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  is_active BOOLEAN DEFAULT TRUE,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_phone (phone),
  INDEX idx_users_role (role)
);

-- ----------------------------------------------------------------
-- ACCOUNTS TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  account_number VARCHAR(18) NOT NULL UNIQUE,
  ifsc_code VARCHAR(11) DEFAULT 'MMIT0001001',
  bank_name VARCHAR(100) DEFAULT 'Money Mitra Bank',
  branch VARCHAR(100) DEFAULT 'Digital Branch - India',
  account_type ENUM('savings', 'current', 'salary') DEFAULT 'savings',
  balance DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Balance in INR',
  min_balance DECIMAL(15,2) DEFAULT 1000.00,
  interest_rate DECIMAL(4,2) DEFAULT 3.50,
  status ENUM('active', 'frozen', 'closed') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_accounts_user (user_id),
  INDEX idx_accounts_number (account_number)
);

-- ----------------------------------------------------------------
-- UPI IDS TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS upi_ids (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  account_id VARCHAR(36) NOT NULL,
  upi_handle VARCHAR(50) NOT NULL UNIQUE COMMENT 'e.g. rahul@moneymitra',
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX idx_upi_user (user_id),
  INDEX idx_upi_handle (upi_handle)
);

-- ----------------------------------------------------------------
-- TRANSACTIONS TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  from_account_id VARCHAR(36),
  to_account_id VARCHAR(36),
  from_upi_id VARCHAR(36),
  to_upi_id VARCHAR(36),
  amount DECIMAL(15,2) NOT NULL COMMENT 'Amount in INR',
  type ENUM('credit','debit','transfer','upi_send','upi_receive','bill_payment','loan_credit','emi_debit','refund') NOT NULL,
  category VARCHAR(50) DEFAULT 'general' COMMENT 'food, travel, bills, shopping, etc',
  description VARCHAR(255),
  reference_number VARCHAR(50) UNIQUE,
  status ENUM('pending','completed','failed','reversed') DEFAULT 'completed',
  fraud_flagged BOOLEAN DEFAULT FALSE,
  fraud_reason VARCHAR(255),
  balance_after DECIMAL(15,2) COMMENT 'Balance after this transaction',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  INDEX idx_txn_from_account (from_account_id),
  INDEX idx_txn_to_account (to_account_id),
  INDEX idx_txn_type (type),
  INDEX idx_txn_status (status),
  INDEX idx_txn_date (created_at),
  INDEX idx_txn_fraud (fraud_flagged)
);

-- ----------------------------------------------------------------
-- CARDS TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cards (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  account_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  card_number_masked VARCHAR(20) NOT NULL COMMENT 'XXXX XXXX XXXX NNNN',
  card_number_last4 CHAR(4) NOT NULL,
  card_number_encrypted VARCHAR(255) NOT NULL COMMENT 'Encrypted full number',
  card_type ENUM('debit','credit') NOT NULL,
  card_network ENUM('visa','mastercard','rupay') DEFAULT 'rupay',
  cvv_hash VARCHAR(255) NOT NULL,
  expiry_month CHAR(2) NOT NULL,
  expiry_year CHAR(4) NOT NULL,
  name_on_card VARCHAR(100) NOT NULL,
  is_frozen BOOLEAN DEFAULT FALSE,
  spending_limit DECIMAL(15,2) DEFAULT 100000.00 COMMENT 'Daily limit in INR',
  current_day_spent DECIMAL(15,2) DEFAULT 0.00,
  credit_limit DECIMAL(15,2) COMMENT 'Only for credit cards, in INR',
  outstanding_balance DECIMAL(15,2) DEFAULT 0.00 COMMENT 'For credit cards',
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_cards_account (account_id),
  INDEX idx_cards_user (user_id)
);

-- ----------------------------------------------------------------
-- BILLS TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bills (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  account_id VARCHAR(36),
  biller_name VARCHAR(100) NOT NULL,
  biller_id VARCHAR(50),
  category ENUM('electricity','water','gas','broadband','mobile','dth','fastag','insurance','ott','other') NOT NULL,
  consumer_number VARCHAR(50),
  amount DECIMAL(15,2) COMMENT 'Amount in INR',
  due_date DATE,
  status ENUM('pending','paid','overdue','cancelled') DEFAULT 'pending',
  transaction_id VARCHAR(36),
  paid_at DATETIME,
  auto_pay BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  INDEX idx_bills_user (user_id),
  INDEX idx_bills_status (status),
  INDEX idx_bills_due (due_date)
);

-- ----------------------------------------------------------------
-- LOANS TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  account_id VARCHAR(36),
  loan_type ENUM('personal','home','education','vehicle','gold') DEFAULT 'personal',
  amount_requested DECIMAL(15,2) NOT NULL COMMENT 'In INR',
  amount_approved DECIMAL(15,2) COMMENT 'In INR',
  interest_rate DECIMAL(5,2) DEFAULT 10.50 COMMENT 'Annual %',
  tenure_months INT NOT NULL,
  emi_amount DECIMAL(15,2) COMMENT 'Monthly EMI in INR',
  total_payable DECIMAL(15,2),
  amount_paid DECIMAL(15,2) DEFAULT 0.00,
  purpose TEXT,
  status ENUM('applied','under_review','approved','rejected','disbursed','closed') DEFAULT 'applied',
  admin_remarks TEXT,
  disbursed_at DATETIME,
  next_emi_date DATE,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  INDEX idx_loans_user (user_id),
  INDEX idx_loans_status (status)
);

-- ----------------------------------------------------------------
-- NOTIFICATIONS TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  type ENUM('transaction','security','loan','bill','system','fraud','promo') DEFAULT 'system',
  is_read BOOLEAN DEFAULT FALSE,
  icon VARCHAR(50) DEFAULT 'bell',
  action_url VARCHAR(200),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id),
  INDEX idx_notif_read (is_read),
  INDEX idx_notif_date (created_at)
);

-- ----------------------------------------------------------------
-- SUPPORT TICKETS TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  category ENUM('account','transaction','card','loan','technical','other') DEFAULT 'other',
  priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
  status ENUM('open','in_progress','resolved','closed') DEFAULT 'open',
  admin_reply TEXT,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tickets_user (user_id),
  INDEX idx_tickets_status (status)
);

-- ----------------------------------------------------------------
-- AUDIT LOGS TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(36),
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_date (created_at)
);

-- ----------------------------------------------------------------
-- REFRESH TOKENS TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tokens_user (user_id),
  INDEX idx_tokens_hash (token_hash)
);
