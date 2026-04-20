import axios from 'axios';

// In production: use the full Render backend URL from env var
// In development: use '/api' which Vite proxies to localhost:5000
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor — attach JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — auto refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const newToken = res.data.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: (token) => api.post('/auth/refresh', { refreshToken: token }),
};

// ── User ──────────────────────────────────────────────────────
export const userAPI = {
  getProfile:     ()     => api.get('/users/me'),
  updateProfile:  (data) => api.put('/users/me', data),
  uploadPhoto:    (data) => api.put('/users/me/photo', data),
  changePassword: (data) => api.put('/users/me/password', data),
  requestChange:  (data) => api.post('/users/me/request-change', data),
  verifyOtp:      (data) => api.post('/users/me/verify-otp', data),
  submitKYC:      (data) => api.post('/users/me/kyc', data),
  closeAccount:   (data) => api.delete('/users/me/account', { data }),
  // Admin
  getPendingChanges: () => api.get('/users/admin/pending-changes'),
  approveChange:  (data) => api.put('/users/admin/approve-change', data),
  rejectChange:   (data) => api.put('/users/admin/reject-change', data),
};

// ── Accounts ──────────────────────────────────────────────────
export const accountAPI = {
  getAll: () => api.get('/accounts'),
  getSummary: () => api.get('/accounts/summary'),
  getDirectory: () => api.get('/accounts/directory'),   // all other users' accounts
  getById: (id) => api.get(`/accounts/${id}`),
  getBalance: (id) => api.get(`/accounts/${id}/balance`),
  create: (data) => api.post('/accounts', data),
};

// ── Transactions ──────────────────────────────────────────────
export const transactionAPI = {
  getAll: (params) => api.get('/transactions', { params }),
  getById: (id) => api.get(`/transactions/${id}`),
  transfer: (data) => api.post('/transactions/transfer', data),
  getAnalytics: () => api.get('/transactions/analytics'),
};

// ── Beneficiaries ─────────────────────────────────────────────
export const beneficiaryAPI = {
  getAll: () => api.get('/beneficiaries'),
  add: (data) => api.post('/beneficiaries', data),
  remove: (id) => api.delete(`/beneficiaries/${id}`),
};

// ── UPI ───────────────────────────────────────────────────────
export const upiAPI = {
  getAll: () => api.get('/upi'),
  create: (data) => api.post('/upi', data),
  send: (data) => api.post('/upi/send', data),
  lookup: (handle) => api.get(`/upi/lookup/${handle}`),
};

// ── Cards ─────────────────────────────────────────────────────
export const cardAPI = {
  getAll: () => api.get('/cards'),
  create: (data) => api.post('/cards', data),
  reveal: (id) => api.get(`/cards/${id}/reveal`),
  toggleFreeze: (id) => api.put(`/cards/${id}/freeze`),
  updateLimit: (id, data) => api.put(`/cards/${id}/limit`, data),
  updateSettings: (id, data) => api.put(`/cards/${id}/settings`, data),
  permanentBlock: (id) => api.put(`/cards/${id}/block`),
  deleteCard: (id) => api.delete(`/cards/${id}`),
};

// ── Bills ─────────────────────────────────────────────────────
export const billAPI = {
  getAll: (params) => api.get('/bills', { params }),
  add: (data) => api.post('/bills', data),
  pay: (id, data) => api.post(`/bills/${id}/pay`, data),
};

// ── Loans ─────────────────────────────────────────────────────
export const loanAPI = {
  getAll: () => api.get('/loans'),
  apply: (data) => api.post('/loans/apply', data),
  getById: (id) => api.get(`/loans/${id}`),
};

// ── Notifications ─────────────────────────────────────────────
export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  clearAll: () => api.delete('/notifications/clear-all'),
};

