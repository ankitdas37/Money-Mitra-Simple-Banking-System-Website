const cron = require('node-cron');
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const startEmiJob = () => {
  // Run every 1 minute for testing (can be changed to '0 0 * * *' for daily midnight)
  cron.schedule('* * * * *', async () => {
    // console.log('Checking for due EMIs...');
    
    try {
      // Find all disbursed loans where next EMI is due today or past due, and not fully paid
      const [dueLoans] = await db.query(`
        SELECT l.*, a.balance as account_balance
        FROM loans l
        JOIN accounts a ON l.account_id = a.id
        WHERE l.status = 'disbursed'
          AND l.next_emi_date <= CURDATE()
          AND l.amount_paid < l.total_payable
      `);

      if (dueLoans.length === 0) return;
      
      console.log(`[EMI Job] Found ${dueLoans.length} EMIs due.`);

      for (const loan of dueLoans) {
        const conn = await db.getConnection();
        await conn.beginTransaction();
        try {
          const emiAmount = parseFloat(loan.emi_amount);
          const currentBalance = parseFloat(loan.account_balance);

          // Lock account for update
          const [[accountData]] = await conn.query('SELECT balance FROM accounts WHERE id = ? FOR UPDATE', [loan.account_id]);
          if (!accountData) {
            await conn.rollback();
            conn.release();
            continue;
          }

          if (parseFloat(accountData.balance) >= emiAmount) {
            // Deduct from account
            const newBalance = parseFloat(accountData.balance) - emiAmount;
            await conn.query('UPDATE accounts SET balance = ? WHERE id = ?', [newBalance, loan.account_id]);

            // Add transaction
            const refNum = `EMI${Date.now()}${Math.floor(Math.random()*1000)}`;
            await conn.query(`
              INSERT INTO transactions (id, from_account_id, amount, type, category, description, reference_number, balance_after, status)
              VALUES (?, ?, ?, 'loan_emi', 'loan', ?, ?, ?, 'completed')
            `, [uuidv4(), loan.account_id, emiAmount, `EMI Deduction — ${loan.loan_type} loan`, refNum, newBalance]);

            // Update loan
            const newAmountPaid = parseFloat(loan.amount_paid) + emiAmount;
            const newStatus = (newAmountPaid >= parseFloat(loan.total_payable) - 0.01) ? 'closed' : 'disbursed';
            
            await conn.query(`
              UPDATE loans 
              SET amount_paid = ?, next_emi_date = DATE_ADD(next_emi_date, INTERVAL 1 MONTH), status = ?
              WHERE id = ?
            `, [newAmountPaid, newStatus, loan.id]);

            // Notify user
            await conn.query(`
              INSERT INTO notifications (id, user_id, title, body, type)
              VALUES (UUID(), ?, ?, ?, 'loan')
            `, [
              loan.user_id,
              '✅ EMI Deducted Successfully',
              `Your EMI of ₹${emiAmount.toLocaleString('en-IN')} for your ${loan.loan_type} loan has been auto-deducted.`
            ]);

            console.log(`[EMI Job] Successfully processed EMI for loan ${loan.id}`);
          } else {
            // Insufficient funds handling
            // Send a failure notification (limit to 1 per day to avoid spam)
            const [[existingNotif]] = await conn.query(`
              SELECT id FROM notifications 
              WHERE user_id = ? AND title = '❌ EMI Deduction Failed' AND DATE(created_at) = CURDATE()
            `, [loan.user_id]);

            if (!existingNotif) {
              await conn.query(`
                INSERT INTO notifications (id, user_id, title, body, type)
                VALUES (UUID(), ?, ?, ?, 'loan')
              `, [
                loan.user_id,
                '❌ EMI Deduction Failed',
                `We could not deduct the EMI of ₹${emiAmount.toLocaleString('en-IN')} for your ${loan.loan_type} loan due to insufficient balance. Please fund your account to avoid penalties.`
              ]);
              console.log(`[EMI Job] Insufficient balance for loan ${loan.id}, notification sent.`);
            }
          }

          await conn.commit();
        } catch (err) {
          console.error(`[EMI Job] Error processing loan ${loan.id}:`, err);
          await conn.rollback();
        } finally {
          conn.release();
        }
      }
    } catch (err) {
      console.error('[EMI Job] Error fetching due loans:', err);
    }
  });
};

module.exports = { startEmiJob };
