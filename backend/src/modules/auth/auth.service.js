const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db');
const { generateAccountNumber } = require('../../utils/helpers');

/**
 * Register new user + create default savings account
 */
const register = async (userData) => {
  const {
    full_name, email, phone, password, avatar_id = 1,
    profile_photo = null, date_of_birth = null, gender = null,
    account_type = 'savings', occupation = null, annual_income = null,
    residential_address = null, corporate_address = null, nationality = 'Indian',
  } = userData;

  // Normalise date_of_birth → strip any ISO timestamp to plain YYYY-MM-DD
  const dob = date_of_birth ? date_of_birth.toString().slice(0, 10) : null;

  // Check existing user
  const [existing] = await db.query('SELECT id FROM users WHERE email = ? OR phone = ?', [email, phone]);
  if (existing.length > 0) {
    throw { status: 409, message: 'Email or phone already registered' };
  }

  const password_hash = await bcrypt.hash(password, 12);
  const userId = uuidv4();
  const accountId = uuidv4();
  const accountNumber = generateAccountNumber();

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    // Insert user with all profile fields
    await conn.query(
      `INSERT INTO users
        (id, full_name, email, phone, password_hash, avatar_id, role, kyc_status,
         profile_photo, date_of_birth, gender, occupation, annual_income,
         residential_address, corporate_address, nationality)
       VALUES (?,?,?,?,?,?,'user','pending', ?,?,?,?,?,?,?,?)`,
      [userId, full_name, email, phone, password_hash, avatar_id,
       profile_photo, dob, gender, occupation, annual_income,
       residential_address, corporate_address, nationality]
    );

    // Create account with chosen type
    await conn.query(
      `INSERT INTO accounts (id, user_id, account_number, account_type, balance) VALUES (?,?,?,?,10000.00)`,
      [accountId, userId, accountNumber, account_type]
    );

    // Create UPI ID from email prefix
    const upiHandle = `${email.split('@')[0]}@moneymitra`;
    await conn.query(
      `INSERT INTO upi_ids (id, user_id, account_id, upi_handle, is_primary) VALUES (?,?,?,?,TRUE)`,
      [uuidv4(), userId, accountId, upiHandle]
    );

    // Welcome transaction
    await conn.query(
      `INSERT INTO transactions (id, to_account_id, amount, type, category, description, reference_number, balance_after) VALUES (?,?,10000.00,'credit','general','Welcome Bonus - Money Mitra',?,10000.00)`,
      [uuidv4(), accountId, `WB${Date.now()}`]
    );

    // Welcome notification
    await conn.query(
      `INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,'transaction')`,
      [uuidv4(), userId, '🎉 Welcome to Money Mitra!', `Hi ${full_name}! Your account is ready. We have credited ₹10,000 as a welcome bonus to your ${account_type} account ${accountNumber}.`]
    );

    await conn.commit();
    conn.release();

    // Notify all admins of new user registration (fire and forget)
    try {
      const [admins] = await db.query("SELECT id FROM users WHERE role='admin'");
      if (admins.length > 0) {
        const notifValues = admins.map(a => [uuidv4(), a.id, '🆕 New User Registered', `${full_name} (${email}) just created an account. Account #${accountNumber}.`, 'info']);
        await db.query('INSERT INTO notifications (id, user_id, title, body, type) VALUES ?', [notifValues]);
      }
    } catch {}

    return { userId, accountId, accountNumber, upiHandle };
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
};


/**
 * Login user and return tokens
 */
const login = async ({ email, password }) => {
  const [rows] = await db.query(
    'SELECT id, full_name, email, phone, password_hash, avatar_id, role, kyc_status, is_active FROM users WHERE email = ?',
    [email]
  );

  if (rows.length === 0) {
    throw { status: 404, message: 'No account found with this email address.' };
  }

  const user = rows[0];

  if (!user.is_active) {
    throw { status: 403, message: 'Account is suspended. Contact support.' };
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw { status: 401, message: 'Incorrect password. Please try again.' };
  }

  // Update last login
  await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    full_name: user.full_name
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRY || '15m' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' });

  // Store refresh token hash
  const tokenHash = await bcrypt.hash(refreshToken, 8);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.query(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?,?,?,?)',
    [uuidv4(), user.id, tokenHash, expiresAt]
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      avatar_id: user.avatar_id,
      role: user.role,
      kyc_status: user.kyc_status
    }
  };
};

/**
 * Refresh access token
 */
const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const [rows] = await db.query(
      'SELECT * FROM refresh_tokens WHERE user_id = ? AND is_revoked = FALSE AND expires_at > NOW()',
      [decoded.id]
    );

    if (rows.length === 0) {
      throw { status: 401, message: 'Invalid or expired refresh token' };
    }

    const payload = { id: decoded.id, email: decoded.email, role: decoded.role, full_name: decoded.full_name };
    const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    return { accessToken: newAccessToken };
  } catch (err) {
    throw { status: 401, message: 'Invalid refresh token' };
  }
};

/**
 * Logout — revoke refresh tokens
 */
const logout = async (userId) => {
  await db.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = ?', [userId]);
};

module.exports = { register, login, refreshAccessToken, logout };
