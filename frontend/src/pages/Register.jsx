import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';
import { AVATARS } from '../utils/helpers';

// ── 192 countries list ────────────────────────────────────────────────────────
const COUNTRIES = [
  'Afghan','Albanian','Algerian','Andorran','Angolan','Argentine','Armenian','Australian',
  'Austrian','Azerbaijani','Bahamian','Bahraini','Bangladeshi','Barbadian','Belarusian',
  'Belgian','Belizean','Beninese','Bhutanese','Bolivian','Bosnian','Botswanan','Brazilian',
  'Bruneian','Bulgarian','Burkinabe','Burmese','Burundian','Cambodian','Cameroonian',
  'Canadian','Cape Verdean','Central African','Chadian','Chilean','Chinese','Colombian',
  'Comorian','Congolese','Costa Rican','Croatian','Cuban','Cypriot','Czech','Danish',
  'Djiboutian','Dominican','Dutch','East Timorese','Ecuadorian','Egyptian','Emirati',
  'Equatorial Guinean','Eritrean','Estonian','Eswatini','Ethiopian','Fijian','Finnish',
  'French','Gabonese','Gambian','Georgian','German','Ghanaian','Greek','Grenadian',
  'Guatemalan','Guinean','Guinea-Bissauan','Guyanese','Haitian','Honduran','Hungarian',
  'Icelandic','Indian','Indonesian','Iranian','Iraqi','Irish','Israeli','Italian',
  'Ivorian','Jamaican','Japanese','Jordanian','Kazakhstani','Kenyan','Kuwaiti','Kyrgyz',
  'Laotian','Latvian','Lebanese','Lesothan','Liberian','Libyan','Liechtensteiner',
  'Lithuanian','Luxembourgish','Malagasy','Malawian','Malaysian','Maldivian','Malian',
  'Maltese','Marshallese','Mauritanian','Mauritian','Mexican','Micronesian','Moldovan',
  'Monegasque','Mongolian','Montenegrin','Moroccan','Mozambican','Namibian','Nepali',
  'New Zealander','Nicaraguan','Nigerian','Nigerien','North Korean','North Macedonian',
  'Norwegian','Omani','Pakistani','Palauan','Panamanian','Papua New Guinean','Paraguayan',
  'Peruvian','Filipino','Polish','Portuguese','Qatari','Romanian','Russian','Rwandan',
  'Saint Lucian','Salvadoran','Samoan','San Marinese','Saudi','Senegalese','Serbian',
  'Seychellois','Sierra Leonean','Singaporean','Slovak','Slovenian','Solomon Islander',
  'Somali','South African','South Korean','South Sudanese','Spanish','Sri Lankan',
  'Sudanese','Surinamese','Swedish','Swiss','Syrian','Taiwanese','Tajik','Tanzanian',
  'Thai','Togolese','Tongan','Trinidadian','Tunisian','Turkish','Turkmen','Tuvaluan',
  'Ugandan','Ukrainian','Uruguayan','Uzbekistani','Vanuatuan','Venezuelan','Vietnamese',
  'Yemeni','Zambian','Zimbabwean',
];

const OCCUPATIONS = [
  'Salaried Employee', 'Business Owner', 'Self-Employed / Freelancer',
  'Government Employee', 'Doctor / Medical Professional', 'Engineer',
  'Lawyer / Legal Professional', 'Teacher / Educator', 'Accountant / CA',
  'Architect', 'Banker / Finance Professional', 'IT Professional',
  'Farmer / Agriculture', 'Student', 'Homemaker', 'Retired', 'Other',
];

const ANNUAL_INCOMES = [
  'Below ₹1 Lakh', '₹1–3 Lakh', '₹3–5 Lakh', '₹5–10 Lakh',
  '₹10–25 Lakh', '₹25–50 Lakh', '₹50 Lakh–₹1 Crore', 'Above ₹1 Crore',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const calcAge = (dob) => {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
};

const STEPS = ['Identity', 'Account', 'Address & Contact', 'Security'];

// ── Styles ────────────────────────────────────────────────────────────────────
const inputS = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: '11px 14px', color: 'var(--text-primary)',
  fontFamily: 'Outfit, sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};
const labelS = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
};

