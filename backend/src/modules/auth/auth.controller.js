const Joi = require('joi');
const authService = require('./auth.service');
const { sendSuccess, sendError } = require('../../utils/response');

const registerSchema = Joi.object({
  full_name:            Joi.string().min(2).max(100).required(),
  email:                Joi.string().email().required(),
  phone:                Joi.string().pattern(/^[6-9]\d{9}$/).required().messages({
    'string.pattern.base': 'Phone must be a valid 10-digit Indian mobile number'
  }),
  password:             Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
    'string.pattern.base': 'Password must have uppercase, lowercase and a number'
  }),
  avatar_id:            Joi.number().integer().min(1).max(9).default(1),
  // New profile fields
  date_of_birth:        Joi.string().isoDate().allow(null, '').optional(),
  gender:               Joi.string().valid('male','female','transgender','gay','lesbian','prefer_not_to_say').allow(null,'').optional(),
  account_type:         Joi.string().valid('savings','current').default('savings'),
  occupation:           Joi.string().max(150).allow(null,'').optional(),
  annual_income:        Joi.string().max(50).allow(null,'').optional(),
  residential_address:  Joi.string().max(500).allow(null,'').optional(),
  corporate_address:    Joi.string().max(500).allow(null,'').optional(),
  nationality:          Joi.string().max(100).allow(null,'').default('Indian'),
  profile_photo:        Joi.string().allow(null,'').optional(),  // base64
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const register = async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return sendError(res, 400, error.details[0].message);

    const result = await authService.register(value);
    sendSuccess(res, result, 'Registration successful! ₹10,000 welcome bonus credited.', 201);
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return sendError(res, 400, error.details[0].message);

    const result = await authService.login(value);
    sendSuccess(res, result, 'Login successful');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return sendError(res, 400, 'Refresh token required');
    const result = await authService.refreshAccessToken(refreshToken);
    sendSuccess(res, result, 'Token refreshed');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.user.id);
    sendSuccess(res, {}, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout };
