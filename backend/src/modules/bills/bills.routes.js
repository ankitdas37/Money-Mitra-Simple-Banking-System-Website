const express = require('express');
const router = express.Router();
const { getBills, addBill, payBill } = require('./bills.controller');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);
router.get('/', getBills);
router.post('/', addBill);
router.post('/:id/pay', payBill);

module.exports = router;
