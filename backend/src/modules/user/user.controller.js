const db = require('../../config/db');
const { sendSuccess, sendError } = require('../../utils/response');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ── GET /api/users/me ──────────────────────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, full_name, email, phone, avatar_id, role, kyc_status, is_active, last_login, created_at,
              date_of_birth, residential_address, corporate_address, gender, nationality, occupation, annual_income,
              pan_number, aadhaar_number, ckyc_number, ckyc_locked, risk_category, kyc_submitted_at,
              pending_phone, pending_email, pending_pan, pending_aadhaar, pending_ckyc, pending_risk,
              pending_change_type, phone_verified, email_verified,
              profile_photo
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (rows.length === 0) return sendError(res, 404, 'User not found');
    sendSuccess(res, rows[0]);
  } catch (err) { next(err); }
};

// ── PUT /api/users/me  (avatar only — immutable fields protected) ──────────────
const updateProfile = async (req, res, next) => {
  try {
    const { avatar_id } = req.body;
    if (avatar_id) {
      await db.query('UPDATE users SET avatar_id=? WHERE id=?', [avatar_id, req.user.id]);
    }
    sendSuccess(res, {}, 'Profile updated');
  } catch (err) { next(err); }
};

// ── PUT /api/users/me/photo  (upload or remove profile photo — base64) ────────
const uploadPhoto = async (req, res, next) => {
  try {
    const { photo } = req.body; // base64 data URL OR null to remove

    // Allow explicit null/empty to REMOVE the photo
    if (photo === null || photo === undefined || photo === '') {
      await db.query('UPDATE users SET profile_photo=NULL WHERE id=?', [req.user.id]);
      return sendSuccess(res, { profile_photo: null }, 'Profile photo removed successfully!');
    }

    // Validate it's a proper data URL image
    if (typeof photo !== 'string' || !photo.startsWith('data:image/')) {
      return sendError(res, 400, 'Invalid image format. Must be a valid image data URL.');
    }

    // Rough size check — base64 of 2MB ≈ 2.7MB string (MEDIUMTEXT limit = 16MB)
    if (photo.length > 3 * 1024 * 1024) {
      return sendError(res, 400, 'Image too large. Maximum size is 2MB after compression.');
    }

    await db.query('UPDATE users SET profile_photo=? WHERE id=?', [photo, req.user.id]);
    sendSuccess(res, { profile_photo: photo }, 'Profile photo updated successfully!');
  } catch (err) { next(err); }
};

// ── PUT /api/users/me/password ────────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const [rows] = await db.query('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
    const isMatch = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!isMatch) return sendError(res, 400, 'Current password is incorrect');
    const newHash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password_hash=? WHERE id=?', [newHash, req.user.id]);
    sendSuccess(res, {}, 'Password changed successfully');
  } catch (err) { next(err); }
};

// ── POST /api/users/me/request-change  (phone or email — sends OTP) ───────────
const requestChange = async (req, res, next) => {
  try {
    const { type, value } = req.body; // type: 'phone' | 'email'
    if (!['phone','email'].includes(type)) return sendError(res, 400, 'Invalid change type');
    if (!value) return sendError(res, 400, 'Value is required');

    // Check uniqueness
    const col = type === 'phone' ? 'phone' : 'email';
    const [exist] = await db.query(`SELECT id FROM users WHERE ${col}=? AND id!=?`, [value, req.user.id]);
    if (exist.length > 0) return sendError(res, 409, `${type === 'phone' ? 'Phone' : 'Email'} already in use`);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const pendingCol = type === 'phone' ? 'pending_phone' : 'pending_email';
    await db.query(
      `UPDATE users SET ${pendingCol}=?, pending_change_type=?, pending_otp=?, pending_otp_expires=? WHERE id=?`,
      [value, type, otp, expires, req.user.id]
    );

    // In real app: send SMS/email OTP. Here we return it for simulation.
    console.log(`[OTP Simulation] ${type.toUpperCase()} OTP for ${req.user.id}: ${otp}`);
    sendSuccess(res, { otp_preview: otp }, `OTP sent to your new ${type}. Valid for 10 minutes.`);
  } catch (err) { next(err); }
};

