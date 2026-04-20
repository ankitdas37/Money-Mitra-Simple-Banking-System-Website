const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { generateCardNumber, generateCVV, generateExpiry, maskCardNumber } = require('../../utils/helpers');
const { sendSuccess, sendError } = require('../../utils/response');

// GET /api/cards
const getCards = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT c.id, c.card_number_masked, c.card_number_last4, c.card_type, c.card_network,
        c.expiry_month, c.expiry_year, c.name_on_card, c.is_frozen, c.spending_limit,
        c.current_day_spent, c.credit_limit, c.outstanding_balance, c.is_active, c.created_at,
        c.online_enabled, c.international_enabled, c.nfc_enabled, c.is_permanently_blocked,
        a.account_number, a.account_type, a.bank_name
       FROM cards c JOIN accounts a ON c.account_id = a.id
       WHERE c.user_id = ? AND c.is_permanently_blocked = FALSE`,
      [req.user.id]
    );
    sendSuccess(res, rows);
  } catch (err) { next(err); }
};

// POST /api/cards — generate virtual card
const createCard = async (req, res, next) => {
  try {
    const { account_id, card_type = 'debit', card_network = 'rupay' } = req.body;
    if (!account_id) return sendError(res, 400, 'account_id required');

    const [account] = await db.query('SELECT * FROM accounts WHERE id=? AND user_id=?', [account_id, req.user.id]);
    if (account.length === 0) return sendError(res, 404, 'Account not found');

    const cardNumber = generateCardNumber();
    const cvv = generateCVV();
    const expiry = generateExpiry();
    const cvvHash = await bcrypt.hash(cvv, 8);
    const cardId = uuidv4();

    const [user] = await db.query('SELECT full_name FROM users WHERE id=?', [req.user.id]);

    await db.query(
      `INSERT INTO cards (id, account_id, user_id, card_number_masked, card_number_last4, card_number_encrypted, card_type, card_network, cvv_hash, expiry_month, expiry_year, name_on_card, spending_limit, credit_limit)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        cardId, account_id, req.user.id,
        maskCardNumber(cardNumber), cardNumber.slice(-4),
        `enc_${cardNumber}`, // In production: encrypt with AES
        card_type, card_network, cvvHash,
        expiry.month, expiry.year,
        user[0].full_name.toUpperCase(),
        card_type === 'credit' ? 200000 : 100000,
        card_type === 'credit' ? 200000 : null
      ]
    );

    // Show full card details only on creation
    sendSuccess(res, {
      id: cardId,
      card_number: cardNumber.replace(/(\d{4})/g, '$1 ').trim(),
      card_number_masked: maskCardNumber(cardNumber),
      cvv,
      expiry: `${expiry.month}/${expiry.year}`,
      card_type,
      card_network,
      name_on_card: user[0].full_name.toUpperCase(),
      spending_limit: card_type === 'credit' ? 200000 : 100000
    }, '🎴 Virtual card generated successfully', 201);
  } catch (err) { next(err); }
};

// PUT /api/cards/:id/freeze
const toggleFreeze = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM cards WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (rows.length === 0) return sendError(res, 404, 'Card not found');

    const newStatus = !rows[0].is_frozen;
    await db.query('UPDATE cards SET is_frozen=? WHERE id=?', [newStatus, req.params.id]);

    // Notify user
    await db.query(
      `INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,'security')`,
      [uuidv4(), req.user.id,
        newStatus ? '🔒 Card Frozen' : '🔓 Card Unfrozen',
        `Your card ending ${rows[0].card_number_last4} has been ${newStatus ? 'frozen' : 'unfrozen'}.`
      ]
    );

    sendSuccess(res, { is_frozen: newStatus }, `Card ${newStatus ? 'frozen' : 'unfrozen'} successfully`);
  } catch (err) { next(err); }
};

// PUT /api/cards/:id/limit
const updateLimit = async (req, res, next) => {
  try {
    const { spending_limit } = req.body;
    if (!spending_limit || spending_limit < 1000 || spending_limit > 500000) {
      return sendError(res, 400, 'Spending limit must be between ₹1,000 and ₹5,00,000');
    }

    const [rows] = await db.query('SELECT id FROM cards WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (rows.length === 0) return sendError(res, 404, 'Card not found');

    await db.query('UPDATE cards SET spending_limit=? WHERE id=?', [spending_limit, req.params.id]);
    sendSuccess(res, { spending_limit }, 'Spending limit updated');
  } catch (err) { next(err); }
};

// GET /api/cards/:id/reveal — show full card number + CVV (stored encrypted)
const revealCard = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT card_number_encrypted, card_number_last4, expiry_month, expiry_year, card_network, name_on_card FROM cards WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return sendError(res, 404, 'Card not found');
    const card = rows[0];
    // card_number_encrypted stored as enc_XXXXXXXXXXXXXXXX
    const fullNumber = card.card_number_encrypted.replace('enc_', '').replace(/(\d{4})/g, '$1 ').trim();
    sendSuccess(res, {
      card_number: fullNumber,
      expiry: `${card.expiry_month}/${card.expiry_year}`,
      card_network: card.card_network,
      name_on_card: card.name_on_card
    });
  } catch (err) { next(err); }
};

// PUT /api/cards/:id/settings — toggle online/international/nfc
const updateSettings = async (req, res, next) => {
  try {
    const { online_enabled, international_enabled, nfc_enabled } = req.body;
    const [rows] = await db.query('SELECT id FROM cards WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (rows.length === 0) return sendError(res, 404, 'Card not found');

    const updates = [];
    const params = [];
    if (online_enabled !== undefined) { updates.push('online_enabled=?'); params.push(online_enabled); }
    if (international_enabled !== undefined) { updates.push('international_enabled=?'); params.push(international_enabled); }
    if (nfc_enabled !== undefined) { updates.push('nfc_enabled=?'); params.push(nfc_enabled); }
    if (updates.length === 0) return sendError(res, 400, 'No settings provided');
    params.push(req.params.id);
    await db.query(`UPDATE cards SET ${updates.join(',')} WHERE id=?`, params);
    sendSuccess(res, { online_enabled, international_enabled, nfc_enabled }, 'Card settings updated');
  } catch (err) { next(err); }
};

// PUT /api/cards/:id/block — permanently block card
const permanentBlock = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM cards WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (rows.length === 0) return sendError(res, 404, 'Card not found');
    await db.query('UPDATE cards SET is_permanently_blocked=TRUE, is_frozen=TRUE WHERE id=?', [req.params.id]);
    await db.query(
      `INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,'security')`,
      [uuidv4(), req.user.id, '🚫 Card Permanently Blocked',
        `Card ending ${rows[0].card_number_last4} has been permanently blocked and cannot be reactivated.`]
    );
    sendSuccess(res, null, 'Card permanently blocked');
  } catch (err) { next(err); }
};

// DELETE /api/cards/:id — delete card record
const deleteCard = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id, card_number_last4 FROM cards WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (rows.length === 0) return sendError(res, 404, 'Card not found');
    await db.query('DELETE FROM cards WHERE id=?', [req.params.id]);
    sendSuccess(res, null, `Card ending ${rows[0].card_number_last4} deleted`);
  } catch (err) { next(err); }
};

module.exports = { getCards, createCard, toggleFreeze, updateLimit, revealCard, updateSettings, permanentBlock, deleteCard };
