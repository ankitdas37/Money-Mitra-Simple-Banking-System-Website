const express = require('express');
const router = express.Router();
const { getLoans, applyLoan, getLoan } = require('./loans.controller');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);
router.get('/', getLoans);
router.post('/apply', applyLoan);
router.get('/:id', getLoan);

module.exports = router;
