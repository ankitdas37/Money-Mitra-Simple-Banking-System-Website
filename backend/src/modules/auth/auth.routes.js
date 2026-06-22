const express = require('express');
const router = express.Router();
const { register, login, refresh, logout } = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/refresh
router.post('/refresh', refresh);

// POST /api/auth/logout (protected)
router.post('/logout', authenticate, logout);

module.exports = router;