// ── POST /api/users/me/verify-otp ─────────────────────────────────────────────
const verifyOtp = async (req, res, next) => {
  try {
    const { otp } = req.body;
    const [rows] = await db.query(
      'SELECT pending_change_type, pending_otp, pending_otp_expires, pending_phone, pending_email FROM users WHERE id=?',
      [req.user.id]
    );
    const u = rows[0];
    if (!u.pending_otp) return sendError(res, 400, 'No pending change request found');
    if (new Date(u.pending_otp_expires) < new Date()) return sendError(res, 400, 'OTP has expired. Please request again.');
    if (u.pending_otp !== otp) return sendError(res, 400, 'Invalid OTP');

    const type = u.pending_change_type;
    // Mark OTP verified but change is still PENDING admin approval
    const verifiedCol = type === 'phone' ? 'phone_verified' : 'email_verified';
    await db.query(
      `UPDATE users SET ${verifiedCol}=TRUE, pending_otp=NULL WHERE id=?`,
      [req.user.id]
    );
    sendSuccess(res, { type }, `OTP verified! Your ${type} change is pending admin approval.`);
  } catch (err) { next(err); }
};

// ── POST /api/users/me/kyc  (submit KYC documents — pending admin verify) ──────
const submitKYC = async (req, res, next) => {
  try {
    const { pan_number, aadhaar_number, ckyc_number, risk_category } = req.body;

    // Validate PAN format: AAAAA0000A
    if (pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan_number)) {
      return sendError(res, 400, 'Invalid PAN number format (e.g. ABCDE1234F)');
    }
    // Validate Aadhaar: 12 digits
    if (aadhaar_number && !/^\d{12}$/.test(aadhaar_number)) {
      return sendError(res, 400, 'Aadhaar number must be exactly 12 digits');
    }

    // Check PAN uniqueness
    if (pan_number) {
      const [panExist] = await db.query('SELECT id FROM users WHERE pan_number=? AND id!=?', [pan_number, req.user.id]);
      if (panExist.length > 0) return sendError(res, 409, 'PAN number already registered with another account');
    }

    // Check if CKYC is permanently locked — reject attempt to change it
    const [userRows] = await db.query('SELECT ckyc_locked FROM users WHERE id=?', [req.user.id]);
    const isCkycLocked = userRows[0]?.ckyc_locked;
    if (isCkycLocked && ckyc_number) {
      return sendError(res, 403, 'CKYC number is permanently locked after admin approval and cannot be changed.');
    }

    await db.query(
      `UPDATE users SET pending_pan=?, pending_aadhaar=?, pending_ckyc=?, pending_risk=?,
       pending_change_type='kyc', kyc_submitted_at=NOW() WHERE id=?`,
      [pan_number || null, aadhaar_number || null, isCkycLocked ? null : (ckyc_number || null), risk_category || null, req.user.id]
    );
    sendSuccess(res, {}, 'KYC documents submitted! Pending admin verification.');
  } catch (err) { next(err); }
};

// ── GET /api/admin/users/:id/pending-changes  (admin: see what's pending) ──────
const getPendingChanges = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return sendError(res, 403, 'Admin only');
    const [rows] = await db.query(
      `SELECT id, full_name, email, phone, pending_phone, pending_email,
              pending_pan, pending_aadhaar, pending_ckyc, pending_risk,
              pending_change_type, phone_verified, email_verified, kyc_submitted_at, kyc_status
       FROM users WHERE pending_change_type IS NOT NULL`,
      []
    );
    sendSuccess(res, rows);
  } catch (err) { next(err); }
};

