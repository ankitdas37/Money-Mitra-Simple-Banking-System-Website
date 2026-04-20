import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI, accountAPI } from '../services/api';
import { useAuthStore } from '../store';
import { AVATARS, formatDate } from '../utils/helpers';
import toast from 'react-hot-toast';

// ── Read-only field ────────────────────────────────────────────────────────────
function ReadField({ label, value, icon }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {icon && <span style={{ marginRight: 5 }}>{icon}</span>}{label}
      </label>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1 }}>{value || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 5 }}>🔒 Read-only</span>
      </div>
    </div>
  );
}

// ── Masked sensitive field ─────────────────────────────────────────────────────
function MaskedField({ label, value, icon }) {
  const [show, setShow] = useState(false);
  const masked = value ? value.slice(0, 2) + '●'.repeat(Math.max(0, value.length - 4)) + value.slice(-2) : null;
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {icon && <span style={{ marginRight: 5 }}>{icon}</span>}{label}
      </label>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontFamily: 'monospace', letterSpacing: 1 }}>{value ? (show ? value : masked) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>}</span>
        {value && <button onClick={() => setShow(s => !s)} style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: 14 }}>{show ? '🙈' : '👁️'}</button>}
        <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 5 }}>🔒 Read-only</span>
      </div>
    </div>
  );
}

