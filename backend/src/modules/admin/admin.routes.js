const express = require('express');
const router  = express.Router();
const {
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
} = require('./admin.controller');
const { authenticate, requireAdmin } = require('../../middleware/auth');

router.use(authenticate, requireAdmin);

// Stats
router.get('/stats', getStats);

// Users
router.get('/users',                         getAllUsers);
router.post('/users/create',                 createUser);
router.get('/users/:id',                     getUser);
router.get('/users/:id/full',                getUserFull);
router.get('/users/:id/transactions',        getUserTransactions);
router.get('/users/:id/transactions/export', exportUserTransactions);
router.get('/users/:id/loans/export',        exportUserLoans);
router.put('/users/:id',                     updateUser);
router.put('/users/:id/status',              toggleUserStatus);
router.post('/users/:id/adjust-balance',     adjustBalance);
router.delete('/users/:id/close-account',   closeUserAccount);

// Beneficiaries
router.post('/users/:id/beneficiaries',   addBeneficiary);
router.delete('/beneficiaries/:id',       deleteBeneficiary);

// KYC
router.put('/kyc/:userId', manageKYC);

// Transactions
router.get('/transactions',             getAllTransactions);
router.post('/transactions/:id/freeze', freezeRefundTransaction);

// Loans (global)
router.get('/loans',              getAllLoans);
router.put('/loans/:id/approve',  approveLoan);
router.post('/loans/:id/process-emi', processEMI);

// Loans (per user)
router.post('/users/:id/loans',   adminGiveLoan);

// Cards & UPI
router.put('/cards/:id/freeze',       toggleCardFreeze);
router.put('/cards/:id/limit',        updateCardLimit);
router.delete('/cards/:id/permanent', permanentDeleteCard);
router.put('/upi/:id/toggle',         toggleUPI);

// Messaging & Password Reset
router.post('/users/:id/message',         sendUserMessage);
router.put('/users/:id/reset-password',   resetUserPassword);

// Database Viewer
router.get('/db/stats',   getDbStats);
router.post('/db/query',  runPresetQuery);

// FAQ CRUD
router.get('/faq',        getFAQs);
router.post('/faq',       createFAQ);
router.put('/faq/:id',    updateFAQ);
router.delete('/faq/:id', deleteFAQ);

module.exports = router;
