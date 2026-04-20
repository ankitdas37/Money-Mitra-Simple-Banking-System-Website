-- ================================================================
-- MONEY MITRA - Seed Data
-- All amounts in Indian Rupees (₹ / INR)
-- ================================================================
USE money_mitra;

-- Admin User (password: Admin@123)
INSERT INTO users (id, full_name, email, phone, password_hash, avatar_id, role, kyc_status) VALUES
('admin-001', 'Money Mitra Admin', 'admin@moneymitra.in', '9999000001', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NXabCTszi', 1, 'admin', 'verified');

-- Regular Users (password: User@1234)
INSERT INTO users (id, full_name, email, phone, password_hash, avatar_id, role, kyc_status) VALUES
('user-001', 'Rahul Sharma', 'rahul@moneymitra.in', '9876543210', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NXabCTszi', 3, 'user', 'verified'),
('user-002', 'Priya Patel', 'priya@moneymitra.in', '9876543211', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NXabCTszi', 5, 'user', 'verified'),
('user-003', 'Arjun Mehta', 'arjun@moneymitra.in', '9876543212', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NXabCTszi', 7, 'user', 'pending');

-- Accounts
INSERT INTO accounts (id, user_id, account_number, account_type, balance) VALUES
('acc-001', 'user-001', '100000000001', 'savings', 125000.00),
('acc-002', 'user-001', '100000000002', 'current', 450000.00),
('acc-003', 'user-002', '100000000003', 'savings', 78500.00),
('acc-004', 'user-003', '100000000004', 'savings', 32000.00);

-- UPI IDs
INSERT INTO upi_ids (id, user_id, account_id, upi_handle, is_primary) VALUES
('upi-001', 'user-001', 'acc-001', 'rahul@moneymitra', TRUE),
('upi-002', 'user-001', 'acc-002', 'rahul.sharma@moneymitra', FALSE),
('upi-003', 'user-002', 'acc-003', 'priya@moneymitra', TRUE),
('upi-004', 'user-003', 'acc-004', 'arjun@moneymitra', TRUE);

-- Cards
INSERT INTO cards (id, account_id, user_id, card_number_masked, card_number_last4, card_number_encrypted, card_type, card_network, cvv_hash, expiry_month, expiry_year, name_on_card, spending_limit, credit_limit) VALUES
('card-001', 'acc-001', 'user-001', 'XXXX XXXX XXXX 4821', '4821', 'enc_4111111111114821', 'debit', 'visa', '$2a$12$hash1', '12', '2028', 'RAHUL SHARMA', 50000.00, NULL),
('card-002', 'acc-001', 'user-001', 'XXXX XXXX XXXX 9034', '9034', 'enc_5555555555559034', 'credit', 'mastercard', '$2a$12$hash2', '06', '2027', 'RAHUL SHARMA', 200000.00, 200000.00),
('card-003', 'acc-003', 'user-002', 'XXXX XXXX XXXX 7612', '7612', 'enc_6200000000007612', 'debit', 'rupay', '$2a$12$hash3', '03', '2029', 'PRIYA PATEL', 30000.00, NULL);

-- Transactions
INSERT INTO transactions (id, from_account_id, to_account_id, amount, type, category, description, reference_number, balance_after) VALUES
('txn-001', NULL, 'acc-001', 50000.00, 'credit', 'salary', 'Salary Credit - March 2024', 'REF2024030001', 125000.00),
('txn-002', 'acc-001', 'acc-003', 5000.00, 'transfer', 'transfer', 'Sent to Priya', 'REF2024030002', 120000.00),
('txn-003', 'acc-001', NULL, 2500.00, 'bill_payment', 'electricity', 'MSEDCL Electricity Bill', 'REF2024030003', 117500.00),
('txn-004', 'acc-001', NULL, 699.00, 'bill_payment', 'ott', 'Netflix Subscription', 'REF2024030004', 116801.00),
('txn-005', 'acc-001', NULL, 1200.00, 'debit', 'food', 'Zomato Order', 'REF2024030005', 115601.00),
('txn-006', NULL, 'acc-001', 10000.00, 'credit', 'general', 'Refund from Amazon', 'REF2024030006', 125601.00),
('txn-007', 'acc-001', NULL, 15000.00, 'upi_send', 'shopping', 'Myntra Shopping', 'REF2024030007', 110601.00),
('txn-008', 'acc-001', NULL, 500.00, 'debit', 'travel', 'Metro Recharge', 'REF2024020001', 110101.00);

-- Bills
INSERT INTO bills (id, user_id, account_id, biller_name, category, consumer_number, amount, due_date, status) VALUES
('bill-001', 'user-001', 'acc-001', 'MSEDCL Maharashtra', 'electricity', 'MH1234567890', 2347.00, DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'pending'),
('bill-002', 'user-001', 'acc-001', 'Jio Fiber', 'broadband', 'JF9988776655', 999.00, DATE_ADD(CURDATE(), INTERVAL 12 DAY), 'pending'),
('bill-003', 'user-001', 'acc-001', 'Airtel Mobile', 'mobile', '9876543210', 599.00, DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'pending'),
('bill-004', 'user-001', 'acc-001', 'BSES Yamuna Power', 'electricity', 'DL987654321', 1850.00, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'overdue'),
('bill-005', 'user-002', 'acc-003', 'Mahanagar Gas', 'gas', 'MGL12345678', 780.00, DATE_ADD(CURDATE(), INTERVAL 8 DAY), 'pending');

-- Loans
INSERT INTO loans (id, user_id, account_id, loan_type, amount_requested, amount_approved, interest_rate, tenure_months, emi_amount, total_payable, purpose, status) VALUES
('loan-001', 'user-001', 'acc-001', 'personal', 200000.00, 200000.00, 12.50, 24, 9443.00, 226632.00, 'Home renovation and furniture purchase', 'disbursed'),
('loan-002', 'user-002', 'acc-003', 'education', 500000.00, 450000.00, 9.00, 60, 9327.00, 559620.00, 'Post graduation MBA abroad', 'approved'),
('loan-003', 'user-003', 'acc-004', 'personal', 100000.00, NULL, 14.00, 12, NULL, NULL, 'Medical emergency expenses', 'under_review');

-- Notifications
INSERT INTO notifications (id, user_id, title, body, type) VALUES
('notif-001', 'user-001', '₹50,000 Credited', 'Salary of ₹50,000 has been credited to your savings account ending 0001', 'transaction'),
('notif-002', 'user-001', 'Bill Due Alert', 'Your MSEDCL electricity bill of ₹2,347 is due in 5 days', 'bill'),
('notif-003', 'user-001', 'Loan EMI Reminder', 'Your personal loan EMI of ₹9,443 is due on 28th of this month', 'loan'),
('notif-004', 'user-001', 'Login Alert', 'New login detected from Chrome on Windows. If this was not you, please contact support.', 'security'),
('notif-005', 'user-002', 'Loan Approved! 🎉', 'Congratulations! Your education loan of ₹4,50,000 has been approved.', 'loan'),
('notif-006', 'user-002', 'Money Received', '₹5,000 received from Rahul Sharma via transfer', 'transaction');

-- Support Tickets
INSERT INTO support_tickets (id, user_id, subject, message, category, status) VALUES
('ticket-001', 'user-001', 'Transaction not reflected', 'I made a payment of ₹5000 via UPI 2 hours ago but the recipient has not received it. Reference: UPI2024030010', 'transaction', 'in_progress'),
('ticket-002', 'user-002', 'Need to increase credit limit', 'I have been using Money Mitra for 6 months with good repayment history. Request to increase my credit limit.', 'card', 'open');