// ── PUT /api/admin/users/:id/approve-change  (admin approves) ────────────────
const approveChange = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return sendError(res, 403, 'Admin only');
    const { userId, changeType } = req.body;

    const [rows] = await db.query(
      `SELECT pending_phone, pending_email, pending_pan, pending_aadhaar, pending_ckyc, pending_risk, pending_change_type
       FROM users WHERE id=?`, [userId]
    );
    if (rows.length === 0) return sendError(res, 404, 'User not found');
    const u = rows[0];

    if (changeType === 'phone' && u.pending_phone) {
      await db.query('UPDATE users SET phone=?, pending_phone=NULL, pending_change_type=NULL, phone_verified=FALSE WHERE id=?', [u.pending_phone, userId]);
    } else if (changeType === 'email' && u.pending_email) {
      await db.query('UPDATE users SET email=?, pending_email=NULL, pending_change_type=NULL, email_verified=FALSE WHERE id=?', [u.pending_email, userId]);
    } else if (changeType === 'kyc') {
      // Lock CKYC permanently once a CKYC number is approved
      const ckycWillBeSet = !!(u.pending_ckyc);
      await db.query(
        `UPDATE users SET
          pan_number     = COALESCE(pending_pan, pan_number),
          aadhaar_number = COALESCE(pending_aadhaar, aadhaar_number),
          ckyc_number    = COALESCE(pending_ckyc, ckyc_number),
          ckyc_locked    = IF(pending_ckyc IS NOT NULL, TRUE, ckyc_locked),
          risk_category  = COALESCE(pending_risk, risk_category),
          kyc_status     = 'verified',
          pending_pan=NULL, pending_aadhaar=NULL, pending_ckyc=NULL, pending_risk=NULL, pending_change_type=NULL
         WHERE id=?`, [userId]
      );
    }

    // Notify user
    await db.query(
      `INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,'system')`,
      [uuidv4(), userId,
       `✅ ${changeType.toUpperCase()} Update Approved`,
       `Your ${changeType} change request has been approved and applied to your account.`]
    );

    sendSuccess(res, {}, `${changeType} change approved successfully`);
  } catch (err) { next(err); }
};

// ── PUT /api/admin/users/:id/reject-change  (admin rejects) ──────────────────
const rejectChange = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return sendError(res, 403, 'Admin only');
    const { userId, changeType, reason } = req.body;

    await db.query(
      `UPDATE users SET pending_phone=NULL, pending_email=NULL, pending_pan=NULL,
       pending_aadhaar=NULL, pending_ckyc=NULL, pending_risk=NULL,
       pending_change_type=NULL, phone_verified=FALSE, email_verified=FALSE WHERE id=?`, [userId]
    );
    await db.query(
      `INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,'system')`,
      [uuidv4(), userId,
        `❌ ${changeType.toUpperCase()} Update Rejected`,
        `Your ${changeType} change request was rejected. Reason: ${reason || 'Please contact support.'}`]
    );
    sendSuccess(res, {}, 'Change rejected');
  } catch (err) { next(err); }
};

module.exports = { getProfile, updateProfile, uploadPhoto, changePassword, requestChange, verifyOtp, submitKYC, getPendingChanges, approveChange, rejectChange, closeAccount };

// ── Helper: push notification to all admins ───────────────────────────────────
async function insertAdminNotification(title, body, type = 'system') {
  try {
    const [admins] = await db.query("SELECT id FROM users WHERE role='admin'");
    const values = admins.map(a => [require('uuid').v4(), a.id, title, body, type]);
    if (values.length > 0) {
      await db.query(`INSERT INTO notifications (id, user_id, title, body, type) VALUES ?`, [values]);
    }
  } catch {}
}
module.exports.insertAdminNotification = insertAdminNotification;

// ── DELETE /api/users/account — user closes own account ──────────────────────
async function closeAccount(req, res, next) {
  try {
    const { password, confirm_text } = req.body;
    if (confirm_text !== 'CLOSE') return sendError(res, 400, 'Type CLOSE to confirm account closure');

    const [rows] = await db.query('SELECT password_hash, full_name, email FROM users WHERE id=?', [req.user.id]);
    if (!rows[0]) return sendError(res, 404, 'User not found');
    const isMatch = await bcrypt.compare(password, rows[0].password_hash);
    if (!isMatch) return sendError(res, 400, 'Incorrect password');

    // Deactivate account
    await db.query("UPDATE users SET is_active=FALSE, account_closed_at=NOW() WHERE id=?", [req.user.id]);

    // Notify admin
    await insertAdminNotification(
      '⛔ Account Closed by User',
      `${rows[0].full_name} (${rows[0].email}) has permanently closed their account.`,
      'warning'
    );

    // Invalidate their token
    await db.query("UPDATE users SET refresh_token=NULL WHERE id=?", [req.user.id]);

    sendSuccess(res, {}, 'Account closed successfully. We are sorry to see you go.');
  } catch (err) { next(err); }
}
