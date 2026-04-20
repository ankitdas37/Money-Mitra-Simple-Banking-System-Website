const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const { generateReferenceNumber } = require('../../utils/helpers');
const { sendSuccess, sendError } = require('../../utils/response');

// GET /api/bills
const getBills = async (req, res, next) => {
  try {
    const { status } = req.query;
    let where = 'WHERE b.user_id = ?';
    const params = [req.user.id];
    if (status) { where += ' AND b.status = ?'; params.push(status); }

    const [rows] = await db.query(
      `SELECT b.*, a.account_number FROM bills b LEFT JOIN accounts a ON b.account_id = a.id ${where} ORDER BY b.due_date ASC`,
      params
    );
    sendSuccess(res, rows);
  } catch (err) { next(err); }
};

// POST /api/bills — add bill
const addBill = async (req, res, next) => {
  try {
    const { account_id, biller_name, category, consumer_number, amount, due_date } = req.body;
    if (!biller_name || !category) return sendError(res, 400, 'biller_name and category required');

    await db.query(
      'INSERT INTO bills (id, user_id, account_id, biller_name, category, consumer_number, amount, due_date) VALUES (?,?,?,?,?,?,?,?)',
      [uuidv4(), req.user.id, account_id, biller_name, category, consumer_number, amount, due_date]
    );
    sendSuccess(res, {}, 'Bill added successfully', 201);
  } catch (err) { next(err); }
};

// POST /api/bills/:id/pay — pay a bill
const payBill = async (req, res, next) => {
  try {
    const { account_id } = req.body;
    if (!account_id) return sendError(res, 400, 'account_id required');

    const [bills] = await db.query('SELECT * FROM bills WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (bills.length === 0) return sendError(res, 404, 'Bill not found');

    const bill = bills[0];
    if (bill.status === 'paid') return sendError(res, 400, 'Bill already paid');

    const [accounts] = await db.query('SELECT * FROM accounts WHERE id=? AND user_id=? AND status="active"', [account_id, req.user.id]);
    if (accounts.length === 0) return sendError(res, 404, 'Account not found');
    if (parseFloat(accounts[0].balance) < parseFloat(bill.amount)) return sendError(res, 400, 'Insufficient balance');

    const refNumber = generateReferenceNumber();
    const txnId = uuidv4();

    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      await conn.query('UPDATE accounts SET balance = balance - ? WHERE id=?', [bill.amount, account_id]);
      await conn.query(
        'UPDATE bills SET status="paid", account_id=?, transaction_id=?, paid_at=NOW() WHERE id=?',
        [account_id, txnId, bill.id]
      );
      await conn.query(
        `INSERT INTO transactions (id, from_account_id, amount, type, category, description, reference_number, balance_after)
         VALUES (?,?,?,'bill_payment',?,'Bill Payment: ${bill.biller_name}',?,?)`,
        [txnId, account_id, bill.amount, bill.category, refNumber, parseFloat(accounts[0].balance) - parseFloat(bill.amount)]
      );
      await conn.query(
        `INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,'bill')`,
        [uuidv4(), req.user.id, '✅ Bill Paid Successfully', `₹${bill.amount} paid to ${bill.biller_name}. Ref: ${refNumber}`]
      );

      await conn.commit();
      conn.release();
      sendSuccess(res, { reference_number: refNumber, amount_paid: bill.amount }, 'Bill paid successfully');
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (err) { next(err); }
};

module.exports = { getBills, addBill, payBill };
