const express = require('express');
const router = express.Router();
const { getBeneficiaries, addBeneficiary, deleteBeneficiary } = require('./beneficiary.controller');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);
router.get('/', getBeneficiaries);
router.post('/', addBeneficiary);
router.delete('/:id', deleteBeneficiary);

module.exports = router;
