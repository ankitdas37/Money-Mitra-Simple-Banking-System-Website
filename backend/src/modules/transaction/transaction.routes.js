const express = require('express');
const router = express.Router();
const { getTransactions, transfer, getTransaction, getAnalytics } = require('./transaction.controller');
const { authenticate } = require('../../middleware/auth');
const { transferRateLimiter } = require('../../middleware/rateLimiter');

router.use(authenticate);
router.get('/', getTransactions);
router.get('/analytics', getAnalytics);
router.get('/:id', getTransaction);
router.post('/transfer', transferRateLimiter, transfer);

module.exports = router;
