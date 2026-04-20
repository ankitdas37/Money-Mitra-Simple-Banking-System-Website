const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const { generateReferenceNumber, detectFraud } = require('../../utils/helpers');
const { sendSuccess, sendError } = require('../../utils/response');

// GET /api/upi — list my UPI IDs
const getUpiIds = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT u.*, a.account_number, a.account_type FROM upi_ids u
       JOIN accounts a ON u.account_id = a.id
       WHERE u.user_id = ? AND u.is_active = TRUE`,
      [req.user.id]
    );
    sendSuccess(res, rows);
  } catch (err) { next(err); }
};

// POST /api/upi — create UPI ID
const createUpiId = async (req, res, next) => {
  try {
    const { account_id, upi_prefix } = req.body;
    if (!account_id || !upi_prefix) return sendError(res, 400, 'account_id and upi_prefix required');

    const upiHandle = `${upi_prefix}@moneymitra`;
    const [exists] = await db.query('SELECT id FROM upi_ids WHERE upi_handle = ?', [upiHandle]);
    if (exists.length > 0) return sendError(res, 409, 'UPI ID already taken. Try another.');

    const [account] = await db.query('SELECT id FROM accounts WHERE id=? AND user_id=?', [account_id, req.user.id]);
    if (account.length === 0) return sendError(res, 404, 'Account not found');

    await db.query(
      'INSERT INTO upi_ids (id, user_id, account_id, upi_handle) VALUES (?,?,?,?)',
      [uuidv4(), req.user.id, account_id, upiHandle]
    );
    sendSuccess(res, { upi_handle: upiHandle }, 'UPI ID created successfully', 201);
  } catch (err) { next(err); }
};

// POST /api/upi/send — send money via UPI
const sendUpi = async (req, res, next) => {
  try {
    const { from_account_id, to_upi_handle, amount, description } = req.body;

    if (!from_account_id || !to_upi_handle || !amount) {
      return sendError(res, 400, 'from_account_id, to_upi_handle and amount required');
    }

    const transferAmount = parseFloat(amount);
    if (transferAmount <= 0 || transferAmount > 200000) {
      return sendError(res, 400, 'UPI amount must be between ₹1 and ₹2,00,000');
    }

    // Verify sender
    const [fromRows] = await db.query(
      'SELECT * FROM accounts WHERE id=? AND user_id=? AND status="active"',
      [from_account_id, req.user.id]
    );
    if (fromRows.length === 0) return sendError(res, 404, 'Source account not found');

    // Find recipient UPI
    const [upiRows] = await db.query(
      `SELECT u.*, a.id as acc_id, a.balance as acc_balance, a.user_id as acc_user_id
       FROM upi_ids u JOIN accounts a ON u.account_id = a.id
       WHERE u.upi_handle = ? AND u.is_active = TRUE`,
      [to_upi_handle]
    );
    if (upiRows.length === 0) return sendError(res, 404, 'UPI ID not found');

    if (upiRows[0].acc_id === from_account_id) return sendError(res, 400, 'Cannot send to own UPI');
    if (parseFloat(fromRows[0].balance) < transferAmount) return sendError(res, 400, 'Insufficient balance');

    const fraud = detectFraud(transferAmount);
    const refNumber = generateReferenceNumber();
    const txnId = uuidv4();
    const newBalance = parseFloat(fromRows[0].balance) - transferAmount;

    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      await conn.query('UPDATE accounts SET balance = balance - ? WHERE id=?', [transferAmount, from_account_id]);
      await conn.query('UPDATE accounts SET balance = balance + ? WHERE id=?', [transferAmount, upiRows[0].acc_id]);

      await conn.query(
        `INSERT INTO transactions (id, from_account_id, to_account_id, amount, type, category, description, reference_number, fraud_flagged, fraud_reason, balance_after)
         VALUES (?,?,?,?,'upi_send','transfer',?,?,?,?,?)`,
        [txnId, from_account_id, upiRows[0].acc_id, transferAmount, description || `UPI to ${to_upi_handle}`, refNumber, fraud.flagged, fraud.reason, newBalance]
      );

      // Notify recipient
      await conn.query(
        `INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,'transaction')`,
        [uuidv4(), upiRows[0].acc_user_id, `₹${transferAmount.toLocaleString('en-IN')} Received via UPI`, `From ${req.user.full_name}. Ref: ${refNumber}`]
      );

      await conn.commit();
      conn.release();

      sendSuccess(res, {
        transaction_id: txnId,
        reference_number: refNumber,
        amount: transferAmount,
        to_upi: to_upi_handle,
        new_balance: newBalance,
        fraud_flagged: fraud.flagged
      }, '✅ UPI payment successful');
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (err) { next(err); }
};

// GET /api/upi/lookup/:handle — find UPI user
const lookupUpi = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT u.upi_handle, us.full_name, us.avatar_id FROM upi_ids u
       JOIN users us ON u.user_id = us.id
       WHERE u.upi_handle = ? AND u.is_active = TRUE`,
      [req.params.handle]
    );
    if (rows.length === 0) return sendError(res, 404, 'UPI ID not found');
    sendSuccess(res, rows[0]);
  } catch (err) { next(err); }
};

module.exports = { getUpiIds, createUpiId, sendUpi, lookupUpi };
