const rateLimit = require('express-rate-limit');

// Helper — skip rate limiting for localhost/LAN in development
const skipLAN = (req) => {
  if (process.env.NODE_ENV !== 'development') return false;
  const ip = req.ip || req.connection.remoteAddress || '';
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('::ffff:192.168.') ||
    ip.startsWith('::ffff:10.')
  );
};

// Global rate limiter — relaxed for LAN dev, strict for prod
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,        // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 2000 : 300,
  skip: skipLAN,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Transfer limiter — fraud prevention
const transferRateLimiter = rateLimit({
  windowMs: 60 * 1000,              // 1 minute
  max: process.env.NODE_ENV === 'development' ? 50 : 5,
  skip: skipLAN,
  message: { success: false, message: 'Too many transfer attempts. Please wait a moment.' },
});

module.exports = { globalRateLimiter, transferRateLimiter };
