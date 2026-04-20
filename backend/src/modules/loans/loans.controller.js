const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const { calculateEMI } = require('../../utils/helpers');
const { sendSuccess, sendError } = require('../../utils/response');

// GET /api/loans
const getLoans = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM loans WHERE user_id = ? ORDER BY applied_at DESC',
      [req.user.id]
    );
    sendSuccess(res, rows);
  } catch (err) { next(err); }
};

// POST /api/loans/apply
const applyLoan = async (req, res, next) => {
  try {
    const { account_id, loan_type = 'personal', amount_requested, tenure_months, purpose } = req.body;

    if (!amount_requested || !tenure_months) {
      return sendError(res, 400, 'amount_requested and tenure_months required');
    }

    const amount = parseFloat(amount_requested);
    if (amount < 10000 || amount > 5000000) {
      return sendError(res, 400, 'Loan amount must be between ₹10,000 and ₹50,00,000');
    }

    const rateMap = { personal: 12.5, home: 8.5, education: 9.0, vehicle: 10.0, gold: 7.5 };
    const rate = rateMap[loan_type] || 12.5;
    const emi = calculateEMI(amount, rate, tenure_months);
    const total = Math.round(emi * tenure_months * 100) / 100;
    const loanId = uuidv4();

    await db.query(
      `INSERT INTO loans (id, user_id, account_id, loan_type, amount_requested, interest_rate, tenure_months, emi_amount, total_payable, purpose)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [loanId, req.user.id, account_id, loan_type, amount, rate, tenure_months, emi, total, purpose]
    );

    await db.query(
      `INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,'loan')`,
      [uuidv4(), req.user.id, '📋 Loan Application Received', `Your ${loan_type} loan application for ₹${amount.toLocaleString('en-IN')} is under review. EMI: ₹${emi.toLocaleString('en-IN')}/month`]
    );

    sendSuccess(res, { id: loanId, emi_amount: emi, interest_rate: rate, total_payable: total }, 'Loan application submitted successfully', 201);
  } catch (err) { next(err); }
};

// GET /api/loans/:id
const getLoan = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT l.*, a.account_number FROM loans l LEFT JOIN accounts a ON l.account_id = a.id WHERE l.id=? AND l.user_id=?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return sendError(res, 404, 'Loan not found');

    const loan = rows[0];
    // Generate EMI schedule
    const schedule = [];
    if (loan.status === 'disbursed' && loan.emi_amount) {
      const startDate = new Date(loan.disbursed_at || loan.applied_at);
      for (let i = 1; i <= loan.tenure_months; i++) {
        const emiDate = new Date(startDate);
        emiDate.setMonth(emiDate.getMonth() + i);
        schedule.push({
          installment: i,
          due_date: emiDate.toISOString().split('T')[0],
          amount: loan.emi_amount,
          status: i <= Math.floor(loan.amount_paid / loan.emi_amount) ? 'paid' : 'pending'
        });
      }
    }

    sendSuccess(res, { ...loan, emi_schedule: schedule });
  } catch (err) { next(err); }
};

module.exports = { getLoans, applyLoan, getLoan };