// ── Info row for bank ──────────────────────────────────────────────────────────
function BankRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: mono ? 'monospace' : undefined, letterSpacing: mono ? 1 : undefined }}>
        {value || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: 'Outfit, sans-serif' }}>—</span>}
      </span>
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    verified: { color: 'var(--success)', bg: 'rgba(0,229,160,0.1)', label: '✅ Verified' },
    pending:  { color: 'var(--warning)', bg: 'rgba(255,184,76,0.1)', label: '⏳ Pending' },
    rejected: { color: 'var(--error)',   bg: 'rgba(255,75,75,0.1)',  label: '❌ Rejected' },
  };
  const s = map[status] || map.pending;
  return <span style={{ color: s.color, background: s.bg, borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>{s.label}</span>;
}

// ── Tab Button ─────────────────────────────────────────────────────────────────
function TabBtn({ id, icon, label, active, onClick }) {
  return (
    <button onClick={() => onClick(id)} style={{
      flex: 1, padding: '10px 6px', borderRadius: 9, border: 'none', cursor: 'pointer',
      background: active ? 'var(--gradient-primary)' : 'transparent',
      color: active ? 'white' : 'var(--text-secondary)',
      fontWeight: 700, fontSize: 12, fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ── Main Profile Page ──────────────────────────────────────────────────────────
export default function Profile() {
  const { user: authUser, updateUser } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [tab, setTab] = useState('personal');
  const [loading, setLoading] = useState(false);

  // Avatar
  const [avatarId, setAvatarId] = useState(1);

  // OTP flow for phone/email
  const [changeType, setChangeType] = useState(null); // 'phone' | 'email'
  const [changeValue, setChangeValue] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpPreview, setOtpPreview] = useState(null); // simulation only

  // KYC form
  const [kycForm, setKycForm] = useState({ pan_number: '', aadhaar_number: '', ckyc_number: '', risk_category: 'low' });

  // Password
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });

  // Close Account
  const [closeModal, setCloseModal] = useState(false);
  const [closeForm, setCloseForm] = useState({ password: '', confirm_text: '', showPw: false });
  const [closeLoading, setCloseLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([userAPI.getProfile(), accountAPI.getAll()])
      .then(([pRes, aRes]) => {
        setProfile(pRes.data.data);
        setAvatarId(pRes.data.data.avatar_id || 1);
        setAccounts(aRes.data.data || []);
        const p = pRes.data.data;
        setKycForm({
          pan_number: p.pending_pan || p.pan_number || '',
          aadhaar_number: p.pending_aadhaar || p.aadhaar_number || '',
          ckyc_number: p.pending_ckyc || p.ckyc_number || '',
          risk_category: p.pending_risk || p.risk_category || 'low',
        });
      })
      .catch(() => toast.error('Failed to load profile'));
  }, []);

  const [photoPreview, setPhotoPreview] = useState(null); // local preview before upload
  const [photoUploading, setPhotoUploading] = useState(false);

  const handleSaveAvatar = async () => {
    setLoading(true);
    try {
      await userAPI.updateProfile({ avatar_id: avatarId });
      // Clear profile photo when switching back to emoji avatar
      if (profile.profile_photo) {
        await userAPI.uploadPhoto({ photo: '' }); // empty = remove
        setProfile(p => ({ ...p, avatar_id: avatarId, profile_photo: null }));
      } else {
        setProfile(p => ({ ...p, avatar_id: avatarId }));
      }
      updateUser({ avatar_id: avatarId });
      toast.success('Avatar updated!');
    } catch { toast.error('Failed to update avatar'); }
    finally { setLoading(false); }
  };

  // Compress image to stay under 2MB, convert to base64
  const compressAndConvert = (file) => new Promise((resolve, reject) => {
    const MAX_SIZE = 800; // px
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > MAX_SIZE || h > MAX_SIZE) {
          if (w > h) { h = Math.round((h * MAX_SIZE) / w); w = MAX_SIZE; }
          else       { w = Math.round((w * MAX_SIZE) / h); h = MAX_SIZE; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82)); // 82% quality JPEG
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please select an image file');
    if (file.size > 10 * 1024 * 1024) return toast.error('File too large. Max 10MB.');
    try {
      const b64 = await compressAndConvert(file);
      setPhotoPreview(b64);
    } catch { toast.error('Failed to read image'); }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleUploadPhoto = async () => {
    if (!photoPreview) return;
    setPhotoUploading(true);
    try {
      await userAPI.uploadPhoto({ photo: photoPreview });
      setProfile(p => ({ ...p, profile_photo: photoPreview }));
      updateUser({ profile_photo: photoPreview });
      setPhotoPreview(null);
      toast.success('Profile photo saved!');
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
    finally { setPhotoUploading(false); }
  };

  const handleRemovePhoto = async () => {
    setPhotoUploading(true);
    try {
      await userAPI.uploadPhoto({ photo: '' }); // empty string = remove
      setProfile(p => ({ ...p, profile_photo: null }));
      updateUser({ profile_photo: null });
      setPhotoPreview(null);
      toast.success('Profile photo removed');
    } catch { toast.error('Failed to remove photo'); }
    finally { setPhotoUploading(false); }
  };

  const handleRequestChange = async () => {
    if (!changeValue) return toast.error('Enter new value');
    setLoading(true);
    try {
      const res = await userAPI.requestChange({ type: changeType, value: changeValue });
      setOtpSent(true);
      setOtpPreview(res.data.data?.otp_preview);
      toast.success(`OTP sent! (Simulation: ${res.data.data?.otp_preview})`);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (!otpValue) return toast.error('Enter OTP');
    setLoading(true);
    try {
      await userAPI.verifyOtp({ otp: otpValue });
      toast.success('OTP verified! Change is awaiting admin approval.');
      setChangeType(null); setOtpSent(false); setOtpValue(''); setChangeValue('');
      // Refresh profile
      const res = await userAPI.getProfile();
      setProfile(res.data.data);
    } catch (err) { toast.error(err.response?.data?.message || 'Invalid OTP'); }
    finally { setLoading(false); }
  };

  const handleSubmitKYC = async () => {
    setLoading(true);
    try {
      await userAPI.submitKYC(kycForm);
      toast.success('KYC documents submitted! Pending admin verification.');
      const res = await userAPI.getProfile();
      setProfile(res.data.data);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit KYC'); }
    finally { setLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      await userAPI.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      toast.success('Password changed!');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  if (!profile) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;

  const avatarEmoji = AVATARS[(profile.avatar_id || 1) - 1] || '🦊';
  const hasPendingKYC = !!profile.pending_change_type && profile.pending_change_type === 'kyc';
  const hasPendingPhone = !!profile.pending_phone;
  const hasPendingEmail = !!profile.pending_email;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-title">👤 Profile & KYC</h1>
        <p className="page-subtitle">Manage your personal information, bank details and KYC documents</p>
      </div>

      {/* ── Profile Banner ── */}
      <div className="balance-card" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Avatar / Photo */}
        <div style={{ position: 'relative', flexShrink: 0 }} onClick={() => setTab('avatar')} title="Click to change photo">
          <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.35)', cursor: 'pointer', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, transition: 'all 0.2s' }}>
            {(profile.profile_photo || photoPreview) ? (
              <img src={photoPreview || profile.profile_photo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              avatarEmoji
            )}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', cursor: 'pointer' }}>📷</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{profile.full_name}</div>
          <div style={{ opacity: 0.8, fontSize: 13, marginTop: 2 }}>{profile.email} · {profile.phone}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>
              {profile.role === 'admin' ? '👑 Admin' : '👤 User'}
            </span>
            <StatusBadge status={profile.kyc_status} />
            {(hasPendingPhone || hasPendingEmail || hasPendingKYC) && (
              <span style={{ background: 'rgba(255,184,76,0.2)', color: 'var(--warning)', borderRadius: 999, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>
                🕐 Changes Pending Admin Approval
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', opacity: 0.8 }}>
          <div style={{ fontSize: 11 }}>Member since</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{formatDate(profile.created_at)}</div>
          <div style={{ fontSize: 11, marginTop: 6 }}>Last login</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(profile.last_login)}</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 14, padding: 5, marginBottom: 24, border: '1px solid var(--border)', gap: 4 }}>
        {[
          { id: 'personal', icon: '👤', label: 'Personal' },
          { id: 'bank',     icon: '🏦', label: 'Bank Details' },
          { id: 'kyc',      icon: '📋', label: 'KYC Docs' },
          { id: 'avatar',   icon: '🎨', label: 'Avatar' },
          { id: 'security', icon: '🔒', label: 'Security' },
        ].map(t => <TabBtn key={t.id} {...t} active={tab === t.id} onClick={setTab} />)}
      </div>

      {/* ══════════════════════════════════════════════════════════
          TAB: Personal Details
          ══════════════════════════════════════════════════════════ */}
      {tab === 'personal' && (
        <div>
          {/* Read-only section */}
          <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <span style={{ fontSize: 20 }}>🔒</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Identity Details</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>These fields are set at account creation and cannot be changed</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
              <ReadField label="Full Name" value={profile.full_name} icon="👤" />
              <ReadField label="Date of Birth" value={profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : null} icon="🎂" />
              <ReadField label="Gender" value={profile.gender ? profile.gender.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null} icon="🧑" />
              <ReadField label="Nationality" value={profile.nationality} icon="🌍" />
              <ReadField label="Occupation" value={profile.occupation} icon="💼" />
              <ReadField label="Annual Income (Approx.)" value={profile.annual_income} icon="💰" />
            </div>
            <ReadField label="Residential Address" value={profile.residential_address} icon="🏠" />
            <ReadField label="Corporate / Office Address" value={profile.corporate_address} icon="🏢" />
          </div>

          {/* Updatable section — Phone */}
          <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <span style={{ fontSize: 20 }}>📱</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Phone Number</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>OTP verification + admin approval required to update</div>
              </div>
              {hasPendingPhone && (
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--warning)', background: 'rgba(255,184,76,0.1)', padding: '4px 10px', borderRadius: 8 }}>
                  ⏳ Pending: {profile.pending_phone} {profile.phone_verified ? '(OTP ✅)' : '(OTP pending)'}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 5 }}>Current Phone</label>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontFamily: 'monospace', fontSize: 15, fontWeight: 700 }}>
                  {profile.phone}
                </div>
              </div>
              {!changeType && !hasPendingPhone && (
                <button onClick={() => { setChangeType('phone'); setChangeValue(''); setOtpSent(false); }}
                  className="btn-primary" style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                  📱 Change Phone
                </button>
              )}
            </div>

            {changeType === 'phone' && (
              <div style={{ marginTop: 16, padding: 16, background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 12 }}>
                {!otpSent ? (
                  <>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>New Phone Number</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input type="tel" className="input-field" placeholder="9876543210" value={changeValue}
                        onChange={e => setChangeValue(e.target.value)} pattern="[6-9]\d{9}" style={{ flex: 1 }} />
                      <button className="btn-primary" onClick={handleRequestChange} disabled={loading}>
                        {loading ? '⏳' : '📤 Send OTP'}
                      </button>
                      <button className="btn-secondary" onClick={() => setChangeType(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--success)', marginBottom: 12, fontWeight: 600 }}>
                      ✅ OTP sent to {changeValue}
                      {otpPreview && <span style={{ color: 'var(--warning)', marginLeft: 10 }}>(Simulation OTP: {otpPreview})</span>}
                    </div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Enter OTP</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input type="text" className="input-field" placeholder="6-digit OTP" value={otpValue} maxLength={6}
                        onChange={e => setOtpValue(e.target.value)} style={{ flex: 1, fontFamily: 'monospace', letterSpacing: 4, fontSize: 18 }} />
                      <button className="btn-primary" onClick={handleVerifyOtp} disabled={loading}>
                        {loading ? '⏳' : '✅ Verify OTP'}
                      </button>
                      <button className="btn-secondary" onClick={() => { setOtpSent(false); setOtpValue(''); }}>Resend</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Updatable — Email */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <span style={{ fontSize: 20 }}>✉️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Email Address</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>OTP verification + admin approval required to update</div>
              </div>
              {hasPendingEmail && (
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--warning)', background: 'rgba(255,184,76,0.1)', padding: '4px 10px', borderRadius: 8 }}>
                  ⏳ Pending: {profile.pending_email}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 5 }}>Current Email</label>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>
                  {profile.email}
                </div>
              </div>
              {changeType !== 'email' && !hasPendingEmail && (
                <button onClick={() => { setChangeType('email'); setChangeValue(''); setOtpSent(false); setOtpValue(''); }}
                  className="btn-primary" style={{ padding: '12px 20px' }}>
                  ✉️ Change Email
                </button>
              )}
            </div>
            {changeType === 'email' && (
              <div style={{ marginTop: 16, padding: 16, background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 12 }}>
                {!otpSent ? (
                  <>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>New Email Address</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input type="email" className="input-field" placeholder="new@email.com" value={changeValue}
                        onChange={e => setChangeValue(e.target.value)} style={{ flex: 1 }} />
                      <button className="btn-primary" onClick={handleRequestChange} disabled={loading}>
                        {loading ? '⏳' : '📤 Send OTP'}
                      </button>
                      <button className="btn-secondary" onClick={() => setChangeType(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--success)', marginBottom: 12, fontWeight: 600 }}>
                      ✅ OTP sent to {changeValue}
                      {otpPreview && <span style={{ color: 'var(--warning)', marginLeft: 10 }}>(Simulation OTP: {otpPreview})</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input type="text" className="input-field" placeholder="6-digit OTP" value={otpValue} maxLength={6}
                        onChange={e => setOtpValue(e.target.value)} style={{ flex: 1, fontFamily: 'monospace', letterSpacing: 4, fontSize: 18 }} />
                      <button className="btn-primary" onClick={handleVerifyOtp} disabled={loading}>{loading ? '⏳' : '✅ Verify OTP'}</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: Bank Details (Read-only)
          ══════════════════════════════════════════════════════════ */}
      {tab === 'bank' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <span style={{ fontSize: 22 }}>🏦</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Bank Account Details</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Read-only — assigned at account creation</div>
            </div>
          </div>

          {accounts.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">🏦</div><p>No accounts found</p></div>
          ) : accounts.map((acc, i) => (
            <div key={acc.id} style={{ marginBottom: 24 }}>

              {/* ── Premium Card Visual ── */}
              <div style={{
                borderRadius: 22, padding: '28px 30px', marginBottom: 20,
                background: acc.account_type === 'savings'
                  ? 'linear-gradient(135deg, #1a1040 0%, #2d1f6e 40%, #1a3a5c 100%)'
                  : 'linear-gradient(135deg, #0a1f1a 0%, #0d3d29 40%, #1a2a10 100%)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
                position: 'relative', overflow: 'hidden', minHeight: 190,
              }}>
                {/* Decorative circles */}
                <div style={{ position:'absolute', top:-60, right:-60, width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
                <div style={{ position:'absolute', bottom:-40, right:60, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,0.03)', pointerEvents:'none' }} />
                <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(255,255,255,0.015) 40px,rgba(255,255,255,0.015) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,255,255,0.015) 40px,rgba(255,255,255,0.015) 41px)', pointerEvents:'none' }} />

                {/* Top row */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:42,height:42,borderRadius:10,background:'linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.05))',backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22 }}>🏦</div>
                    <div>
                      <div style={{ fontWeight:800, fontSize:15, color:'white', letterSpacing:0.3 }}>{acc.bank_name || 'Money Mitra Bank'}</div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', letterSpacing:2, textTransform:'uppercase' }}>{acc.account_type} Account</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6, flexDirection:'column', alignItems:'flex-end' }}>
                    <div style={{ background: acc.status === 'active' ? 'rgba(0,229,160,0.25)' : 'rgba(255,87,87,0.25)', border:`1px solid ${acc.status === 'active' ? 'rgba(0,229,160,0.5)' : 'rgba(255,87,87,0.5)'}`, borderRadius:20, padding:'3px 10px', fontSize:10, fontWeight:800, color: acc.status === 'active' ? '#00E5A0' : '#FF5757', textTransform:'uppercase', letterSpacing:1 }}>
                      ● {acc.status || 'Active'}
                    </div>
                  </div>
                </div>

                {/* Card chip + number */}
                <div style={{ marginBottom:22 }}>
                  {/* Chip */}
                  <div style={{ width:38,height:28,borderRadius:5,background:'linear-gradient(135deg,#d4a843,#f0cc5e,#b8922e)',boxShadow:'inset 0 0 0 1px rgba(255,255,255,0.2)',marginBottom:14,display:'flex',alignItems:'center',justifyContent:'center' }}>
                    <div style={{ width:26,height:20,borderRadius:3,border:'1px solid rgba(0,0,0,0.2)',background:'linear-gradient(135deg,#c9972a,#e8c04e)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,padding:3 }}>
                      {[0,1,2,3].map(n=><div key={n} style={{ background:'rgba(0,0,0,0.15)',borderRadius:1 }} />)}
                    </div>
                  </div>
                  {/* Formatted account number */}
                  <div style={{ fontFamily:'monospace', fontSize:18, fontWeight:700, color:'white', letterSpacing:3, textShadow:'0 2px 8px rgba(0,0,0,0.5)' }}>
                    {(acc.account_number || '0000000000').replace(/(.{4})/g,'$1 ').trim()}
                  </div>
                </div>

                {/* Bottom row */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                  <div>
                    <div style={{ fontSize:9,color:'rgba(255,255,255,0.45)',textTransform:'uppercase',letterSpacing:1.5,marginBottom:3 }}>IFSC Code</div>
                    <div style={{ fontFamily:'monospace',fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.85)',letterSpacing:1 }}>{acc.ifsc_code || 'MMIT0001001'}</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:9,color:'rgba(255,255,255,0.45)',textTransform:'uppercase',letterSpacing:1.5,marginBottom:3 }}>Balance</div>
                    <div style={{ fontSize:22,fontWeight:900,color:'white',textShadow:'0 2px 12px rgba(0,229,160,0.4)' }}>
                      ₹{parseFloat(acc.balance||0).toLocaleString('en-IN',{minimumFractionDigits:2})}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:9,color:'rgba(255,255,255,0.45)',textTransform:'uppercase',letterSpacing:1.5,marginBottom:3 }}>Branch</div>
                    <div style={{ fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.8)' }}>{acc.branch||'Digital Branch'}</div>
                    <div style={{ fontSize:10,color:'rgba(255,255,255,0.4)' }}>India</div>
                  </div>
                </div>
              </div>

              {/* ── Info Grid below card ── */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                {[
                  { icon:'🔢', label:'Account Number', value: acc.account_number, mono:true },
                  { icon:'🏷️', label:'IFSC Code',       value: acc.ifsc_code || 'MMIT0001001', mono:true },
                  { icon:'🏦', label:'MICR Code',       value: '400002001', mono:true },
                  { icon:'🏢', label:'Account Type',    value: acc.account_type?.toUpperCase() },
                  { icon:'📍', label:'Branch',          value: acc.branch || 'Digital Branch — India' },
                  { icon:'🌐', label:'Bank Name',       value: acc.bank_name || 'Money Mitra Bank Ltd.' },
                  { icon:'📅', label:'Opened On',       value: acc.created_at ? new Date(acc.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—' },
                  { icon:'💰', label:'Min Balance',     value: '₹1,000.00' },
                  { icon:'📈', label:'Interest Rate',   value: acc.account_type === 'savings' ? '3.50% p.a.' : '0.00% p.a.' },
                ].map(({ icon, label, value, mono }) => (
                  <div key={label} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'14px 16px', transition:'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='rgba(108,99,255,0.35)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'}>
                    <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
                      <span>{icon}</span>{label}
                    </div>
                    <div style={{ fontFamily: mono ? 'monospace' : 'Outfit,sans-serif', fontSize:13, fontWeight:700, color:'var(--text-primary)', letterSpacing: mono ? 0.5 : 0 }}>
                      {value || '—'}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding:'11px 16px', background:'rgba(0,229,160,0.04)', border:'1px solid rgba(0,229,160,0.12)', borderRadius:10, fontSize:12, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:16 }}>🔒</span>
                Bank details are permanently assigned at account creation. Contact support for branch transfer requests.
              </div>
            </div>
          ))}
        </div>
      )}


      {/* ══════════════════════════════════════════════════════════
          TAB: KYC Documents
          ══════════════════════════════════════════════════════════ */}
      {tab === 'kyc' && (
        <div>
          {/* KYC Status Banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', marginBottom: 20, borderRadius: 14, background: profile.kyc_status === 'verified' ? 'rgba(0,229,160,0.07)' : 'rgba(255,184,76,0.07)', border: `1px solid ${profile.kyc_status === 'verified' ? 'rgba(0,229,160,0.2)' : 'rgba(255,184,76,0.2)'}` }}>
            <span style={{ fontSize: 36 }}>{profile.kyc_status === 'verified' ? '✅' : '⏳'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>KYC Status: <StatusBadge status={profile.kyc_status} /></div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {profile.kyc_status === 'verified' ? 'Your identity has been verified. KYC documents are locked.' : 'Submit your documents below. Admin verification required for update.'}
              </div>
              {hasPendingKYC && <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>🕐 KYC update submitted on {formatDate(profile.kyc_submitted_at)} — Awaiting admin approval</div>}
            </div>
          </div>

          {/* Verified (read-only) view */}
          {profile.kyc_status === 'verified' && (
            <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>🔒 Verified KYC Documents</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                <MaskedField label="PAN Number" value={profile.pan_number} icon="🪪" />
                <MaskedField label="Aadhaar Number" value={profile.aadhaar_number} icon="🆔" />
                <MaskedField label="CKYC Number" value={profile.ckyc_number} icon="📋" />
                <ReadField label="Risk Category" value={profile.risk_category?.toUpperCase()} icon="⚠️" />
              </div>
            </div>
          )}

          {/* Editable KYC submit form */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              {profile.kyc_status === 'verified' ? '📝 Request KYC Update' : '📝 Submit KYC Documents'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
              {hasPendingKYC
                ? '⏳ Update already submitted. Awaiting admin verification.'
                : 'Fill in your documents and submit. An admin will verify and approve permanently.'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>🪪 PAN Number *</label>
                <input className="input-field" placeholder="ABCDE1234F" maxLength={10} value={kycForm.pan_number}
                  onChange={e => setKycForm(f => ({ ...f, pan_number: e.target.value.toUpperCase() }))}
                  disabled={hasPendingKYC} style={{ fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase' }} />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>Format: AAAAA0000A (Unique per user)</div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>🆔 Aadhaar Number *</label>
                <input className="input-field" placeholder="123456789012" maxLength={12} value={kycForm.aadhaar_number}
                  onChange={e => setKycForm(f => ({ ...f, aadhaar_number: e.target.value.replace(/\D/,'') }))}
                  disabled={hasPendingKYC} style={{ fontFamily: 'monospace', letterSpacing: 2 }} />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>12-digit Aadhaar number</div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>
                  📋 CKYC Number
                  {profile.ckyc_locked && (
                    <span style={{ marginLeft: 8, background: 'rgba(0,229,160,0.12)', color: 'var(--success)', borderRadius: 6, padding: '1px 7px', fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>
                      🔒 PERMANENTLY LOCKED
                    </span>
                  )}
                </label>
                {profile.ckyc_locked ? (
                  /* Locked — read-only with masked display */
                  <div style={{ background: 'rgba(0,229,160,0.04)', border: '1.5px solid rgba(0,229,160,0.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 14, flex: 1, letterSpacing: 1.5 }}>
                      {profile.ckyc_number
                        ? profile.ckyc_number.slice(0, 2) + '●'.repeat(Math.max(0, profile.ckyc_number.length - 4)) + profile.ckyc_number.slice(-2)
                        : <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Not set</span>}
                    </span>
                    <span title="CKYC number is permanently locked after admin KYC approval" style={{ fontSize: 18 }}>🔒</span>
                  </div>
                ) : (
                  <input className="input-field" placeholder="14-digit CKYC number" maxLength={14} value={kycForm.ckyc_number}
                    onChange={e => setKycForm(f => ({ ...f, ckyc_number: e.target.value }))}
                    disabled={hasPendingKYC} style={{ fontFamily: 'monospace', letterSpacing: 1 }} />
                )}
                <div style={{ fontSize: 10, color: profile.ckyc_locked ? 'var(--success)' : 'var(--text-muted)', marginTop: 3 }}>
                  {profile.ckyc_locked
                    ? '✅ CKYC number approved & locked by admin — cannot be changed'
                    : 'Central KYC Registry number (optional)'}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>⚠️ Risk Category</label>
                <select className="input-field" value={kycForm.risk_category}
                  onChange={e => setKycForm(f => ({ ...f, risk_category: e.target.value }))}
                  disabled={hasPendingKYC} style={{ background: 'var(--bg-input)' }}>
                  <option value="low" style={{ background: '#1a1a3e' }}>🟢 Low Risk</option>
                  <option value="medium" style={{ background: '#1a1a3e' }}>🟡 Medium Risk</option>
                  <option value="high" style={{ background: '#1a1a3e' }}>🔴 High Risk</option>
                </select>
              </div>
            </div>

            {!hasPendingKYC && (
              <>
                <div style={{ margin: '16px 0', padding: '10px 14px', background: 'rgba(255,184,76,0.06)', border: '1px solid rgba(255,184,76,0.2)', borderRadius: 10, fontSize: 12, color: 'var(--warning)' }}>
                  ⚠️ Once submitted, KYC changes require admin approval. Your current details remain active until approved.
                </div>
                <button className="btn-primary" onClick={handleSubmitKYC} disabled={loading || !kycForm.pan_number || !kycForm.aadhaar_number}
                  style={{ width: '100%', padding: 14 }}>
                  {loading ? '⏳ Submitting...' : '📤 Submit KYC for Admin Verification'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: Avatar
          ══════════════════════════════════════════════════════════ */}
      {tab === 'avatar' && (
        <div>
          {/* ── Section 1: Upload Real Photo ──────────────────────── */}
          <div className="glass-card" style={{ padding: 28, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 22 }}>📷</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Upload Profile Photo</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pick a photo from your gallery — saved directly to your account</div>
              </div>
            </div>

            {/* Preview area */}
            <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Current / Preview image */}
              <div style={{ flexShrink: 0, textAlign: 'center' }}>
                <div style={{
                  width: 120, height: 120, borderRadius: '50%', overflow: 'hidden',
                  border: photoPreview ? '3px solid var(--primary)' : '3px solid var(--border)',
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 54, margin: '0 auto 10px',
                  boxShadow: photoPreview ? 'var(--shadow-neon)' : 'none',
                  transition: 'all 0.3s',
                  position: 'relative',
                }}>
                  {(photoPreview || profile.profile_photo) ? (
                    <img
                      src={photoPreview || profile.profile_photo}
                      alt="Profile"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    AVATARS[(profile.avatar_id || 1) - 1] || '🦊'
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {photoPreview ? '👆 Preview (unsaved)' : profile.profile_photo ? '📷 Current photo' : '😊 Current avatar'}
                </div>
              </div>

              {/* Upload controls */}
              <div style={{ flex: 1, minWidth: 220 }}>
                {/* Hidden file input */}
                <input
                  id="avatar-gallery-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoSelect}
                />

                {/* Choose from gallery button */}
                <label
                  htmlFor="avatar-gallery-input"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    width: '100%', padding: '14px 20px', borderRadius: 12,
                    background: 'var(--gradient-primary)', color: 'white',
                    fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 12,
                    boxShadow: 'var(--shadow-neon)', transition: 'opacity 0.2s',
                    border: 'none', userSelect: 'none',
                  }}
                  onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseOut={e => e.currentTarget.style.opacity = '1'}
                >
                  <span style={{ fontSize: 20 }}>🖼️</span>
                  Choose from Gallery
                </label>

                {/* Upload / Save button */}
                {photoPreview && (
                  <button
                    className="btn-primary"
                    style={{ width: '100%', marginBottom: 10, background: 'linear-gradient(135deg,#00e5a0,#00b5cc)', boxShadow: '0 0 20px rgba(0,229,160,0.3)' }}
                    onClick={handleUploadPhoto}
                    disabled={photoUploading}
                  >
                    {photoUploading ? '⏳ Saving...' : '✅ Save Photo to Account'}
                  </button>
                )}

                {/* Cancel preview */}
                {photoPreview && (
                  <button
                    className="btn-secondary"
                    style={{ width: '100%', marginBottom: 10 }}
                    onClick={() => setPhotoPreview(null)}
                    disabled={photoUploading}
                  >
                    ✖ Cancel Preview
                  </button>
                )}

                {/* Remove current photo */}
                {profile.profile_photo && !photoPreview && (
                  <button
                    className="btn-secondary"
                    style={{ width: '100%', color: 'var(--error)', borderColor: 'var(--error)', marginBottom: 10 }}
                    onClick={handleRemovePhoto}
                    disabled={photoUploading}
                  >
                    {photoUploading ? '⏳ Removing...' : '🗑️ Remove Current Photo'}
                  </button>
                )}

                {/* Info text */}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 6, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  📁 Supported: JPG, PNG, GIF, WebP<br />
                  📏 Max upload: 10 MB (auto-compressed to ~800px)<br />
                  💾 Stored securely in your account database
                </div>
              </div>
            </div>
          </div>

          {/* ── Divider ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>OR CHOOSE AN EMOJI AVATAR</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* ── Section 2: Emoji Avatar Picker ─────────────────────── */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Choose Your Anime Avatar</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 12, marginBottom: 24 }}>
              {AVATARS.map((avatar, i) => (
                <button key={i} type="button" onClick={() => setAvatarId(i + 1)} style={{
                  width: '100%', aspectRatio: '1', borderRadius: 14,
                  border: avatarId === i + 1 ? '2px solid var(--primary)' : '2px solid var(--border)',
                  background: avatarId === i + 1 ? 'rgba(108,99,255,0.15)' : 'var(--bg-card)',
                  cursor: 'pointer', fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s', boxShadow: avatarId === i + 1 ? 'var(--shadow-neon)' : 'none',
                  transform: avatarId === i + 1 ? 'scale(1.1)' : 'none'
                }}>{avatar}</button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, boxShadow: 'var(--shadow-neon)' }}>
                {AVATARS[avatarId - 1]}
              </div>
            </div>
            <button className="btn-primary" style={{ width: '100%' }} disabled={loading} onClick={handleSaveAvatar}>
              {loading ? 'Saving...' : '✅ Set Emoji Avatar (clears photo)'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: Security
          ══════════════════════════════════════════════════════════ */}
      {tab === 'security' && (
        <div className="glass-card" style={{ padding: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>🔒 Change Password</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Minimum 8 characters: uppercase, lowercase and a number.</p>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw.current ? 'text' : 'password'} className="input-field" value={pwForm.current_password}
                  onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} required style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(s => ({ ...s, current: !s.current }))}
                  style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:17,color:'var(--text-muted)',lineHeight:1 }}>
                  {showPw.current ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw.newPw ? 'text' : 'password'} className="input-field" value={pwForm.new_password}
                  onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} required minLength={8} style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(s => ({ ...s, newPw: !s.newPw }))}
                  style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:17,color:'var(--text-muted)',lineHeight:1 }}>
                  {showPw.newPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw.confirm ? 'text' : 'password'} className="input-field" value={pwForm.confirm_password}
                  onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))} required minLength={8} style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))}
                  style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:17,color:'var(--text-muted)',lineHeight:1 }}>
                  {showPw.confirm ? '🙈' : '👁️'}
                </button>
              </div>
              {pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password && (
                <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 4 }}>❌ Passwords do not match</div>
              )}
              {pwForm.confirm_password && pwForm.new_password === pwForm.confirm_password && (
                <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>✅ Passwords match</div>
              )}
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Changing...' : '🔒 Change Password'}
            </button>
          </form>

          {/* Security Status */}
          <div style={{ marginTop: 24, background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.15)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 12 }}>🛡️ Security Status</div>
            {[
              ['Password Protected', '✅'],
              ['KYC Status', <StatusBadge key="k" status={profile.kyc_status} />],
              ['Account Active', profile.is_active ? '✅ Active' : '❌ Suspended'],
              ['Phone Verified', profile.phone_verified ? '✅' : '⏳'],
              ['Email Verified', profile.email_verified ? '✅' : '⏳'],
              ['Member Since', formatDate(profile.created_at)],
              ['Last Login', formatDate(profile.last_login)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Danger Zone */}
          <div style={{ marginTop: 24, background: 'rgba(255,87,87,0.05)', border: '1px solid rgba(255,87,87,0.2)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 700, color: '#FF5757', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>⛔ Danger Zone</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>Closing your account is <strong>permanent and irreversible</strong>. All your data, transactions, and balances will be frozen. You will be logged out immediately.</p>
            <button onClick={() => { setCloseModal(true); setCloseForm({ password: '', confirm_text: '', showPw: false }); }}
              style={{ background: 'rgba(255,87,87,0.12)', border: '1px solid rgba(255,87,87,0.4)', borderRadius: 10, padding: '10px 20px', color: '#FF5757', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
              ⛔ Close My Account Permanently
            </button>
          </div>
        </div>
      )}

      {/* ═══ Close Account Modal ═══ */}
      {closeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: 20 }}
          onClick={e => e.target === e.currentTarget && !closeLoading && setCloseModal(false)}>
          <div style={{ background: 'linear-gradient(145deg,#0e0e22,#1a0a0a)', border: '1px solid rgba(255,87,87,0.4)', borderRadius: 20, width: '100%', maxWidth: 460, padding: 30, boxShadow: '0 40px 120px rgba(255,87,87,0.15)' }}>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>⛔</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#FF5757' }}>Close Account</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>This action cannot be undone</div>
            </div>

            <div style={{ background: 'rgba(255,87,87,0.08)', border: '1px solid rgba(255,87,87,0.2)', borderRadius: 12, padding: '12px 14px', marginBottom: 20, fontSize: 12, color: '#FF5757', lineHeight: 1.7 }}>
              ⚠️ <strong>Warning:</strong> Closing your account will permanently deactivate it. Your balance will be frozen and you will <strong>not</strong> be able to log in again.
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Confirm by typing CLOSE</label>
              <input value={closeForm.confirm_text} onChange={e => setCloseForm(f => ({ ...f, confirm_text: e.target.value }))}
                placeholder='Type CLOSE to confirm'
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `2px solid ${closeForm.confirm_text === 'CLOSE' ? '#FF5757' : 'var(--border)'}`, borderRadius: 10, padding: '10px 14px', color: 'white', fontSize: 14, fontFamily: 'Outfit,sans-serif', fontWeight: 700, letterSpacing: 2, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input type={closeForm.showPw ? 'text' : 'password'} value={closeForm.password}
                  onChange={e => setCloseForm(f => ({ ...f, password: e.target.value }))}
                  placeholder='Enter your current password'
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 44px 10px 14px', color: 'white', fontSize: 14, fontFamily: 'Outfit,sans-serif', outline: 'none', boxSizing: 'border-box' }} />
                <button type='button' onClick={() => setCloseForm(f => ({ ...f, showPw: !f.showPw }))}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, color: 'var(--text-muted)', lineHeight: 1 }}>
                  {closeForm.showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCloseModal(false)} disabled={closeLoading}
                style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (closeForm.confirm_text !== 'CLOSE') { toast.error('Type CLOSE to confirm'); return; }
                  if (!closeForm.password) { toast.error('Enter your password'); return; }
                  setCloseLoading(true);
                  try {
                    await userAPI.closeAccount({ password: closeForm.password, confirm_text: 'CLOSE' });
                    toast.success('Account closed. Goodbye!');
                    setTimeout(() => { logout(); navigate('/login'); }, 1500);
                  } catch (err) { toast.error(err.response?.data?.message || 'Failed to close account'); }
                  finally { setCloseLoading(false); }
                }}
                disabled={closeLoading || closeForm.confirm_text !== 'CLOSE' || !closeForm.password}
                style={{ flex: 1, background: 'linear-gradient(135deg,#FF5757,#c0392b)', border: 'none', borderRadius: 10, padding: '12px 0', color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', opacity: closeLoading || closeForm.confirm_text !== 'CLOSE' ? 0.6 : 1 }}>
                {closeLoading ? '⏳ Closing...' : '⛔ Close Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
