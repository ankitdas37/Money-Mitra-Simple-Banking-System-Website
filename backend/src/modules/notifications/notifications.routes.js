const express = require('express');
const router = express.Router();
const { getNotifications, markRead, markAllRead, clearAll } = require('./notifications.controller');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);
router.get('/', getNotifications);
router.put('/read-all', markAllRead);
router.delete('/clear-all', clearAll);
router.put('/:id/read', markRead);

module.exports = router;
