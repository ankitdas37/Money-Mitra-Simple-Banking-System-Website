const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const { sendSuccess, sendError } = require('../../utils/response');

// GET /api/beneficiaries — list all beneficiaries for current user
const getBeneficiaries = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT b.*, a.account_number as verified_account_number, u.full_name as verified_name
       FROM beneficiaries b
       LEFT JOIN accounts a ON b.account_number = a.account_number AND a.status = 'active'
       LEFT JOIN users u ON a.user_id = u.id
       WHERE b.user_id = ?
       ORDER BY b.nickname ASC`,
      [req.user.id]
    );
    sendSuccess(res, rows);
  } catch (err) { next(err); }
};

// POST /api/beneficiaries — add a new beneficiary
const addBeneficiary = async (req, res, next) => {
  try {
    const { account_number, nickname, bank_name, ifsc_code } = req.body;

    if (!account_number || !nickname) {
      return sendError(res, 400, 'account_number and nickname are required');
    }

    // Check if beneficiary account exists in the system
    const [accRows] = await db.query(
      `SELECT a.account_number, u.full_name
       FROM accounts a
       JOIN users u ON a.user_id = u.id
       WHERE a.account_number = ? AND a.status = 'active' AND a.user_id != ?`,
      [account_number, req.user.id]
    );

    // Check for duplicate
    const [existing] = await db.query(
      'SELECT id FROM beneficiaries WHERE user_id = ? AND account_number = ?',
      [req.user.id, account_number]
    );
    if (existing.length > 0) {
      return sendError(res, 409, 'Beneficiary with this account number already exists');
    }

    const id = uuidv4();
    const isVerified = accRows.length > 0;
    const resolvedName = isVerified ? accRows[0].full_name : null;

    await db.query(
      `INSERT INTO beneficiaries (id, user_id, account_number, nickname, bank_name, ifsc_code, is_verified, account_holder_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, account_number, nickname, bank_name || 'Money Mitra Bank', ifsc_code || 'MMIT0001001', isVerified, resolvedName]
    );

    const [newBen] = await db.query('SELECT * FROM beneficiaries WHERE id = ?', [id]);
    sendSuccess(res, newBen[0], isVerified ? 'Beneficiary added and verified ✅' : 'Beneficiary added (unverified account)');
  } catch (err) { next(err); }
};

// DELETE /api/beneficiaries/:id — remove a beneficiary
const deleteBeneficiary = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id FROM beneficiaries WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return sendError(res, 404, 'Beneficiary not found');

    await db.query('DELETE FROM beneficiaries WHERE id = ?', [req.params.id]);
    sendSuccess(res, null, 'Beneficiary removed');
  } catch (err) { next(err); }
};

module.exports = { getBeneficiaries, addBeneficiary, deleteBeneficiary };
