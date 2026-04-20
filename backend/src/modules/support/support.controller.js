const db = require('../../config/db');
const { sendSuccess, sendError } = require('../../utils/response');
const { v4: uuidv4 } = require('uuid');

// ── Generate unique ticket number ──────────────────────────────────────────────
const generateTicketNumber = async () => {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const [rows] = await db.query(
    `SELECT COUNT(*) as cnt FROM support_tickets WHERE DATE(created_at) = CURDATE()`
  );
  const seq = String((rows[0].cnt || 0) + 1).padStart(4, '0');
  return `TKT-${ymd}-${seq}`;
};

// ── POST /api/support/tickets — user creates a new ticket ──────────────────────
const createTicket = async (req, res, next) => {
  try {
    const { subject, category, priority, message } = req.body;
    if (!subject || !message) return sendError(res, 400, 'Subject and message are required');

    const ticketId = uuidv4();
    const msgId = uuidv4();
    const ticketNumber = await generateTicketNumber();

    await db.query(
      `INSERT INTO support_tickets (id, user_id, ticket_number, subject, category, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, 'open')`,
      [ticketId, req.user.id, ticketNumber, subject, category || 'other', priority || 'medium']
    );

    await db.query(
      `INSERT INTO support_messages (id, ticket_id, sender_role, sender_name, message)
       VALUES (?, ?, 'user', ?, ?)`,
      [msgId, ticketId, req.user.full_name, message]
    );

    // Notify — create notification for admin users
    const [admins] = await db.query(`SELECT id FROM users WHERE role='admin'`);
    for (const admin of admins) {
      await db.query(
        `INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,'system')`,
        [uuidv4(), admin.id,
         `🎫 New Support Ticket: ${ticketNumber}`,
         `${req.user.full_name} opened a ticket — "${subject}"`]
      );
    }

    sendSuccess(res, { ticket_number: ticketNumber, ticket_id: ticketId }, 'Support ticket created successfully!');
  } catch (err) { next(err); }
};

// ── GET /api/support/tickets — user's own tickets ──────────────────────────────
const getMyTickets = async (req, res, next) => {
  try {
    const [tickets] = await db.query(
      `SELECT t.*,
              (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) AS message_count,
              (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id AND m.sender_role='admin' AND m.is_read=0) AS unread_admin_msgs,
              (SELECT message FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
       FROM support_tickets t
       WHERE t.user_id = ?
       ORDER BY t.updated_at DESC`,
      [req.user.id]
    );
    sendSuccess(res, tickets);
  } catch (err) { next(err); }
};

// ── GET /api/support/tickets/:id — full ticket + conversation ─────────────────
const getTicketDetail = async (req, res, next) => {
  try {
    const [tickets] = await db.query(
      `SELECT * FROM support_tickets WHERE id=? AND user_id=?`,
      [req.params.id, req.user.id]
    );
    if (tickets.length === 0) return sendError(res, 404, 'Ticket not found');

    const [messages] = await db.query(
      `SELECT * FROM support_messages WHERE ticket_id=? ORDER BY created_at ASC`,
      [req.params.id]
    );

    // Mark admin messages as read
    await db.query(
      `UPDATE support_messages SET is_read=1 WHERE ticket_id=? AND sender_role='admin'`,
      [req.params.id]
    );

    sendSuccess(res, { ...tickets[0], messages });
  } catch (err) { next(err); }
};

// ── POST /api/support/tickets/:id/message — user replies ─────────────────────
const addMessage = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return sendError(res, 400, 'Message is required');

    const [tickets] = await db.query(
      `SELECT * FROM support_tickets WHERE id=? AND user_id=?`,
      [req.params.id, req.user.id]
    );
    if (tickets.length === 0) return sendError(res, 404, 'Ticket not found');
    if (tickets[0].status === 'closed') return sendError(res, 400, 'Cannot reply to a closed ticket');

    const msgId = uuidv4();
    await db.query(
      `INSERT INTO support_messages (id, ticket_id, sender_role, sender_name, message)
       VALUES (?, ?, 'user', ?, ?)`,
      [msgId, req.params.id, req.user.full_name, message]
    );

    // Update ticket status to in_progress if it was resolved
    if (tickets[0].status === 'resolved') {
      await db.query(`UPDATE support_tickets SET status='in_progress' WHERE id=?`, [req.params.id]);
    } else {
      await db.query(`UPDATE support_tickets SET updated_at=NOW() WHERE id=?`, [req.params.id]);
    }

    // Notify admins
    const [admins] = await db.query(`SELECT id FROM users WHERE role='admin'`);
    for (const admin of admins) {
      await db.query(
        `INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,'system')`,
        [uuidv4(), admin.id,
         `💬 Reply on ${tickets[0].ticket_number}`,
         `${req.user.full_name} replied to their support ticket.`]
      );
    }

    sendSuccess(res, { message_id: msgId }, 'Reply sent!');
  } catch (err) { next(err); }
};

// ── PUT /api/support/tickets/:id/close — user closes ticket ──────────────────
const closeTicket = async (req, res, next) => {
  try {
    const [r] = await db.query(
      `UPDATE support_tickets SET status='closed' WHERE id=? AND user_id=?`,
      [req.params.id, req.user.id]
    );
    if (r.affectedRows === 0) return sendError(res, 404, 'Ticket not found');
    sendSuccess(res, {}, 'Ticket closed');
  } catch (err) { next(err); }
};