export default function Register() {
  const navigate = useNavigate();
  const fileRef = useRef();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [usePhoto, setUsePhoto] = useState(false); // false=avatar, true=photo
  const [sameAddress, setSameAddress] = useState(false);
  const [otherOccupation, setOtherOccupation] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [form, setForm] = useState({
    // Step 0 — Identity
    full_name: '', date_of_birth: '', gender: '',
    avatar_id: 1, profile_photo: null,
    // Step 1 — Account
    account_type: 'savings', occupation: '', annual_income: '',
    // Step 2 — Address & Contact
    residential_address: '', corporate_address: '',
    phone: '', email: '', nationality: 'Indian',
    // Step 3 — Security
    password: '', confirm_password: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const age = calcAge(form.date_of_birth);

  // Photo upload handler
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be under 3 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result);
      set('profile_photo', reader.result);
      setUsePhoto(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!termsAccepted) { toast.error('Please accept the Terms & Conditions'); return; }
    if (form.password !== form.confirm_password) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (age !== null && age < 18) { toast.error('You must be at least 18 years old'); return; }

    setLoading(true);
    try {
      const payload = {
        ...form,
        profile_photo: usePhoto ? form.profile_photo : null,
        occupation: form.occupation === 'Other' ? otherOccupation : form.occupation,
      };
      delete payload.confirm_password;

      await authAPI.register(payload);
      toast.success('🎉 Account created! ₹10,000 welcome bonus added!');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    // Basic validation per step
    if (step === 0) {
      if (!form.full_name.trim()) { toast.error('Full name is required'); return; }
      if (!form.date_of_birth) { toast.error('Date of birth is required'); return; }
      if (age !== null && age < 18) { toast.error('You must be at least 18 years old to open an account'); return; }
      if (!form.gender) { toast.error('Please select your gender'); return; }
    }
    if (step === 1) {
      if (!form.occupation) { toast.error('Please select occupation'); return; }
      if (!form.annual_income) { toast.error('Please select annual income'); return; }
    }
    if (step === 2) {
      if (!form.residential_address.trim()) { toast.error('Residential address is required'); return; }
      if (!/^[6-9]\d{9}$/.test(form.phone)) { toast.error('Enter valid 10-digit mobile number'); return; }
      if (!form.email.includes('@')) { toast.error('Enter valid email address'); return; }
    }
    setStep(s => s + 1);
  };

  // ── Auto-advance: when step is complete, move forward after short delay ──────
  useEffect(() => {
    if (step >= 3) return; // never auto-advance password step
    let timer;

    const isStep0Done = form.full_name.trim().length >= 2 &&
      form.date_of_birth && (age === null || age >= 18) && form.gender;

    const isStep1Done = form.occupation && form.annual_income;

    const isStep2Done = form.residential_address.trim().length >= 5 &&
      /^[6-9]\d{9}$/.test(form.phone) && form.email.includes('@') && form.email.includes('.');

    const shouldAdvance =
      (step === 0 && isStep0Done) ||
      (step === 1 && isStep1Done) ||
      (step === 2 && isStep2Done);

    if (shouldAdvance) {
      timer = setTimeout(() => {
        setStep(s => s + 1);
      }, 700);
    }
    return () => clearTimeout(timer);
  }, [form.full_name, form.date_of_birth, form.gender, form.occupation,
      form.annual_income, form.residential_address, form.phone, form.email, step]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Outfit, sans-serif', background: 'var(--bg-base)', overflow: 'hidden' }}>

      {/* ── Left: Anime Panel ──────────────────────────────────────────── */}
      <div style={{ flex: '0 0 40%', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <img src="/anime-register-bg.png" alt="Create Account" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,8,30,0.1) 0%, rgba(10,8,30,0.3) 55%, rgba(10,8,30,0.92) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 60%, var(--bg-base) 100%)' }} />

        {/* Floating badges */}
        {[
          { top: '11%', left: '8%',  text: '🔒 256-bit Encryption', delay: '0s' },
          { top: '22%', left: '5%',  text: '⚡ Instant UPI Setup',  delay: '0.5s' },
          { top: '33%', left: '10%', text: '🏦 Zero Balance Account', delay: '1s' },
        ].map(b => (
          <div key={b.text} style={{ position: 'absolute', top: b.top, left: b.left, background: 'rgba(108,99,255,0.18)', backdropFilter: 'blur(12px)', border: '1px solid rgba(108,99,255,0.4)', borderRadius: 999, padding: '6px 14px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', boxShadow: '0 0 16px rgba(108,99,255,0.25)', animation: 'floatBadge 3s ease-in-out infinite', animationDelay: b.delay }}>{b.text}</div>
        ))}

        <div style={{ position: 'relative', zIndex: 2, padding: '0 28px 36px' }}>
          <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.2, marginBottom: 10 }}>
            Join the <span style={{ color: '#FFB84C' }}>Future</span> of Finance
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>Complete your profile to unlock all banking features.</div>

          {/* Step indicator on left */}
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: i <= step ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, boxShadow: i === step ? '0 0 10px rgba(108,99,255,0.7)' : 'none', transition: 'all 0.3s' }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: 12, fontWeight: i === step ? 700 : 500, color: i === step ? 'white' : 'rgba(255,255,255,0.45)', transition: 'color 0.3s' }}>{s}</div>
              </div>
            ))}
          </div>
        </div>
        <style>{`@keyframes floatBadge { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
      </div>

      {/* ── Right: Form Panel ──────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '36px 44px' }}>
        <div style={{ width: '100%', maxWidth: 500 }}>

          {/* Back to Home */}
          <a href="http://localhost:5173/home.html"
            style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'rgba(255,255,255,0.45)', textDecoration:'none', marginBottom:20, transition:'color 0.2s', fontWeight:500 }}
            onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,0.85)'}
            onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.45)'}>
            ← Back to Home
          </a>

          {/* Logo + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <img src="/logo.png" alt="Money Mitra" style={{ width: 40, height: 40, borderRadius: 11, objectFit: 'cover', boxShadow: 'var(--shadow-neon)', border: '2px solid rgba(108,99,255,0.4)' }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}><span className="text-gradient">Money Mitra</span></div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Step {step + 1} of {STEPS.length} — {STEPS[step]}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 4, marginBottom: 28, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${((step + 1) / STEPS.length) * 100}%`, background: 'var(--gradient-primary)', borderRadius: 4, transition: 'width 0.4s ease' }} />
          </div>

          {/* ═══════════════════ STEP 0: Identity ══════════════════════ */}
          {step === 0 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, margin: '0 0 20px' }}>👤 Identity & Photo</h2>

              {/* Photo / Avatar Selector */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18, marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <button type="button" onClick={() => setUsePhoto(false)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${!usePhoto ? 'var(--primary)' : 'transparent'}`, background: !usePhoto ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.04)', color: !usePhoto ? 'white' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>🎭 Choose Avatar</button>
                  <button type="button" onClick={() => fileRef.current.click()} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${usePhoto ? 'var(--primary)' : 'transparent'}`, background: usePhoto ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.04)', color: usePhoto ? 'white' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>📷 Upload Photo</button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />

                {usePhoto ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--primary)', background: 'var(--bg-card)', flexShrink: 0 }}>
                      {photoPreview ? <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>👤</div>}
                    </div>
                    <div>
                      <button type="button" onClick={() => fileRef.current.click()} style={{ background: 'var(--gradient-primary)', border: 'none', borderRadius: 8, padding: '8px 16px', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', marginBottom: 6, display: 'block' }}>🖼️ Change Photo</button>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Max 3 MB · JPG, PNG, WebP</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9,1fr)', gap: 7 }}>
                    {AVATARS.map((av, i) => (
                      <button key={i} type="button" onClick={() => set('avatar_id', i + 1)} style={{ width: '100%', aspectRatio: '1', borderRadius: 10, border: form.avatar_id === i + 1 ? '2px solid var(--primary)' : '2px solid rgba(255,255,255,0.06)', background: form.avatar_id === i + 1 ? 'rgba(108,99,255,0.2)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: form.avatar_id === i + 1 ? 'scale(1.12)' : 'scale(1)', transition: 'all 0.18s', boxShadow: form.avatar_id === i + 1 ? '0 0 12px rgba(108,99,255,0.4)' : 'none' }}>{av}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Full Name */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelS}>Full Name *</label>
                <input style={inputS} placeholder="Rahul Sharma" value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
              </div>

              {/* DOB + Age */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 14, alignItems: 'end' }}>
                <div>
                  <label style={labelS}>Date of Birth *</label>
                  <input type="date" style={inputS} max={new Date().toISOString().split('T')[0]} value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} required />
                </div>
                {age !== null && (
                  <div style={{ background: age >= 18 ? 'rgba(0,229,160,0.1)' : 'rgba(255,87,87,0.1)', border: `1px solid ${age >= 18 ? 'rgba(0,229,160,0.3)' : 'rgba(255,87,87,0.3)'}`, borderRadius: 10, padding: '10px 16px', textAlign: 'center', marginBottom: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: age >= 18 ? '#00E5A0' : '#FF5757' }}>{age}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Years Old</div>
                  </div>
                )}
              </div>
              {age !== null && age < 18 && <div style={{ fontSize: 11, color: '#FF5757', marginBottom: 10, marginTop: -8 }}>⚠️ Must be 18+ to open an account</div>}

              {/* Gender */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelS}>Gender *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {[['male','♂ Male'],['female','♀ Female'],['transgender','⚧ Transgender'],['gay','🏳️‍🌈 Gay'],['lesbian','💜 Lesbian'],['prefer_not_to_say','🤐 Prefer Not to Say']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => set('gender', v)} style={{ padding: '9px 6px', borderRadius: 9, border: `2px solid ${form.gender === v ? 'var(--primary)' : 'rgba(255,255,255,0.08)'}`, background: form.gender === v ? 'rgba(108,99,255,0.18)' : 'rgba(255,255,255,0.03)', color: form.gender === v ? 'white' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', transition: 'all 0.18s', textAlign: 'center', lineHeight: 1.3 }}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════ STEP 1: Account Setup ════════════════════*/}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 20px' }}>🏦 Account Setup</h2>

              {/* Account Type */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelS}>Account Type *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[['savings','🏧 Savings Account','For personal savings & daily transactions'],['current','💼 Current Account','For business & high-volume transactions']].map(([v, title, sub]) => (
                    <button key={v} type="button" onClick={() => set('account_type', v)} style={{ padding: '16px 14px', borderRadius: 12, border: `2px solid ${form.account_type === v ? 'var(--primary)' : 'rgba(255,255,255,0.08)'}`, background: form.account_type === v ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', fontFamily: 'Outfit,sans-serif', textAlign: 'left', transition: 'all 0.2s', boxShadow: form.account_type === v ? '0 0 14px rgba(108,99,255,0.3)' : 'none' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: form.account_type === v ? 'white' : 'var(--text-secondary)', marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Occupation */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelS}>Occupation *</label>
                <select style={{ ...inputS, cursor: 'pointer' }} value={form.occupation} onChange={e => set('occupation', e.target.value)} required>
                  <option value="" style={{ background: '#13132a' }}>— Select Occupation —</option>
                  {OCCUPATIONS.map(o => <option key={o} value={o} style={{ background: '#13132a' }}>{o}</option>)}
                </select>
              </div>
              {form.occupation === 'Other' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={labelS}>Specify Occupation</label>
                  <input style={inputS} placeholder="e.g. Musician, Artist, Photographer..." value={otherOccupation} onChange={e => setOtherOccupation(e.target.value)} />
                </div>
              )}

              {/* Annual Income */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelS}>Annual Income *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {ANNUAL_INCOMES.map(inc => (
                    <button key={inc} type="button" onClick={() => set('annual_income', inc)} style={{ padding: '9px 10px', borderRadius: 9, border: `2px solid ${form.annual_income === inc ? 'var(--primary)' : 'rgba(255,255,255,0.08)'}`, background: form.annual_income === inc ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.03)', color: form.annual_income === inc ? 'white' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', transition: 'all 0.18s', textAlign: 'left' }}>{inc}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════ STEP 2: Address & Contact ════════════════*/}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 20px' }}>📍 Address & Contact</h2>

              {/* Residential Address */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelS}>Residential Address *</label>
                <textarea style={{ ...inputS, minHeight: 80, resize: 'vertical', lineHeight: 1.6 }} placeholder="Flat / House No, Street, City, State, PIN" value={form.residential_address} onChange={e => { set('residential_address', e.target.value); if (sameAddress) set('corporate_address', e.target.value); }} required />
              </div>

              {/* Corporate Address */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ ...labelS, marginBottom: 0 }}>Corporate / Office Address</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <input type="checkbox" checked={sameAddress} onChange={e => { setSameAddress(e.target.checked); if (e.target.checked) set('corporate_address', form.residential_address); }} style={{ accentColor: 'var(--primary)', width: 14, height: 14 }} />
                    Same as Residential
                  </label>
                </div>
                <textarea style={{ ...inputS, minHeight: 70, resize: 'vertical', lineHeight: 1.6, opacity: sameAddress ? 0.5 : 1 }} placeholder="Office / Business address" value={form.corporate_address} onChange={e => set('corporate_address', e.target.value)} disabled={sameAddress} />
              </div>

              {/* Phone */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelS}>Phone Number (10 digits) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>+91</span>
                  <input style={{ ...inputS, paddingLeft: 44 }} type="tel" placeholder="9876543210" maxLength={10} value={form.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} required />
                </div>
                {form.phone && !/^[6-9]\d{9}$/.test(form.phone) && <div style={{ fontSize: 11, color: '#FF5757', marginTop: 4 }}>⚠️ Enter valid 10-digit mobile number starting with 6-9</div>}
              </div>

              {/* Email */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelS}>Email Address *</label>
                <input style={inputS} type="email" placeholder="rahul@example.com" value={form.email} onChange={e => set('email', e.target.value)} required />
              </div>

              {/* Nationality */}
              <div style={{ marginBottom: 6 }}>
                <label style={labelS}>Nationality *</label>
                <select style={{ ...inputS, cursor: 'pointer' }} value={form.nationality} onChange={e => set('nationality', e.target.value)} required>
                  {COUNTRIES.map(c => <option key={c} value={c} style={{ background: '#13132a' }}>{c}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* ═══════════════════ STEP 3: Security ════════════════════════*/}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 20px' }}>🔐 Set Password</h2>

              <div style={{ marginBottom: 14 }}>
                <label style={labelS}>Password *</label>
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inputS, paddingRight: 44 }} type={showPw ? 'text' : 'password'} placeholder="Min 8 chars · Uppercase, Number" value={form.password} onChange={e => set('password', e.target.value)} required minLength={8} />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, color: 'var(--text-muted)', lineHeight: 1 }}>{showPw ? '🙈' : '👁️'}</button>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5 }}>Must include uppercase, lowercase and at least one number</div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={labelS}>Confirm Password *</label>
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inputS, paddingRight: 44 }} type={showConfirmPw ? 'text' : 'password'} placeholder="Re-enter your password" value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} required />
                  <button type="button" onClick={() => setShowConfirmPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, color: 'var(--text-muted)', lineHeight: 1 }}>{showConfirmPw ? '🙈' : '👁️'}</button>
                </div>
                {form.confirm_password && form.password !== form.confirm_password && (
                  <div style={{ fontSize: 11, color: '#FF5757', marginTop: 4 }}>⚠️ Passwords do not match</div>
                )}
                {form.confirm_password && form.password === form.confirm_password && (
                  <div style={{ fontSize: 11, color: '#00E5A0', marginTop: 4 }}>✓ Passwords match</div>
                )}
              </div>

              {/* Summary Card */}
              <div style={{ background: 'rgba(108,99,255,0.07)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)' }}>📋 Account Summary</div>
                {[
                  ['Name', form.full_name],
                  ['DOB', `${form.date_of_birth}${age !== null ? ` (Age ${age})` : ''}`],
                  ['Gender', form.gender],
                  ['Account', form.account_type === 'savings' ? '🏧 Savings' : '💼 Current'],
                  ['Occupation', form.occupation === 'Other' ? otherOccupation : form.occupation],
                  ['Income', form.annual_income],
                  ['Phone', `+91 ${form.phone}`],
                  ['Email', form.email],
                  ['Nationality', form.nationality],
                ].map(([k, v]) => v ? (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontWeight: 600, maxWidth: '60%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
                  </div>
                ) : null)}
              </div>

              {/* Benefits */}
              <div style={{ background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
                  {['₹10,000 Welcome Bonus', 'Free Virtual Card', 'Auto UPI ID', '24/7 Support'].map(b => (
                    <span key={b} style={{ color: '#00E5A0', fontWeight: 600 }}>✓ {b}</span>
                  ))}
                </div>
              </div>

              {/* Terms & Conditions */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 16, padding: '12px 14px', background: termsAccepted ? 'rgba(0,229,160,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${termsAccepted ? 'rgba(0,229,160,0.35)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, transition: 'all 0.2s' }}>
                <div style={{ position: 'relative', flexShrink: 0, marginTop: 1 }}>
                  <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#00E5A0', cursor: 'pointer' }} />
                </div>
                <span style={{ fontSize: 12, color: termsAccepted ? '#00E5A0' : 'var(--text-secondary)', lineHeight: 1.6, fontWeight: termsAccepted ? 600 : 400, transition: 'color 0.2s' }}>
                  {termsAccepted ? '✅ ' : ''}I agree to the{' '}
                  <span style={{ color: 'var(--primary-light)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>Terms & Conditions</span>,{' '}
                  <span style={{ color: 'var(--primary-light)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span>, and{' '}
                  <span style={{ color: 'var(--primary-light)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>Banking Services Agreement</span> of Money Mitra.
                </span>
              </label>

              <button
                onClick={handleSubmit}
                disabled={loading || form.password !== form.confirm_password || !termsAccepted}
                style={{ width: '100%', background: 'var(--gradient-primary)', border: 'none', borderRadius: 12, padding: '14px', color: 'white', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', transition: 'all 0.2s', opacity: loading || form.password !== form.confirm_password || !termsAccepted ? 0.6 : 1 }}
              >
                {loading ? '⏳ Creating Account...' : '🚀 Create Account & Claim ₹10,000'}
              </button>
            </div>
          )}

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {step > 0 && (
              <button type="button" onClick={() => setStep(s => s - 1)} style={{ flex: '0 0 auto', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 20px', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                ← Back
              </button>
            )}
            {step < 3 && (
              <button type="button" onClick={next} style={{ flex: 1, background: 'var(--gradient-primary)', border: 'none', borderRadius: 10, padding: '12px', color: 'white', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                Continue → {STEPS[step + 1]}
              </button>
            )}
          </div>

          <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--primary-light)', fontWeight: 700, textDecoration: 'none' }}>Sign In →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
