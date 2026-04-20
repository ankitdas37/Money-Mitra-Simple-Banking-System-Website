const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const { generateAccountNumber } = require('../../utils/helpers');
const { sendSuccess, sendError } = require('../../utils/response');

// GET /api/accounts — get my accounts
const getAccounts = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, 
        (SELECT upi_handle FROM upi_ids WHERE account_id = a.id AND is_primary = TRUE LIMIT 1) as primary_upi
       FROM accounts a WHERE a.user_id = ? AND a.status != 'closed' ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    sendSuccess(res, rows);
  } catch (err) { next(err); }
};

// GET /api/accounts/:id — single account
const getAccount = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM accounts WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return sendError(res, 404, 'Account not found');
    sendSuccess(res, rows[0]);
  } catch (err) { next(err); }
};

// POST /api/accounts — create new account
const createAccount = async (req, res, next) => {
  try {
    const { account_type = 'savings' } = req.body;
    const validTypes = ['savings', 'current', 'salary'];
    if (!validTypes.includes(account_type)) return sendError(res, 400, 'Invalid account type');

    const accountId = uuidv4();
    const accountNumber = generateAccountNumber();

    await db.query(
      `INSERT INTO accounts (id, user_id, account_number, account_type, balance) VALUES (?,?,?,?,0.00)`,
      [accountId, req.user.id, accountNumber, account_type]
    );

    sendSuccess(res, { id: accountId, account_number: accountNumber, account_type }, 'Account created successfully', 201);
  } catch (err) { next(err); }
};

// GET /api/accounts/:id/balance
const getBalance = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT balance, account_number, account_type FROM accounts WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return sendError(res, 404, 'Account not found');
    sendSuccess(res, rows[0]);
  } catch (err) { next(err); }
};

// GET /api/accounts/summary — dashboard summary
const getSummary = async (req, res, next) => {
  try {
    const [accounts] = await db.query(
      'SELECT COALESCE(SUM(balance), 0) as total_balance, COUNT(*) as account_count FROM accounts WHERE user_id = ? AND status = "active"',
      [req.user.id]
    );

    const [thisMonth] = await db.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type IN ('credit','upi_receive','loan_credit') AND to_account_id IN (SELECT id FROM accounts WHERE user_id=?) THEN amount ELSE 0 END),0) as total_credits,
        COALESCE(SUM(CASE WHEN type IN ('debit','upi_send','bill_payment','emi_debit','transfer') AND from_account_id IN (SELECT id FROM accounts WHERE user_id=?) THEN amount ELSE 0 END),0) as total_debits
       FROM transactions 
       WHERE created_at >= DATE_FORMAT(NOW(),'%Y-%m-01')
       AND (from_account_id IN (SELECT id FROM accounts WHERE user_id=?) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=?))`,
      [req.user.id, req.user.id, req.user.id, req.user.id]
    );

    sendSuccess(res, {
      total_balance: accounts[0].total_balance,
      account_count: accounts[0].account_count,
      this_month: thisMonth[0]
    });
  } catch (err) { next(err); }
};

// GET /api/accounts/directory — list all other users' accounts for transfer recipient selection
const getAllDirectory = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT a.id, a.account_number, a.account_type, a.bank_name,
              u.full_name, u.avatar_id
       FROM accounts a
       JOIN users u ON a.user_id = u.id
       WHERE a.status = 'active'
         AND a.user_id != ?
       ORDER BY u.full_name ASC`,
      [req.user.id]
    );
    sendSuccess(res, rows);
  } catch (err) { next(err); }
};

module.exports = { getAccounts, getAccount, createAccount, getBalance, getSummary, getAllDirectory };
