const express = require('express');
const router = express.Router();
const { getUpiIds, createUpiId, sendUpi, lookupUpi } = require('./upi.controller');
const { authenticate } = require('../../middleware/auth');
const { transferRateLimiter } = require('../../middleware/rateLimiter');

router.use(authenticate);
router.get('/', getUpiIds);
router.post('/', createUpiId);
router.post('/send', transferRateLimiter, sendUpi);
router.get('/lookup/:handle', lookupUpi);

module.exports = router;
