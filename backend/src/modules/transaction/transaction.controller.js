const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const { generateReferenceNumber, detectFraud } = require('../../utils/helpers');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response');

// GET /api/transactions — list with filters
const getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, start_date, end_date, min_amount, max_amount, search } = req.query;
    const offset = (page - 1) * limit;

    /*
     * SCOPING RULE:
     *  - 'transfer' rows  → only the SENDER (from_account belongs to user)   → shows as DEBIT (minus)
     *  - 'credit' rows    → only the RECEIVER (to_account belongs to user)    → shows as CREDIT (plus)
     *  - everything else  → either account belonging to user (original logic)
     */
    let where = `WHERE (
      (t.type = 'transfer' AND t.from_account_id IN (SELECT id FROM accounts WHERE user_id=?))
      OR (t.type = 'credit'   AND t.to_account_id   IN (SELECT id FROM accounts WHERE user_id=?))
      OR (t.type NOT IN ('transfer','credit') AND (
            t.from_account_id IN (SELECT id FROM accounts WHERE user_id=?)
         OR t.to_account_id   IN (SELECT id FROM accounts WHERE user_id=?)
      ))
    )`;
    const params = [req.user.id, req.user.id, req.user.id, req.user.id];

    if (type) { where += ` AND t.type = ?`; params.push(type); }
    if (start_date) { where += ` AND t.created_at >= ?`; params.push(start_date); }
    if (end_date) { where += ` AND t.created_at <= ?`; params.push(end_date + ' 23:59:59'); }
    if (min_amount) { where += ` AND t.amount >= ?`; params.push(min_amount); }
    if (max_amount) { where += ` AND t.amount <= ?`; params.push(max_amount); }
    if (search) { where += ` AND (t.description LIKE ? OR t.reference_number LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }

    const [countRows] = await db.query(`SELECT COUNT(*) as total FROM transactions t ${where}`, params);
    const total = countRows[0].total;

    const [rows] = await db.query(
      `SELECT t.*, 
        fa.account_number as from_account_number,
        ta.account_number as to_account_number,
        fu.full_name as from_user_name,
        tu.full_name as to_user_name
       FROM transactions t
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id = ta.id
       LEFT JOIN users fu ON fa.user_id = fu.id
       LEFT JOIN users tu ON ta.user_id = tu.id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    sendPaginated(res, rows, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (err) { next(err); }
};


// POST /api/transactions/transfer — account-to-account transfer
const transfer = async (req, res, next) => {
  try {
    const { from_account_id, to_account_number, amount, description, category = 'transfer' } = req.body;

    if (!from_account_id || !to_account_number || !amount) {
      return sendError(res, 400, 'from_account_id, to_account_number and amount are required');
    }

    const transferAmount = parseFloat(amount);
    if (transferAmount <= 0 || transferAmount > 1000000) {
      return sendError(res, 400, 'Amount must be between ₹1 and ₹10,00,000');
    }

    // Verify sender owns the account
    const [fromRows] = await db.query(
      'SELECT * FROM accounts WHERE id = ? AND user_id = ? AND status = "active"',
      [from_account_id, req.user.id]
    );
    if (fromRows.length === 0) return sendError(res, 404, 'Source account not found or inactive');

    // Find destination account
    const [toRows] = await db.query(
      'SELECT * FROM accounts WHERE account_number = ? AND status = "active"',
      [to_account_number]
    );
    if (toRows.length === 0) return sendError(res, 404, 'Destination account not found');

    if (fromRows[0].id === toRows[0].id) return sendError(res, 400, 'Cannot transfer to same account');
    if (parseFloat(fromRows[0].balance) < transferAmount) return sendError(res, 400, 'Insufficient balance');

    // Fraud detection
    const [recentTxns] = await db.query(
      'SELECT COUNT(*) as cnt FROM transactions WHERE from_account_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)',
      [from_account_id]
    );
    const fraud = detectFraud(transferAmount, recentTxns[0].cnt);

    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      const refNumber = generateReferenceNumber();
      const txnId = uuidv4();
      const newFromBalance = parseFloat(fromRows[0].balance) - transferAmount;
      const newToBalance = parseFloat(toRows[0].balance) + transferAmount;

      // Debit sender
      await conn.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [transferAmount, from_account_id]);
      // Credit receiver
      await conn.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [transferAmount, toRows[0].id]);

      // Record DEBIT transaction for sender
      await conn.query(
        `INSERT INTO transactions (id, from_account_id, to_account_id, amount, type, category, description, reference_number, fraud_flagged, fraud_reason, balance_after, status)
         VALUES (?,?,?,?,'transfer',?,?,?,?,?,?,'completed')`,
        [txnId, from_account_id, toRows[0].id, transferAmount, category, description || 'Fund Transfer', refNumber, fraud.flagged, fraud.reason, newFromBalance]
      );

      // Record CREDIT transaction for receiver (separate row so receiver sees it in their history)
      const creditTxnId = uuidv4();
      const creditRefNumber = refNumber + '-CR'; // unique suffix to satisfy UNIQUE constraint on reference_number
      await conn.query(
        `INSERT INTO transactions (id, from_account_id, to_account_id, amount, type, category, description, reference_number, fraud_flagged, fraud_reason, balance_after, status)
         VALUES (?,?,?,?,'credit',?,?,?,?,?,?,'completed')`,
        [creditTxnId, from_account_id, toRows[0].id, transferAmount, category, description || 'Fund Transfer', creditRefNumber, false, null, newToBalance]
      );

      // Notifications
      await conn.query(
        `INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,'transaction')`,
        [uuidv4(), req.user.id, `₹${transferAmount.toLocaleString('en-IN')} Sent`, `Transferred to account ${to_account_number}. Ref: ${refNumber}`]
      );
      await conn.query(
        `INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,'transaction')`,
        [uuidv4(), toRows[0].user_id, `₹${transferAmount.toLocaleString('en-IN')} Received`, `Received from ${req.user.full_name}. Ref: ${refNumber}`]
      );

      await conn.commit();
      conn.release();

      sendSuccess(res, {
        transaction_id: txnId,
        reference_number: refNumber,
        amount: transferAmount,
        from_account: fromRows[0].account_number,
        to_account: to_account_number,
        new_balance: newFromBalance,
        fraud_flagged: fraud.flagged
      }, 'Transfer successful');
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (err) { next(err); }
};

