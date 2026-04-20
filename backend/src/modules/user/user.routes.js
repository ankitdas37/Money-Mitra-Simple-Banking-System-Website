const express = require('express');
const router = express.Router();
const ctrl = require('./user.controller');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);
router.get('/me', ctrl.getProfile);
router.put('/me', ctrl.updateProfile);
router.put('/me/photo', ctrl.uploadPhoto);
router.put('/me/password', ctrl.changePassword);
router.post('/me/request-change', ctrl.requestChange);
router.post('/me/verify-otp', ctrl.verifyOtp);
router.post('/me/kyc', ctrl.submitKYC);
router.delete('/me/account', ctrl.closeAccount);

// Admin routes
router.get('/admin/pending-changes', ctrl.getPendingChanges);
router.put('/admin/approve-change', ctrl.approveChange);
router.put('/admin/reject-change', ctrl.rejectChange);

module.exports = router;
