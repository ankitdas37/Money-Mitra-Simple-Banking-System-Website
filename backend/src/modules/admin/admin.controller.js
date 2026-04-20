const db = require('../../config/db');
const { sendSuccess, sendError } = require('../../utils/response');

// GET /api/admin/users
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    let where = "WHERE role != 'admin'";
    const params = [];
    if (search) { where += ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const [rows] = await db.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.avatar_id, u.kyc_status, u.is_active, u.last_login, u.created_at,
        u.date_of_birth, u.gender, u.nationality, u.occupation, u.annual_income,
        TIMESTAMPDIFF(YEAR, u.date_of_birth, CURDATE()) AS age,
        COUNT(a.id) as account_count, COALESCE(SUM(a.balance),0) as total_balance,
        (SELECT a2.account_number FROM accounts a2 WHERE a2.user_id = u.id ORDER BY a2.created_at ASC LIMIT 1) as account_number
       FROM users u LEFT JOIN accounts a ON u.id = a.user_id
       ${where} GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    sendSuccess(res, rows);
  } catch (err) { next(err); }
};

// GET /api/admin/users/:id — full profile
const getUser = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT u.*,
        TIMESTAMPDIFF(YEAR, u.date_of_birth, CURDATE()) AS age,
        a.account_number, a.account_type, a.balance
       FROM users u
       LEFT JOIN accounts a ON u.id = a.user_id AND a.account_type IN ('savings','current')
       WHERE u.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return sendError(res, 404, 'User not found');
    const { password_hash, ...safeUser } = rows[0];
    sendSuccess(res, safeUser);
  } catch (err) { next(err); }
};

// PUT /api/admin/users/:id — admin edits any profile field
const updateUser = async (req, res, next) => {
  try {
    const allowed = [
      'full_name','email','phone','gender','date_of_birth','occupation',
      'annual_income','residential_address','corporate_address','nationality',
      'avatar_id','profile_photo','kyc_status','is_active','risk_category'
    ];
    const updates = [];
    const params = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key}=?`);
        params.push(req.body[key]);
      }
    }
    if (updates.length === 0) return sendError(res, 400, 'No valid fields to update');

    params.push(req.params.id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id=?`, params);

    // Notify user of profile update by admin
    const [usr] = await db.query('SELECT user_id FROM users WHERE id=?', [req.params.id]).catch(() => [[]]);
    await db.query(
      `INSERT INTO notifications (id, user_id, title, body, type) VALUES (UUID(),?,?,?,'system')`,
      [req.params.id, '👤 Profile Updated by Admin', 'Your profile details have been updated by the bank administrator.']
    ).catch(() => {});

    sendSuccess(res, {}, 'User profile updated successfully');
  } catch (err) { next(err); }
};

// PUT /api/admin/users/:id/status
const toggleUserStatus = async (req, res, next) => {
  try {
    const [rows] = await db.query("SELECT id, is_active, role FROM users WHERE id=? AND role != 'admin'", [req.params.id]);
    if (rows.length === 0) return sendError(res, 404, 'User not found');

    const newStatus = !rows[0].is_active;
    await db.query('UPDATE users SET is_active=? WHERE id=?', [newStatus, req.params.id]);
    sendSuccess(res, { is_active: newStatus }, `User ${newStatus ? 'activated' : 'suspended'}`);
  } catch (err) { next(err); }
};

// GET /api/admin/transactions — all transactions (fraud flagged first)
const getAllTransactions = async (req, res, next) => {
  try {
    const { fraud_only, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    let where = '';
    if (fraud_only === 'true') where = 'WHERE t.fraud_flagged = TRUE';

    const [rows] = await db.query(
      `SELECT t.*, fa.account_number as from_acc, ta.account_number as to_acc, fu.full_name as from_user, tu.full_name as to_user
       FROM transactions t
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id = ta.id
       LEFT JOIN users fu ON fa.user_id = fu.id
       LEFT JOIN users tu ON ta.user_id = tu.id
       ${where} ORDER BY t.fraud_flagged DESC, t.created_at DESC LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );
    sendSuccess(res, rows);
  } catch (err) { next(err); }
};

// PUT /api/admin/loans/:id/approve
const approveLoan = async (req, res, next) => {
  try {
    const { action, amount_approved, admin_remarks } = req.body;
    const [rows] = await db.query("SELECT * FROM loans WHERE id=? AND status IN ('applied','under_review')", [req.params.id]);
    if (rows.length === 0) return sendError(res, 404, 'Loan not found or already processed');

    const loan      = rows[0];
    const approved  = parseFloat(amount_approved || loan.amount_requested);
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const conn = await require('../../config/db').getConnection();
    await conn.beginTransaction();
    try {
      // Update loan record
      await conn.query(
        'UPDATE loans SET status=?, amount_approved=?, admin_remarks=?, approved_at=NOW() WHERE id=?',
        [newStatus, approved, admin_remarks, req.params.id]
      );

      if (action === 'approve') {
        // Find user's primary account
        const [accounts] = await conn.query(
          'SELECT id, balance FROM accounts WHERE user_id=? AND status="active" ORDER BY created_at ASC LIMIT 1',
          [loan.user_id]
        );
        if (accounts.length === 0) throw { status: 404, message: 'No active account found for user' };

        const acc        = accounts[0];
        const newBalance = parseFloat(acc.balance) + approved;

        // Credit amount to account
        await conn.query('UPDATE accounts SET balance=? WHERE id=?', [newBalance, acc.id]);

        // Record transaction
        const { v4: uuidv4 } = require('uuid');
        const refNum = `LOAN${Date.now()}`;
        await conn.query(
          `INSERT INTO transactions (id, to_account_id, amount, type, category, description, reference_number, balance_after, status)
           VALUES (?,?,?,'loan_credit','loan',?,?,?,'completed')`,
          [uuidv4(), acc.id, approved, `Loan Disbursement — ${loan.loan_type} loan approved by admin`, refNum, newBalance]
        );

        // Notify user — Approved
        await conn.query(
          `INSERT INTO notifications (id, user_id, title, body, type) VALUES (UUID(),?,?,?,'loan')`,
          [
            loan.user_id,
            '🎉 Loan Approved & Disbursed!',
            `Your ${loan.loan_type} loan of ₹${approved.toLocaleString('en-IN')} has been approved and credited to your account. EMI of ₹${parseFloat(loan.emi_amount || 0).toLocaleString('en-IN')}/month starts next cycle.${admin_remarks ? ' Note: ' + admin_remarks : ''}`
          ]
        );

        await conn.commit();
        conn.release();
        return sendSuccess(res, { status: newStatus, amount_credited: approved }, 'Loan approved and amount disbursed to user account');
      } else {
        // Notify user — Rejected
        await conn.query(
          `INSERT INTO notifications (id, user_id, title, body, type) VALUES (UUID(),?,?,?,'loan')`,
          [
            loan.user_id,
            '❌ Loan Application Rejected',
            `Your ${loan.loan_type} loan application for ₹${parseFloat(loan.amount_requested).toLocaleString('en-IN')} has been rejected.${admin_remarks ? ' Reason: ' + admin_remarks : ' Please contact support for more information.'}`
          ]
        );

        await conn.commit();
        conn.release();
        return sendSuccess(res, { status: newStatus }, 'Loan rejected');
      }
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (err) { next(err); }
};

// GET /api/admin/loans — all loan applications (pending first)
const getAllLoans = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 30, search } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];

    if (status) { where += ' AND l.status = ?'; params.push(status); }
    if (search) {
      where += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR l.loan_type LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [rows] = await db.query(
      `SELECT l.*,
         u.full_name, u.email, u.phone, u.avatar_id,
         a.account_number, a.balance as account_balance
       FROM loans l
       JOIN users u ON l.user_id = u.id
       LEFT JOIN accounts a ON l.account_id = a.id
       ${where}
       ORDER BY
         FIELD(l.status,'applied','under_review','approved','rejected','disbursed') ASC,
         l.applied_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) as total FROM loans l JOIN users u ON l.user_id = u.id ${where}`,
      params
    );

    sendSuccess(res, { loans: rows, total: countRow.total });
  } catch (err) { next(err); }
};

// GET /api/admin/stats
const getStats = async (req, res, next) => {
  try {
    const [[users]] = await db.query("SELECT COUNT(*) as total_users, SUM(is_active=1) as active_users FROM users WHERE role='user'");
    const [[accounts]] = await db.query('SELECT COUNT(*) as total_accounts, COALESCE(SUM(balance),0) as total_balance FROM accounts');
    const [[txns]] = await db.query("SELECT COUNT(*) as total_transactions, SUM(amount) as total_volume, SUM(fraud_flagged=1) as fraud_count FROM transactions WHERE created_at >= DATE_FORMAT(NOW(),'%Y-%m-01')");
    const [[loans]] = await db.query("SELECT COUNT(*) as pending_loans FROM loans WHERE status IN ('applied','under_review')");

    sendSuccess(res, { users, accounts, this_month: txns, loans });
  } catch (err) { next(err); }
};

// POST /api/admin/users/:id/adjust-balance  — credit or debit any user's account
const adjustBalance = async (req, res, next) => {
  try {
    const { type, amount, account_id, reason } = req.body;
    const userId = req.params.id;

    if (!['credit', 'debit'].includes(type)) return sendError(res, 400, 'type must be credit or debit');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return sendError(res, 400, 'Amount must be a positive number');

    // Resolve which account to update
    let accQuery = 'SELECT id, account_number, balance FROM accounts WHERE user_id = ?';
    const accParams = [userId];
    if (account_id) { accQuery += ' AND id = ?'; accParams.push(account_id); }
    accQuery += ' ORDER BY created_at ASC LIMIT 1';

    const [accounts] = await db.query(accQuery, accParams);
    if (accounts.length === 0) return sendError(res, 404, 'No account found for this user');

    const acc = accounts[0];
    const currentBalance = parseFloat(acc.balance);

    if (type === 'debit' && currentBalance < amt) {
      return sendError(res, 400, `Insufficient balance. Current balance: ₹${currentBalance.toFixed(2)}`);
    }

    const newBalance = type === 'credit' ? currentBalance + amt : currentBalance - amt;

    // Update balance
    await db.query('UPDATE accounts SET balance = ? WHERE id = ?', [newBalance, acc.id]);

    // Record transaction for audit trail
    const txnDesc = reason || (type === 'credit' ? 'Admin credit adjustment' : 'Admin debit adjustment');
    await db.query(
      `INSERT INTO transactions (id, from_account_id, to_account_id, type, amount, description, status, created_at)
       VALUES (UUID(), ?, ?, ?, ?, ?, 'completed', NOW())`,
      [
        type === 'debit' ? acc.id : null,
        type === 'credit' ? acc.id : null,
        type === 'credit' ? 'deposit' : 'withdrawal',
        amt,
        `[ADMIN] ${txnDesc}`
      ]
    );

    // Notify the user
    const icon = type === 'credit' ? '💰' : '💸';
    const amtStr = `₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    await db.query(
      `INSERT INTO notifications (id, user_id, title, body, type) VALUES (UUID(), ?, ?, ?, 'transaction')`,
      [
        userId,
        `${icon} Account ${type === 'credit' ? 'Credited' : 'Debited'} — ${amtStr}`,
        `${amtStr} has been ${type === 'credit' ? 'added to' : 'deducted from'} your account by the bank administrator. ${txnDesc ? 'Reason: ' + txnDesc : ''}`
      ]
    ).catch(() => {});

    sendSuccess(res, { new_balance: newBalance, account_number: acc.account_number }, `Account ${type}ed successfully by ₹${amt}`);
  } catch (err) { next(err); }
};


// GET /api/admin/users/:id/full — complete user data aggregated
const getUserFull = async (req, res, next) => {
  try {
    const uid = req.params.id;

    // Core user profile
    const [[user]] = await db.query(
      `SELECT u.*, TIMESTAMPDIFF(YEAR, u.date_of_birth, CURDATE()) AS age
       FROM users u WHERE u.id = ?`, [uid]
    );
    if (!user) return sendError(res, 404, 'User not found');
    const { password_hash, ...safeUser } = user;

    // Accounts
    const [accounts] = await db.query(
      `SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at ASC`, [uid]
    );

    // Cards — decode full number for admin view (stored as enc_XXXXXXXXXXXXXXXX)
    const [cardsRaw] = await db.query(
      `SELECT c.*, a.account_number FROM cards c
       LEFT JOIN accounts a ON c.account_id = a.id
       WHERE c.user_id = ? ORDER BY c.created_at DESC`, [uid]
    );
    const cards = cardsRaw.map(c => {
      const raw = (c.card_number_encrypted || '').replace(/^enc_/, '');
      const full = raw.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
      return { ...c, card_number_full: full || c.card_number_masked };
    });


    // UPI IDs
    const [upiIds] = await db.query(
      `SELECT u.*, a.account_number FROM upi_ids u
       LEFT JOIN accounts a ON u.account_id = a.id
       WHERE u.user_id = ? ORDER BY u.is_primary DESC, u.created_at DESC`, [uid]
    );

    // Beneficiaries
    const [beneficiaries] = await db.query(
      `SELECT b.*, b.nickname AS beneficiary_name FROM beneficiaries b WHERE b.user_id = ? ORDER BY b.created_at DESC`, [uid]
    );

    // Loans
    const [loans] = await db.query(
      `SELECT * FROM loans WHERE user_id = ? ORDER BY applied_at DESC`, [uid]
    );

    // Bills (recent 20)
    const [bills] = await db.query(
      `SELECT * FROM bills WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, [uid]
    );

    sendSuccess(res, {
      user: safeUser,
      accounts,
      cards,
      upiIds,
      beneficiaries,
      loans,
      bills,
    });
  } catch (err) { next(err); }
};

// GET /api/admin/users/:id/transactions — paginated user transactions
const getUserTransactions = async (req, res, next) => {
  try {
    const uid = req.params.id;
    const { page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;

    // Step 1: get all account IDs for this user
    const [accs] = await db.query(
      `SELECT id, account_number FROM accounts WHERE user_id = ?`, [uid]
    );
    if (accs.length === 0) return sendSuccess(res, []);

    const accIds = accs.map(a => a.id);
    const placeholders = accIds.map(() => '?').join(',');

    // Step 2: fetch ALL transactions where user is sender OR receiver (including bills with NULL to_account_id)
    const [rows] = await db.query(
      `SELECT t.*,
         fa.account_number AS from_acc,
         ta.account_number AS to_acc,
         fu.full_name      AS from_user,
         tu.full_name      AS to_user
       FROM transactions t
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id   = ta.id
       LEFT JOIN users    fu ON fa.user_id = fu.id
       LEFT JOIN users    tu ON ta.user_id = tu.id
       WHERE t.from_account_id IN (${placeholders})
          OR t.to_account_id   IN (${placeholders})
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...accIds, ...accIds, parseInt(limit), parseInt(offset)]
    );

    // Step 3: compute direction in JS (avoids complex repeated CASE placeholders)
    const accIdSet = new Set(accIds);
    const result = rows.map(t => {
      let direction;
      const fromMine = accIdSet.has(t.from_account_id);
      const toMine   = accIdSet.has(t.to_account_id);
      if (fromMine && toMine)              direction = 'SELF';
      else if (fromMine && !t.to_account_id) direction = 'SENT';   // bills, debits
      else if (fromMine)                   direction = 'SENT';
      else                                 direction = 'RECEIVED';
      return { ...t, direction };
    });

    sendSuccess(res, result);
  } catch (err) { next(err); }
};


