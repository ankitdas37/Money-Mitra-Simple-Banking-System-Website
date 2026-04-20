const db = require('../../config/db');
const { sendSuccess } = require('../../utils/response');

// GET /api/notifications
const getNotifications = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    const [unread] = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id=? AND is_read=FALSE',
      [req.user.id]
    );
    sendSuccess(res, { notifications: rows, unread_count: unread[0].count });
  } catch (err) { next(err); }
};

// PUT /api/notifications/:id/read
const markRead = async (req, res, next) => {
  try {
    await db.query('UPDATE notifications SET is_read=TRUE WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    sendSuccess(res, {}, 'Marked as read');
  } catch (err) { next(err); }
};

// PUT /api/notifications/read-all
const markAllRead = async (req, res, next) => {
  try {
    await db.query('UPDATE notifications SET is_read=TRUE WHERE user_id=?', [req.user.id]);
    sendSuccess(res, {}, 'All notifications marked as read');
  } catch (err) { next(err); }
};

// DELETE /api/notifications/clear-all
const clearAll = async (req, res, next) => {
  try {
    await db.query('DELETE FROM notifications WHERE user_id=?', [req.user.id]);
    sendSuccess(res, {}, 'All notifications cleared');
  } catch (err) { next(err); }
};

module.exports = { getNotifications, markRead, markAllRead, clearAll };