// ── Admin: GET /api/support/admin/tickets — all tickets ──────────────────────
const adminGetAllTickets = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return sendError(res, 403, 'Admin only');
    const { status, category, priority } = req.query;

    let where = '1=1';
    const params = [];
    if (status)   { where += ' AND t.status=?';   params.push(status); }
    if (category) { where += ' AND t.category=?'; params.push(category); }
    if (priority) { where += ' AND t.priority=?'; params.push(priority); }

    const [tickets] = await db.query(
      `SELECT t.*, u.full_name AS user_name, u.email AS user_email,
              (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id=t.id) AS message_count,
              (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id=t.id AND m.sender_role='user' AND m.is_read=0) AS unread_user_msgs,
              (SELECT message FROM support_messages m WHERE m.ticket_id=t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
       FROM support_tickets t
       JOIN users u ON t.user_id = u.id
       WHERE ${where}
       ORDER BY
         CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         t.updated_at DESC`,
      params
    );
    sendSuccess(res, tickets);
  } catch (err) { next(err); }
};

// ── Admin: GET /api/support/admin/tickets/:id — ticket detail ────────────────
const adminGetTicketDetail = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return sendError(res, 403, 'Admin only');
    const [tickets] = await db.query(
      `SELECT t.*, u.full_name AS user_name, u.email AS user_email, u.phone AS user_phone
       FROM support_tickets t JOIN users u ON t.user_id=u.id
       WHERE t.id=?`,
      [req.params.id]
    );
    if (tickets.length === 0) return sendError(res, 404, 'Ticket not found');

    const [messages] = await db.query(
      `SELECT * FROM support_messages WHERE ticket_id=? ORDER BY created_at ASC`,
      [req.params.id]
    );

    // Mark user messages as read by admin
    await db.query(
      `UPDATE support_messages SET is_read=1 WHERE ticket_id=? AND sender_role='user'`,
      [req.params.id]
    );

    sendSuccess(res, { ...tickets[0], messages });
  } catch (err) { next(err); }
};

// ── Admin: POST /api/support/admin/tickets/:id/reply ─────────────────────────
const adminReply = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return sendError(res, 403, 'Admin only');
    const { message } = req.body;
    if (!message) return sendError(res, 400, 'Message is required');

    const [tickets] = await db.query(
      `SELECT * FROM support_tickets WHERE id=?`, [req.params.id]
    );
    if (tickets.length === 0) return sendError(res, 404, 'Ticket not found');

    const msgId = uuidv4();
    await db.query(
      `INSERT INTO support_messages (id, ticket_id, sender_role, sender_name, message)
       VALUES (?, ?, 'admin', ?, ?)`,
      [msgId, req.params.id, req.user.full_name || 'Support Team', message]
    );

    // Auto set to in_progress when admin replies
    if (tickets[0].status === 'open') {
      await db.query(`UPDATE support_tickets SET status='in_progress' WHERE id=?`, [req.params.id]);
    } else {
      await db.query(`UPDATE support_tickets SET updated_at=NOW() WHERE id=?`, [req.params.id]);
    }

    // Notify the user
    await db.query(
      `INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,'system')`,
      [uuidv4(), tickets[0].user_id,
       `💬 Admin replied to ${tickets[0].ticket_number}`,
       `Your support ticket has a new admin reply. Open Help & Support to view.`]
    );

    sendSuccess(res, { message_id: msgId }, 'Reply sent to user!');
  } catch (err) { next(err); }
};

// ── Admin: PUT /api/support/admin/tickets/:id/status ─────────────────────────
const adminUpdateStatus = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return sendError(res, 403, 'Admin only');
    const { status, priority } = req.body;

    const updates = [];
    const params = [];
    if (status)   { updates.push('status=?');   params.push(status); }
    if (priority) { updates.push('priority=?'); params.push(priority); }
    if (updates.length === 0) return sendError(res, 400, 'No fields to update');

    params.push(req.params.id);
    await db.query(`UPDATE support_tickets SET ${updates.join(', ')} WHERE id=?`, params);

    // Notify user of status change
    const [tkt] = await db.query(`SELECT user_id, ticket_number FROM support_tickets WHERE id=?`, [req.params.id]);
    if (tkt.length && status) {
      await db.query(
        `INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,'system')`,
        [uuidv4(), tkt[0].user_id,
         `🎫 Ticket ${tkt[0].ticket_number} Status: ${status.replace('_', ' ').toUpperCase()}`,
         `Your support ticket status has been updated to: ${status}`]
      );
    }

    sendSuccess(res, {}, 'Ticket updated');
  } catch (err) { next(err); }
};

// ── Admin: GET /api/support/admin/stats ──────────────────────────────────────
const adminGetStats = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return sendError(res, 403, 'Admin only');
    const [rows] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(status='open') AS open_count,
        SUM(status='in_progress') AS in_progress_count,
        SUM(status='resolved') AS resolved_count,
        SUM(status='closed') AS closed_count,
        SUM(priority='urgent') AS urgent_count,
        SUM(priority='high') AS high_count
      FROM support_tickets
    `);
    sendSuccess(res, rows[0]);
  } catch (err) { next(err); }
};

module.exports = {
  createTicket, getMyTickets, getTicketDetail, addMessage, closeTicket,
  adminGetAllTickets, adminGetTicketDetail, adminReply, adminUpdateStatus, adminGetStats
};
