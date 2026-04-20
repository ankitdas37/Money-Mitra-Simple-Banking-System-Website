const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');

/**
 * Verify JWT access token
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Access token required');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Access token expired');
    }
    return sendError(res, 401, 'Invalid access token');
  }
};

/**
 * Require admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return sendError(res, 403, 'Admin access required');
  }
  next();
};

/**
 * require user or admin
 */
const requireUser = (req, res, next) => {
  if (!req.user) {
    return sendError(res, 401, 'Authentication required');
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireUser };
