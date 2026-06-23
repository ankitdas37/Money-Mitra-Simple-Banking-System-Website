const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db');
const { generateAccountNumber } = require('../../utils/helpers');

/**
 * Register new user + create default savings account
 */
/**
 * Generate a unique account number (retries on collision)
 */
const generateUniqueAccountNumber = async () => {
  for (let i = 0; i < 5; i++) {
    const num = generateAccountNumber();
    const [rows] = await db.query('SELECT id FROM accounts WHERE account_number = ?', [num]);
    if (rows.length === 0) return num;
  }
  throw { status: 500, message: 'Could not generate unique account number. Please try again.' };
};

/**
 * Generate a unique UPI handle (adds numeric suffix on collision)
 */
const generateUniqueUpiHandle = async (emailPrefix) => {
  const base = `${emailPrefix}@moneymitra`;
  const [existing] = await db.query('SELECT id FROM upi_ids WHERE upi_handle = ?', [base]);
  if (existing.length === 0) return base;

  // Try with numeric suffix until unique
  for (let i = 1; i <= 999; i++) {
    const handle = `${emailPrefix}${i}@moneymitra`;
    const [rows] = await db.query('SELECT id FROM upi_ids WHERE upi_handle = ?', [handle]);
    if (rows.length === 0) return handle;
  }
  throw { status: 500, message: 'Could not generate a unique UPI handle. Please try again.' };
};

const register = async (userData) => {
  const {
    full_name, email, phone, password, avatar_id = 1,
    profile_photo = null, date_of_birth = null, gender = null,
    account_type = 'savings', occupation = null, annual_income = null,
    residential_address = null, corporate_address = null, nationality = 'Indian',
  } = userData;

  // Normalise date_of_birth → strip any ISO timestamp to plain YYYY-MM-DD
  const dob = date_of_birth ? date_of_birth.toString().slice(0, 10) : null;

  // Check existing user (only email must be unique)
  const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    throw { status: 409, message: 'Email already registered' };
  }

  const password_hash = await bcrypt.hash(password, 12);
  const userId = uuidv4();
  const accountId = uuidv4();

  // Generate unique account number and UPI handle BEFORE starting transaction
  const accountNumber = await generateUniqueAccountNumber();
  const upiHandle = await generateUniqueUpiHandle(email.split('@')[0]);

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

    // Create UPI ID (unique handle pre-validated above)
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
    // Convert MySQL duplicate key errors into friendly messages
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('upi_handle')) {
        throw { status: 409, message: 'UPI handle already exists. Please try again.' };
      }
      if (err.message.includes('account_number')) {
        throw { status: 409, message: 'Account number collision. Please try again.' };
      }
      throw { status: 409, message: 'A resource with this information already exists.' };
    }
    throw err;
  }
};


/**
 * Login user and return tokens
 */
const login = async ({ email, password }) => {
  const queryEmail = email === 'admin' ? 'admin@moneymitra.in' : email;
  const [rows] = await db.query(
    'SELECT id, full_name, email, phone, password_hash, avatar_id, role, kyc_status, is_active FROM users WHERE email = ?',
    [queryEmail]
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
 * Check if user exists by email or phone
 */
const checkUser = async ({ email, phone }) => {
  let result = { emailExists: false, emailUser: null, phoneExists: false, phoneUsers: [] };
  
  if (email) {
    const [rows] = await db.query(
      'SELECT u.full_name, a.account_number FROM users u LEFT JOIN accounts a ON u.id = a.user_id WHERE u.email = ? LIMIT 1',
      [email]
    );
    if (rows.length > 0) {
      result.emailExists = true;
      result.emailUser = rows[0];
    }
  }

  if (phone) {
    const [rows] = await db.query(
      'SELECT u.full_name, a.account_number FROM users u LEFT JOIN accounts a ON u.id = a.user_id WHERE u.phone = ?',
      [phone]
    );
    if (rows.length > 0) {
      result.phoneExists = true;
      result.phoneUsers = rows;
    }
  }

  return result;
};

/**
 * Logout — revoke refresh tokens
 */
const logout = async (userId) => {
  await db.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = ?', [userId]);
};

module.exports = { register, login, refreshAccessToken, logout, checkUser };
