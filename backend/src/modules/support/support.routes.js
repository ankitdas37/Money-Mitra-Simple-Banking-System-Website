const express = require('express');
const router = express.Router();
const ctrl = require('./support.controller');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);

// ── User routes ────────────────────────────────────────────────
router.post('/tickets',                    ctrl.createTicket);
router.get('/tickets',                     ctrl.getMyTickets);
router.get('/tickets/:id',                 ctrl.getTicketDetail);
router.post('/tickets/:id/message',        ctrl.addMessage);
router.put('/tickets/:id/close',           ctrl.closeTicket);

// ── Admin routes ───────────────────────────────────────────────
router.get('/admin/stats',                 ctrl.adminGetStats);
router.get('/admin/tickets',               ctrl.adminGetAllTickets);
router.get('/admin/tickets/:id',           ctrl.adminGetTicketDetail);
router.post('/admin/tickets/:id/reply',    ctrl.adminReply);
router.put('/admin/tickets/:id/status',    ctrl.adminUpdateStatus);

module.exports = router;