// PUT /api/admin/cards/:id/freeze — toggle card freeze
const toggleCardFreeze = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id, is_frozen FROM cards WHERE id=?', [req.params.id]);
    if (rows.length === 0) return sendError(res, 404, 'Card not found');
    const newState = !rows[0].is_frozen;
    await db.query('UPDATE cards SET is_frozen=? WHERE id=?', [newState, req.params.id]);
    sendSuccess(res, { is_frozen: newState }, `Card ${newState ? 'frozen' : 'unfrozen'}`);
  } catch (err) { next(err); }
};

// PUT /api/admin/upi/:id/toggle — toggle UPI active
const toggleUPI = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id, is_active FROM upi_ids WHERE id=?', [req.params.id]);
    if (rows.length === 0) return sendError(res, 404, 'UPI ID not found');
    const newState = !rows[0].is_active;
    await db.query('UPDATE upi_ids SET is_active=? WHERE id=?', [newState, req.params.id]);
    sendSuccess(res, { is_active: newState }, `UPI ID ${newState ? 'activated' : 'deactivated'}`);
  } catch (err) { next(err); }
};

// ── FAQ CRUD ──────────────────────────────────────────────────────────────────

// GET /api/admin/faq
const getFAQs = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM faqs ORDER BY sort_order ASC, created_at ASC`
    );
    sendSuccess(res, rows);
  } catch (err) { next(err); }
};

// POST /api/admin/faq
const createFAQ = async (req, res, next) => {
  try {
    const { question, answer, category, sort_order } = req.body;
    if (!question || !answer) return sendError(res, 400, 'Question and answer are required');
    await db.query(
      `INSERT INTO faqs (id, question, answer, category, sort_order, created_by) VALUES (UUID(),?,?,?,?,?)`,
      [question, answer, category || 'general', sort_order || 0, req.user.id]
    );
    sendSuccess(res, {}, 'FAQ created');
  } catch (err) { next(err); }
};

// PUT /api/admin/faq/:id
const updateFAQ = async (req, res, next) => {
  try {
    const { question, answer, category, sort_order, is_active } = req.body;
    const updates = []; const params = [];
    if (question !== undefined)    { updates.push('question=?');    params.push(question); }
    if (answer !== undefined)      { updates.push('answer=?');      params.push(answer); }
    if (category !== undefined)    { updates.push('category=?');    params.push(category); }
    if (sort_order !== undefined)  { updates.push('sort_order=?');  params.push(sort_order); }
    if (is_active !== undefined)   { updates.push('is_active=?');   params.push(is_active); }
    if (updates.length === 0) return sendError(res, 400, 'No fields to update');
    params.push(req.params.id);
    await db.query(`UPDATE faqs SET ${updates.join(', ')} WHERE id=?`, params);
    sendSuccess(res, {}, 'FAQ updated');
  } catch (err) { next(err); }
};

// DELETE /api/admin/faq/:id
const deleteFAQ = async (req, res, next) => {
  try {
    await db.query('DELETE FROM faqs WHERE id=?', [req.params.id]);
    sendSuccess(res, {}, 'FAQ deleted');
  } catch (err) { next(err); }
};

// ── KYC Management ───────────────────────────────────────────────────────────
// PUT /api/admin/kyc/:userId
const manageKYC = async (req, res, next) => {
  try {
    const { action, pan_number, aadhaar_number, reason } = req.body;
    const uid = req.params.userId;
    const [[user]] = await db.query(
      'SELECT id,kyc_status,pending_pan,pending_aadhaar,pan_number,aadhaar_number,ckyc_number,ckyc_locked FROM users WHERE id=?',
      [uid]
    );
    if (!user) return sendError(res, 404, 'User not found');

    if (action === 'update_docs') {
      const updates = []; const params = [];
      if (pan_number !== undefined)     { updates.push('pending_pan=?');     params.push(pan_number); }
      if (aadhaar_number !== undefined) { updates.push('pending_aadhaar=?'); params.push(aadhaar_number); }
      if (!updates.length) return sendError(res, 400, 'No docs to update');
      params.push(uid);
      await db.query(`UPDATE users SET ${updates.join(', ')}, kyc_submitted_at=NOW() WHERE id=?`, params);
      return sendSuccess(res, {}, 'KYC documents saved');
    }

    if (action === 'approve') {
      // CKYC immutable: generate once, never overwrite
      let ckycNum = user.ckyc_number;
      if (!ckycNum) {
        ckycNum = 'CKYC' + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 6).toUpperCase();
      }

      // Use admin-provided values or fall back to pending or existing
      const finalPan     = pan_number     || user.pending_pan     || user.pan_number     || null;
      const finalAadhaar = aadhaar_number || user.pending_aadhaar || user.aadhaar_number || null;

      await db.query(
        `UPDATE users SET
           kyc_status     = 'verified',
           pan_number     = COALESCE(?, pan_number),
           aadhaar_number = COALESCE(?, aadhaar_number),
           ckyc_number    = ?,
           ckyc_locked    = TRUE,
           pending_pan    = NULL,
           pending_aadhaar= NULL,
           pending_change_type = NULL,
           kyc_verified_at = NOW()
         WHERE id=?`,
        [finalPan, finalAadhaar, ckycNum, uid]
      );
      await db.query(
        `INSERT INTO notifications (id,user_id,title,body,type) VALUES (UUID(),?,?,?,'system')`,
        [uid, '\u2705 KYC Verified!',
         `Your KYC has been approved by the administrator. CKYC Number: ${ckycNum}. PAN & Aadhaar are now locked. Your account is fully verified.`]
      );
      return sendSuccess(res, { ckyc_number: ckycNum }, `KYC approved — CKYC: ${ckycNum}`);
    }

    if (action === 'reject') {
      await db.query(`UPDATE users SET kyc_status='rejected' WHERE id=?`, [uid]);
      await db.query(
        `INSERT INTO notifications (id,user_id,title,body,type) VALUES (UUID(),?,?,?,'system')`,
        [uid, '\u274c KYC Rejected', `Your KYC was rejected. Reason: ${reason || 'Documents did not meet requirements. Please re-submit.'}`]
      );
      return sendSuccess(res, {}, 'KYC rejected');
    }

    return sendError(res, 400, 'Invalid action');
  } catch (err) { next(err); }
};

// ── Card Limit & Permanent Delete ────────────────────────────────────────────
// PUT /api/admin/cards/:id/limit
const updateCardLimit = async (req, res, next) => {
  try {
    const { spending_limit, credit_limit, daily_atm_limit } = req.body;
    const [rows] = await db.query('SELECT id,user_id,card_type FROM cards WHERE id=?', [req.params.id]);
    if (!rows.length) return sendError(res, 404, 'Card not found');
    const updates = []; const params = [];
    if (spending_limit  !== undefined) { updates.push('spending_limit=?');  params.push(parseFloat(spending_limit)); }
    if (credit_limit    !== undefined && rows[0].card_type === 'credit') { updates.push('credit_limit=?'); params.push(parseFloat(credit_limit)); }
    if (daily_atm_limit !== undefined) { updates.push('daily_atm_limit=?'); params.push(parseFloat(daily_atm_limit)); }
    if (!updates.length) return sendError(res, 400, 'No limit fields');
    params.push(req.params.id);
    await db.query(`UPDATE cards SET ${updates.join(', ')} WHERE id=?`, params);
    await db.query(`INSERT INTO notifications (id,user_id,title,body,type) VALUES (UUID(),?,?,?,'system')`,
      [rows[0].user_id, '\ud83d\udcb3 Card Limits Updated', 'Your card spending limits have been updated by the bank administrator.']);
    sendSuccess(res, {}, 'Card limits updated');
  } catch (err) { next(err); }
};

// DELETE /api/admin/cards/:id/permanent
const permanentDeleteCard = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id,user_id,card_number_masked FROM cards WHERE id=?', [req.params.id]);
    if (!rows.length) return sendError(res, 404, 'Card not found');
    await db.query('DELETE FROM cards WHERE id=?', [req.params.id]);
    await db.query(`INSERT INTO notifications (id,user_id,title,body,type) VALUES (UUID(),?,?,?,'system')`,
      [rows[0].user_id, '\ud83d\uddd1\ufe0f Card Permanently Removed', `Your card ending ${rows[0].card_number_masked?.slice(-4)} has been permanently deleted by the bank administrator.`]);
    sendSuccess(res, {}, 'Card permanently deleted');
  } catch (err) { next(err); }
};

// ── Transaction Freeze / Refund ──────────────────────────────────────────────
// POST /api/admin/transactions/:id/freeze
const freezeRefundTransaction = async (req, res, next) => {
  try {
    const { refund = false, reason } = req.body;
    const txnId = req.params.id;
    const { v4: uuidv4 } = require('uuid');

    const [[txn]] = await db.query(
      `SELECT t.*, fa.user_id AS sender_uid, ta.user_id AS receiver_uid
       FROM transactions t
       LEFT JOIN accounts fa ON t.from_account_id=fa.id
       LEFT JOIN accounts ta ON t.to_account_id=ta.id
       WHERE t.id=?`, [txnId]
    );
    if (!txn) return sendError(res, 404, 'Transaction not found');
    if (txn.status === 'reversed') return sendError(res, 400, 'Already reversed');

    const newStatus = refund ? 'reversed' : 'frozen';
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      await conn.query('UPDATE transactions SET status=?, fraud_flagged=TRUE WHERE id=?', [newStatus, txnId]);

      if (refund && txn.from_account_id && txn.to_account_id) {
        const amt = parseFloat(txn.amount);
        const [[rec]] = await conn.query('SELECT balance FROM accounts WHERE id=?', [txn.to_account_id]);
        const [[snd]] = await conn.query('SELECT balance FROM accounts WHERE id=?', [txn.from_account_id]);
        const newRecBal = Math.max(0, parseFloat(rec.balance) - amt);
        const newSndBal = parseFloat(snd.balance) + amt;
        await conn.query('UPDATE accounts SET balance=? WHERE id=?', [newRecBal, txn.to_account_id]);
        await conn.query('UPDATE accounts SET balance=? WHERE id=?', [newSndBal, txn.from_account_id]);
        await conn.query(
          `INSERT INTO transactions (id,from_account_id,to_account_id,amount,type,category,description,reference_number,balance_after,status)
           VALUES (?,?,?,?,'refund','admin_refund',?,?,?,'completed')`,
          [uuidv4(), txn.to_account_id, txn.from_account_id, amt,
           `[ADMIN REFUND] ${reason || 'Reversed by admin'}`, `REF-${txnId.slice(0,8)}`, newSndBal]
        );
        if (txn.sender_uid)   await conn.query(`INSERT INTO notifications (id,user_id,title,body,type) VALUES (UUID(),?,?,?,'transaction')`, [txn.sender_uid,   '\ud83d\udcb0 Refund Credited!', `\u20b9${amt.toLocaleString('en-IN')} refunded to your account. Reason: ${reason || 'Admin reversal'}`]);
        if (txn.receiver_uid) await conn.query(`INSERT INTO notifications (id,user_id,title,body,type) VALUES (UUID(),?,?,?,'transaction')`, [txn.receiver_uid, '\u26a0\ufe0f Transaction Reversed', `A \u20b9${amt.toLocaleString('en-IN')} transaction has been reversed by the bank administrator.`]);
      } else if (!refund && txn.sender_uid) {
        await conn.query(`INSERT INTO notifications (id,user_id,title,body,type) VALUES (UUID(),?,?,?,'system')`,
          [txn.sender_uid, '\ud83d\udd12 Transaction Frozen', `A transaction of \u20b9${parseFloat(txn.amount).toLocaleString('en-IN')} has been frozen. Reason: ${reason || 'Under review'}`]);
      }

      await conn.commit(); conn.release();
      sendSuccess(res, { status: newStatus }, refund ? 'Refunded to sender' : 'Transaction frozen');
    } catch (e) { await conn.rollback(); conn.release(); throw e; }
  } catch (err) { next(err); }
};

// GET /api/admin/users/:id/transactions/export
const exportUserTransactions = async (req, res, next) => {
  try {
    const uid = req.params.id;
    const [[user]] = await db.query('SELECT full_name,email,phone FROM users WHERE id=?', [uid]);
    if (!user) return sendError(res, 404, 'User not found');
    const [txns] = await db.query(
      `SELECT t.*,
         fa.account_number as from_acc, ta.account_number as to_acc,
         fu.full_name as from_user, tu.full_name as to_user
       FROM transactions t
       LEFT JOIN accounts fa ON t.from_account_id=fa.id
       LEFT JOIN accounts ta ON t.to_account_id=ta.id
       LEFT JOIN users fu ON fa.user_id=fu.id
       LEFT JOIN users tu ON ta.user_id=tu.id
       WHERE fa.user_id=? OR ta.user_id=?
       ORDER BY t.created_at DESC`, [uid, uid]
    );
    sendSuccess(res, { user, transactions: txns });
  } catch (err) { next(err); }
};

// ── Beneficiary Management ────────────────────────────────────────────────────
// POST /api/admin/users/:id/beneficiaries
const addBeneficiary = async (req, res, next) => {
  try {
    const { beneficiary_name, account_number, ifsc_code, bank_name, phone } = req.body;
    const uid = req.params.id;
    if (!beneficiary_name || !account_number || !ifsc_code) return sendError(res, 400, 'Name, account number and IFSC are required');
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    await db.query(
      `INSERT INTO beneficiaries (id, user_id, beneficiary_name, account_number, ifsc_code, bank_name, phone, is_verified)
       VALUES (?,?,?,?,?,?,?,TRUE)`,
      [id, uid, beneficiary_name, account_number, ifsc_code, bank_name || '', phone || '']
    );
    await db.query(
      `INSERT INTO notifications (id,user_id,title,body,type) VALUES (UUID(),?,?,?,'system')`,
      [uid, '✅ Beneficiary Added', `A new beneficiary "${beneficiary_name}" (${account_number}) has been added to your account by the bank administrator.`]
    );
    const [[newBen]] = await db.query('SELECT * FROM beneficiaries WHERE id=?', [id]);
    sendSuccess(res, newBen, 'Beneficiary added successfully');
  } catch (err) { next(err); }
};

// DELETE /api/admin/beneficiaries/:id
const deleteBeneficiary = async (req, res, next) => {
  try {
    const [[ben]] = await db.query('SELECT id,user_id,beneficiary_name FROM beneficiaries WHERE id=?', [req.params.id]);
    if (!ben) return sendError(res, 404, 'Beneficiary not found');
    await db.query('DELETE FROM beneficiaries WHERE id=?', [req.params.id]);
    await db.query(
      `INSERT INTO notifications (id,user_id,title,body,type) VALUES (UUID(),?,?,?,'system')`,
      [ben.user_id, '🗑️ Beneficiary Removed', `Beneficiary "${ben.beneficiary_name}" has been removed from your account by the bank administrator.`]
    );
    sendSuccess(res, {}, 'Beneficiary deleted');
  } catch (err) { next(err); }
};

// ── Admin Give Loan ───────────────────────────────────────────────────────────
// POST /api/admin/users/:id/loans
const adminGiveLoan = async (req, res, next) => {
  try {
    const { loan_type, amount, interest_rate, tenure_months, purpose, auto_credit = true } = req.body;
    const uid = req.params.id;
    const { v4: uuidv4 } = require('uuid');

    if (!amount || !interest_rate || !tenure_months) return sendError(res, 400, 'Amount, interest rate and tenure required');
    const principal = parseFloat(amount);
    const rate      = parseFloat(interest_rate) / 100 / 12;
    const n         = parseInt(tenure_months);
    const emiAmount = rate === 0
      ? principal / n
      : (principal * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
    const totalPayable = emiAmount * n;

    // Find user's primary account
    const [accounts] = await db.query(
      'SELECT id, balance FROM accounts WHERE user_id=? AND status="active" ORDER BY created_at ASC LIMIT 1',
      [uid]
    );
    if (!accounts.length) return sendError(res, 404, 'No active account for user');
    const acc = accounts[0];

    // Compute next EMI date (1 month from today)
    const nextEmiDate = new Date();
    nextEmiDate.setMonth(nextEmiDate.getMonth() + 1);

    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      // Create loan record
      const loanId = uuidv4();
      await conn.query(
        `INSERT INTO loans (id,user_id,account_id,loan_type,amount_requested,amount_approved,interest_rate,
           tenure_months,emi_amount,total_payable,status,purpose,applied_at,approved_at,next_emi_date,admin_remarks)
         VALUES (?,?,?,?,?,?,?,?,?,?,'approved',?,NOW(),NOW(),?,?)`,
        [loanId, uid, acc.id, loan_type||'personal', principal, principal, parseFloat(interest_rate),
         n, parseFloat(emiAmount.toFixed(2)), parseFloat(totalPayable.toFixed(2)),
         purpose||'Admin-issued loan', nextEmiDate, 'Directly issued by admin']
      );

      if (auto_credit) {
        // Credit money to account
        const newBalance = parseFloat(acc.balance) + principal;
        await conn.query('UPDATE accounts SET balance=? WHERE id=?', [newBalance, acc.id]);

        // Record transaction
        const refNum = `LOAN-ADM-${Date.now()}`;
        await conn.query(
          `INSERT INTO transactions (id,to_account_id,amount,type,category,description,reference_number,balance_after,status)
           VALUES (?,?,?,'loan_credit','loan',?,?,?,'completed')`,
          [uuidv4(), acc.id, principal, `Admin Loan Disbursement — ${loan_type||'personal'} loan`, refNum, newBalance]
        );

        // Notify user
        await conn.query(
          `INSERT INTO notifications (id,user_id,title,body,type) VALUES (UUID(),?,?,?,'loan')`,
          [uid,
           '🎉 Loan Approved & Disbursed!',
           `A ${loan_type||'personal'} loan of ₹${principal.toLocaleString('en-IN')} has been credited to your account by the bank. EMI: ₹${emiAmount.toFixed(2)}/month for ${n} months. Total payable: ₹${totalPayable.toFixed(2)}.`]
        );
      }

      await conn.commit();
      conn.release();
      sendSuccess(res, {
        loan_id: loanId, emi_amount: emiAmount.toFixed(2),
        total_payable: totalPayable.toFixed(2),
        next_emi_date: nextEmiDate
      }, auto_credit ? 'Loan created and amount credited to user account' : 'Loan created');
    } catch (e) { await conn.rollback(); conn.release(); throw e; }
  } catch (err) { next(err); }
};

// POST /api/admin/loans/:id/process-emi — manually trigger EMI deduction
const processEMI = async (req, res, next) => {
  try {
    const { v4: uuidv4 } = require('uuid');
    const [[loan]] = await db.query(
      `SELECT l.*,a.balance,a.user_id FROM loans l JOIN accounts a ON l.account_id=a.id WHERE l.id=?`,
      [req.params.id]
    );
    if (!loan) return sendError(res, 404, 'Loan not found');
    if (loan.status !== 'approved') return sendError(res, 400, 'Only approved loans can have EMI processed');

    const emiAmt = parseFloat(loan.emi_amount);
    const balance = parseFloat(loan.balance);
    if (balance < emiAmt) return sendError(res, 400, `Insufficient balance (₹${balance.toFixed(2)}) to deduct EMI of ₹${emiAmt.toFixed(2)}`);

    const newBalance = balance - emiAmt;
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      await conn.query('UPDATE accounts SET balance=? WHERE id=?', [newBalance, loan.account_id]);

      // Compute next EMI date
      const nextDate = new Date(loan.next_emi_date || Date.now());
      nextDate.setMonth(nextDate.getMonth() + 1);

      // Track EMIs paid
      const emisPaid = (loan.emis_paid || 0) + 1;
      const loanDone = emisPaid >= loan.tenure_months;
      await conn.query(
        'UPDATE loans SET emis_paid=?, next_emi_date=?, status=? WHERE id=?',
        [emisPaid, nextDate, loanDone ? 'disbursed' : 'approved', loan.id]
      );

      await conn.query(
        `INSERT INTO transactions (id,from_account_id,amount,type,category,description,reference_number,balance_after,status)
         VALUES (?,?,?,'loan_emi','loan',?,?,?,'completed')`,
        [uuidv4(), loan.account_id, emiAmt,
         `EMI ${emisPaid}/${loan.tenure_months} — ${loan.loan_type} loan`, `EMI-${loan.id.slice(0,8)}-${emisPaid}`, newBalance]
      );

      await conn.query(
        `INSERT INTO notifications (id,user_id,title,body,type) VALUES (UUID(),?,?,?,'loan')`,
        [loan.user_id,
         loanDone ? '🎉 Loan Fully Repaid!' : `📅 EMI ${emisPaid}/${loan.tenure_months} Deducted`,
         loanDone
           ? `Congratulations! Your ${loan.loan_type} loan has been fully repaid. Thank you!`
           : `EMI ${emisPaid} of ${loan.tenure_months} (₹${emiAmt.toLocaleString('en-IN')}) has been deducted. Remaining: ${loan.tenure_months - emisPaid} EMIs.`]
      );

      await conn.commit();
      conn.release();
      sendSuccess(res, { emis_paid: emisPaid, loan_closed: loanDone, new_balance: newBalance },
        loanDone ? 'Final EMI processed — loan fully repaid' : `EMI ${emisPaid}/${loan.tenure_months} processed`);
    } catch (e) { await conn.rollback(); conn.release(); throw e; }
  } catch (err) { next(err); }
};

// GET /api/admin/users/:id/loans/export
const exportUserLoans = async (req, res, next) => {
  try {
    const uid = req.params.id;
    const [[user]] = await db.query('SELECT full_name,email,phone FROM users WHERE id=?', [uid]);
    if (!user) return sendError(res, 404, 'User not found');
    const [loans] = await db.query(
      `SELECT l.*, a.account_number FROM loans l
       LEFT JOIN accounts a ON l.account_id=a.id
       WHERE l.user_id=? ORDER BY l.applied_at DESC`, [uid]
    );
    sendSuccess(res, { user, loans });
  } catch (err) { next(err); }
};

// ── Admin Send Message / Notification to User ─────────────────────────────────
// POST /api/admin/users/:id/message
const sendUserMessage = async (req, res, next) => {
  try {
    const { title, body, type = 'system', channel = 'notification' } = req.body;
    const uid = req.params.id;
    if (!title || !body) return sendError(res, 400, 'Title and body are required');

    const [[user]] = await db.query('SELECT id, full_name, email FROM users WHERE id=?', [uid]);
    if (!user) return sendError(res, 404, 'User not found');

    // Always create in-app notification
    await db.query(
      `INSERT INTO notifications (id, user_id, title, body, type) VALUES (UUID(), ?, ?, ?, ?)`,
      [uid, title, body, type]
    );

    // If channel is 'ticket', also create a support ticket from admin
    if (channel === 'ticket') {
      const { v4: uuidv4 } = require('uuid');
      const ticketId = uuidv4();
      await db.query(
        `INSERT INTO support_tickets (id, user_id, subject, category, priority, status, created_at)
         VALUES (?, ?, ?, 'general', 'medium', 'open', NOW())`,
        [ticketId, uid, title]
      ).catch(() => {}); // ignore if table structure differs

      await db.query(
        `INSERT INTO ticket_messages (id, ticket_id, sender_role, message, created_at)
         VALUES (UUID(), ?, 'admin', ?, NOW())`,
        [ticketId, body]
      ).catch(() => {});
    }

    sendSuccess(res, { user: user.full_name, channel, title },
      channel === 'ticket' ? 'Message sent & ticket created' : 'Message sent successfully');
  } catch (err) { next(err); }
};

// ── Admin Reset User Password ─────────────────────────────────────────────────
// PUT /api/admin/users/:id/reset-password
const resetUserPassword = async (req, res, next) => {
  try {
    const { new_password } = req.body;
    const uid = req.params.id;
    if (!new_password || new_password.length < 8) return sendError(res, 400, 'Password must be at least 8 characters');

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(new_password, 12);

    const [[user]] = await db.query("SELECT id, full_name FROM users WHERE id=? AND role != 'admin'", [uid]);
    if (!user) return sendError(res, 404, 'User not found');

    await db.query('UPDATE users SET password_hash=? WHERE id=?', [hash, uid]);

    await db.query(
      `INSERT INTO notifications (id, user_id, title, body, type) VALUES (UUID(), ?, ?, ?, 'system')`,
      [uid, '🔑 Password Reset by Admin', 'Your account password has been reset by the bank administrator. Please log in with your new password.']
    ).catch(() => {});

    sendSuccess(res, { user: user.full_name }, 'Password reset successfully');
  } catch (err) { next(err); }
};

// ── Admin Database Stats ──────────────────────────────────────────────────────
// GET /api/admin/db/stats
const getDbStats = async (req, res, next) => {
  try {
    const dbName = process.env.DB_NAME || 'money_mitra';

    // Table sizes + row counts from information_schema
    const [tables] = await db.query(
      `SELECT TABLE_NAME as name,
         TABLE_ROWS as row_count,
         ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024, 1) as size_kb,
         CREATE_TIME as created_at,
         UPDATE_TIME as updated_at
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC`,
      [dbName]
    );

    // Live counts for key tables (exact, not estimated)
    const countTables = ['users','accounts','transactions','loans','beneficiaries','notifications','cards','upi_ids','bills','support_tickets','faqs'];
    const liveCounts = {};
    await Promise.all(
      countTables.map(async t => {
        try {
          const [[row]] = await db.query(`SELECT COUNT(*) as c FROM \`${t}\``);
          liveCounts[t] = row.c;
        } catch { liveCounts[t] = 'N/A'; }
      })
    );

    // Recent activity summary
    const [[recentTxn]] = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as volume FROM transactions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    ).catch(() => [[{ count: 0, volume: 0 }]]);
    const [[recentUsers]] = await db.query(
      `SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    ).catch(() => [[{ count: 0 }]]);

    sendSuccess(res, {
      database: dbName,
      tables,
      live_counts: liveCounts,
      last_24h: {
        new_users: recentUsers.count,
        transactions: recentTxn.count,
        transaction_volume: recentTxn.volume,
      }
    });
  } catch (err) { next(err); }
};

// ── Admin Run Preset Query ────────────────────────────────────────────────────
// POST /api/admin/db/query
const runPresetQuery = async (req, res, next) => {
  try {
    const { query_id } = req.body;

    const PRESET_QUERIES = {
      top_users_balance:   `SELECT u.full_name, u.email, COALESCE(SUM(a.balance),0) as total_balance FROM users u LEFT JOIN accounts a ON u.id=a.user_id WHERE u.role='user' GROUP BY u.id ORDER BY total_balance DESC LIMIT 10`,
      top_transactions:    `SELECT t.id, t.amount, t.type, t.description, t.created_at, fa.account_number as from_acc, ta.account_number as to_acc FROM transactions t LEFT JOIN accounts fa ON t.from_account_id=fa.id LEFT JOIN accounts ta ON t.to_account_id=ta.id ORDER BY t.amount DESC LIMIT 20`,
      pending_kyc:         `SELECT id, full_name, email, phone, kyc_status, kyc_submitted_at FROM users WHERE kyc_status IN ('pending','rejected') ORDER BY kyc_submitted_at DESC`,
      active_loans:        `SELECT l.*, u.full_name, u.email FROM loans l JOIN users u ON l.user_id=u.id WHERE l.status='approved' ORDER BY l.applied_at DESC`,
      fraud_transactions:  `SELECT t.*, fa.account_number, fu.full_name as sender FROM transactions t LEFT JOIN accounts fa ON t.from_account_id=fa.id LEFT JOIN users fu ON fa.user_id=fu.id WHERE t.fraud_flagged=TRUE ORDER BY t.created_at DESC LIMIT 30`,
      inactive_users:      `SELECT id, full_name, email, last_login, created_at FROM users WHERE role='user' AND (last_login IS NULL OR last_login < DATE_SUB(NOW(), INTERVAL 30 DAY)) ORDER BY last_login ASC LIMIT 20`,
      daily_stats:         `SELECT DATE(created_at) as date, COUNT(*) as transactions, COALESCE(SUM(amount),0) as volume FROM transactions GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30`,
      loan_summary:        `SELECT loan_type, status, COUNT(*) as count, COALESCE(SUM(amount_approved),0) as total_approved FROM loans GROUP BY loan_type, status ORDER BY loan_type, status`,
    };

    if (!PRESET_QUERIES[query_id]) return sendError(res, 400, 'Invalid preset query ID');

    const [rows] = await db.query(PRESET_QUERIES[query_id]);
    sendSuccess(res, { query_id, rows, count: rows.length });
  } catch (err) { next(err); }
};

// ── Admin Close User Account ──────────────────────────────────────────────────
// DELETE /api/admin/users/:id/close-account
const closeUserAccount = async (req, res, next) => {
  try {
    const { confirm_text, reason } = req.body;
    if (confirm_text !== 'CLOSE') return sendError(res, 400, 'Type CLOSE to confirm account closure');

    const [[user]] = await db.query("SELECT id, full_name, email FROM users WHERE id=? AND role != 'admin'", [req.params.id]);
    if (!user) return sendError(res, 404, 'User not found');

    await db.query("UPDATE users SET is_active=FALSE, account_closed_at=NOW(), refresh_token=NULL WHERE id=?", [req.params.id]);

    // Notify user
    await db.query(
      `INSERT INTO notifications (id, user_id, title, body, type) VALUES (UUID(), ?, '⛔ Account Closed', ?, 'system')`,
      [req.params.id, `Your account has been closed by the administrator. Reason: ${reason || 'Policy violation / Admin decision'}. Contact support for assistance.`]
    );

    sendSuccess(res, { user: user.full_name }, 'Account closed successfully');
  } catch (err) { next(err); }
};

// ── Admin Create User ─────────────────────────────────────────────────────────
// POST /api/admin/users/create
const createUser = async (req, res, next) => {
  try {
    const { full_name, email, phone, password, role = 'user', initial_balance = 0, account_type = 'savings', occupation, annual_income, gender, date_of_birth, nationality = 'Indian' } = req.body;

    if (!full_name || !email || !phone || !password) return sendError(res, 400, 'Name, email, phone and password are required');
    if (password.length < 8) return sendError(res, 400, 'Password must be at least 8 characters');

    const [exists] = await db.query('SELECT id FROM users WHERE email=? OR phone=?', [email, phone]);
    if (exists.length > 0) return sendError(res, 409, 'Email or phone already registered');

    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    const { generateAccountNumber } = require('../../utils/helpers');

    const hash = await bcrypt.hash(password, 12);
    const uid = uuidv4();
    const accountId = uuidv4();
    const accountNumber = generateAccountNumber();
    const balance = Math.max(0, parseFloat(initial_balance) || 0);
    const dob = date_of_birth ? date_of_birth.toString().slice(0, 10) : null;

    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      await conn.query(
        `INSERT INTO users (id, full_name, email, phone, password_hash, role, kyc_status, gender, date_of_birth, occupation, annual_income, nationality)
         VALUES (?,?,?,?,?,?,'pending',?,?,?,?,?)`,
        [uid, full_name, email, phone, hash, role, gender || null, dob, occupation || null, annual_income || null, nationality]
      );
      await conn.query(
        `INSERT INTO accounts (id, user_id, account_number, account_type, balance) VALUES (?,?,?,?,?)`,
        [accountId, uid, accountNumber, account_type, balance]
      );
      const upiHandle = `${email.split('@')[0]}@moneymitra`;
      await conn.query(
        `INSERT INTO upi_ids (id, user_id, account_id, upi_handle, is_primary) VALUES (UUID(),?,?,?,TRUE)`,
        [uid, accountId, upiHandle]
      );
      if (balance > 0) {
        await conn.query(
          `INSERT INTO transactions (id, to_account_id, amount, type, category, description, reference_number, balance_after) VALUES (UUID(),?,?,'credit','general','Initial balance by Admin',?,?)`,
          [accountId, balance, `ADMIN${Date.now()}`, balance]
        );
      }
      await conn.query(
        `INSERT INTO notifications (id, user_id, title, body, type) VALUES (UUID(),?,?,?,'system')`,
        [uid, '🎉 Account Created by Admin', `Welcome ${full_name}! Your Money Mitra account #${accountNumber} has been created by the administrator. You can now login.`]
      );
      await conn.commit();
    } catch (e) { await conn.rollback(); conn.release(); throw e; }
    conn.release();

    sendSuccess(res, { uid, accountNumber, upiHandle, balance }, `User created successfully`, 201);
  } catch (err) { next(err); }
};

module.exports = {
  getAllUsers, getUser, updateUser, toggleUserStatus,
  getAllTransactions, getAllLoans, approveLoan, getStats, adjustBalance,
  getUserFull, getUserTransactions, toggleCardFreeze, toggleUPI,
  getFAQs, createFAQ, updateFAQ, deleteFAQ,
  manageKYC, updateCardLimit, permanentDeleteCard,
  freezeRefundTransaction, exportUserTransactions,
  addBeneficiary, deleteBeneficiary,
  adminGiveLoan, processEMI, exportUserLoans,
  sendUserMessage, resetUserPassword, getDbStats, runPresetQuery,
  closeUserAccount, createUser,
};