// GET /api/transactions/:id
const getTransaction = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, fa.account_number as from_account_number, ta.account_number as to_account_number,
        fu.full_name as from_user_name, tu.full_name as to_user_name
       FROM transactions t
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id = ta.id
       LEFT JOIN users fu ON fa.user_id = fu.id
       LEFT JOIN users tu ON ta.user_id = tu.id
       WHERE t.id = ? AND (fa.user_id = ? OR ta.user_id = ?)`,
      [req.params.id, req.user.id, req.user.id]
    );
    if (rows.length === 0) return sendError(res, 404, 'Transaction not found');
    sendSuccess(res, rows[0]);
  } catch (err) { next(err); }
};

// GET /api/transactions/analytics — monthly spending
const getAnalytics = async (req, res, next) => {
  try {
    const [monthly] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') as month,
        SUM(CASE WHEN type IN ('debit','upi_send','bill_payment','emi_debit','transfer')
                  AND from_account_id IN (SELECT id FROM accounts WHERE user_id=?) THEN amount ELSE 0 END) as expenses,
        SUM(CASE WHEN type IN ('credit','upi_receive','loan_credit')
                  AND to_account_id IN (SELECT id FROM accounts WHERE user_id=?) THEN amount ELSE 0 END) as income
       FROM transactions
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       AND (
         (type = 'transfer' AND from_account_id IN (SELECT id FROM accounts WHERE user_id=?))
         OR (type = 'credit' AND to_account_id IN (SELECT id FROM accounts WHERE user_id=?))
         OR (type NOT IN ('transfer','credit') AND (
               from_account_id IN (SELECT id FROM accounts WHERE user_id=?)
            OR to_account_id IN (SELECT id FROM accounts WHERE user_id=?)
         ))
       )
       GROUP BY month ORDER BY month`,
      [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
    );

    const [categories] = await db.query(
      `SELECT category, SUM(amount) as total
       FROM transactions
       WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=?)
       AND type IN ('debit','upi_send','bill_payment','transfer')
       AND created_at >= DATE_FORMAT(NOW(),'%Y-%m-01')
       GROUP BY category ORDER BY total DESC`,
      [req.user.id]
    );

    sendSuccess(res, { monthly, categories });
  } catch (err) { next(err); }
};

module.exports = { getTransactions, transfer, getTransaction, getAnalytics };