// ── Support ───────────────────────────────────────────────────
export const supportAPI = {
  // User
  createTicket:    (data) => api.post('/support/tickets', data),
  getMyTickets:    ()     => api.get('/support/tickets'),
  getTicketDetail: (id)   => api.get(`/support/tickets/${id}`),
  addMessage:      (id, data) => api.post(`/support/tickets/${id}/message`, data),
  closeTicket:     (id)   => api.put(`/support/tickets/${id}/close`),
  // Admin
  adminGetStats:         ()     => api.get('/support/admin/stats'),
  adminGetAllTickets:    (params) => api.get('/support/admin/tickets', { params }),
  adminGetTicketDetail:  (id)   => api.get(`/support/admin/tickets/${id}`),
  adminReply:            (id, data) => api.post(`/support/admin/tickets/${id}/reply`, data),
  adminUpdateStatus:     (id, data) => api.put(`/support/admin/tickets/${id}/status`, data),
};

// ── Admin ─────────────────────────────────────────────────────
export const adminAPI = {
  getStats:            ()           => api.get('/admin/stats'),
  getUsers:            (params)     => api.get('/admin/users', { params }),
  getUser:             (id)         => api.get(`/admin/users/${id}`),
  getUserFull:         (id)         => api.get(`/admin/users/${id}/full`),
  getUserTransactions: (id, params) => api.get(`/admin/users/${id}/transactions`, { params }),
  exportTransactions:  (id)         => api.get(`/admin/users/${id}/transactions/export`),
  updateUser:          (id, data)   => api.put(`/admin/users/${id}`, data),
  toggleUser:          (id)         => api.put(`/admin/users/${id}/status`),
  getTransactions:     (params)     => api.get('/admin/transactions', { params }),
  getLoans:            (params)     => api.get('/admin/loans', { params }),
  approveLoan:         (id, data)   => api.put(`/admin/loans/${id}/approve`, data),
  adjustBalance:       (id, data)   => api.post(`/admin/users/${id}/adjust-balance`, data),
  // KYC
  manageKYC:           (uid, data)  => api.put(`/admin/kyc/${uid}`, data),
  // Cards
  freezeCard:          (id)         => api.put(`/admin/cards/${id}/freeze`),
  updateCardLimit:     (id, data)   => api.put(`/admin/cards/${id}/limit`, data),
  permanentDeleteCard: (id)         => api.delete(`/admin/cards/${id}/permanent`),
  // UPI
  toggleUPI:           (id)         => api.put(`/admin/upi/${id}/toggle`),
  // Transactions
  freezeTransaction:   (id, data)   => api.post(`/admin/transactions/${id}/freeze`, data),
  // Beneficiaries
  addBeneficiary:      (uid, data)  => api.post(`/admin/users/${uid}/beneficiaries`, data),
  deleteBeneficiary:   (id)         => api.delete(`/admin/beneficiaries/${id}`),
  // Loans (admin give)
  giveLoan:            (uid, data)  => api.post(`/admin/users/${uid}/loans`, data),
  processEMI:          (loanId)     => api.post(`/admin/loans/${loanId}/process-emi`),
  exportLoans:         (uid)        => api.get(`/admin/users/${uid}/loans/export`),
  // FAQ CRUD
  getFAQs:     ()         => api.get('/admin/faq'),
  createFAQ:   (data)     => api.post('/admin/faq', data),
  updateFAQ:   (id, data) => api.put(`/admin/faq/${id}`, data),
  deleteFAQ:   (id)       => api.delete(`/admin/faq/${id}`),
  // Messaging
  sendMessage:    (uid, data) => api.post(`/admin/users/${uid}/message`, data),
  resetPassword:  (uid, data) => api.put(`/admin/users/${uid}/reset-password`, data),
  // Database Viewer
  getDbStats:  ()         => api.get('/admin/db/stats'),
  runDbQuery:  (data)     => api.post('/admin/db/query', data),
  // User Management
  createUser:         (data)      => api.post('/admin/users/create', data),
  closeUserAccount:   (id, data)  => api.delete(`/admin/users/${id}/close-account`, { data }),
};

export default api;
