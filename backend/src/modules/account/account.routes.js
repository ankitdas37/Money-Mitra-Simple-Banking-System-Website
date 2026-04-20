const express = require('express');
const router = express.Router();
const { getAccounts, getAccount, createAccount, getBalance, getSummary, getAllDirectory } = require('./account.controller');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);
router.get('/', getAccounts);
router.get('/summary', getSummary);
router.get('/directory', getAllDirectory);   // ← must be before /:id
router.post('/', createAccount);
router.get('/:id', getAccount);
router.get('/:id/balance', getBalance);

module.exports = router;
