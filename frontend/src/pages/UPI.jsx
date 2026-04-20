import React, { useEffect, useRef, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import jsQR from 'jsqr';
import { upiAPI, accountAPI, beneficiaryAPI } from '../services/api';
import { formatINR } from '../utils/helpers';
import toast from 'react-hot-toast';

const TABS = ['send', 'receive', 'ids'];

// ── QR Scanner Modal — Camera + Gallery ──────────────────────────────────────
function QrScannerModal({ onResult, onClose }) {
  const [mode, setMode] = useState('camera'); // 'camera' | 'gallery'
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [camError, setCamError] = useState('');
  const [galleryError, setGalleryError] = useState('');
  const [galleryPreview, setGalleryPreview] = useState(null);
  const [galleryDecoding, setGalleryDecoding] = useState(false);
  const [gallerySuccess, setGallerySuccess] = useState('');
  const intervalRef = useRef(null);

  const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  // Start camera when mode = camera
  useEffect(() => {
    if (mode !== 'camera') { stopStream(); return; }
    startCamera();
    return () => { stopStream(); };
  }, [mode]);

  const startCamera = () => {
    setCamError('');
    if (!hasBarcodeDetector && !navigator.mediaDevices) { setCamError('Camera not supported on this browser.'); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        if (hasBarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          intervalRef.current = setInterval(async () => {
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                clearInterval(intervalRef.current);
                stopStream();
                onResult(barcodes[0].rawValue);
              }
            } catch { }
          }, 400);
        } else {
          // jsQR fallback via canvas
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          intervalRef.current = setInterval(() => {
            const v = videoRef.current;
            if (!v || v.readyState < 2) return;
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imgData.data, imgData.width, imgData.height);
            if (code) {
              clearInterval(intervalRef.current);
              stopStream();
              onResult(code.data);
            }
          }, 400);
        }
      })
      .catch(() => setCamError('Camera permission denied or not available on this device.'));
  };

  const stopStream = () => {
    clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const handleClose = () => { stopStream(); onClose(); };

  // Gallery: decode QR from uploaded image using jsQR
  const handleGalleryFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setGalleryError('Please select an image file.'); return; }
    setGalleryError('');
    setGallerySuccess('');
    setGalleryDecoding(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setGalleryPreview(ev.target.result);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
        setGalleryDecoding(false);
        if (code) {
          setGallerySuccess(code.data);
        } else {
          setGalleryError('No QR code found in this image. Try a clearer photo.');
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const useGalleryResult = () => {
    if (gallerySuccess) { onResult(gallerySuccess); handleClose(); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      backdropFilter: 'blur(8px)'
    }} onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 22,
        padding: 26, width: '100%', maxWidth: 430, boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>📷 Scan QR Code</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Scan or import a UPI QR code</div>
          </div>
          <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 12, padding: 4, marginBottom: 20, gap: 4 }}>
          {[['camera', '📷 Camera'], ['gallery', '🖼️ Gallery']].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
              background: mode === m ? 'var(--gradient-primary)' : 'transparent',
              color: mode === m ? '#fff' : 'var(--text-muted)',
            }}>{label}</button>
          ))}
        </div>

        {/* ── CAMERA MODE ── */}
        {mode === 'camera' && (
          <div>
            {camError ? (
              <div>
                <div style={{ background: 'rgba(255,75,75,0.08)', border: '1px solid rgba(255,75,75,0.2)', borderRadius: 14, padding: 20, textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🚫</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--error)', marginBottom: 4 }}>Camera Unavailable</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{camError}</div>
                  <button onClick={startCamera} className="btn-primary" style={{ marginTop: 14, padding: '9px 20px', fontSize: 13 }}>🔄 Retry</button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 8 }}>— or use Gallery tab to import a QR image —</div>
              </div>
            ) : (
              <div>
                <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '1' }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  {/* Dimmed overlay with cutout */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{
                      width: '62%', aspectRatio: '1', position: 'relative',
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                      borderRadius: 18,
                    }}>
                      {/* Scanning line animation */}
                      <div style={{
                        position: 'absolute', left: 4, right: 4, height: 2,
                        background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
                        borderRadius: 2, animation: 'scanLine 2s linear infinite',
                        top: '50%'
                      }} />
                      {/* Corner markers */}
                      {[['top:-3px;left:-3px;borderTop:4px solid;borderLeft:4px solid;borderTopLeftRadius:8px',0],
                        ['top:-3px;right:-3px;borderTop:4px solid;borderRight:4px solid;borderTopRightRadius:8px',1],
                        ['bottom:-3px;left:-3px;borderBottom:4px solid;borderLeft:4px solid;borderBottomLeftRadius:8px',2],
                        ['bottom:-3px;right:-3px;borderBottom:4px solid;borderRight:4px solid;borderBottomRightRadius:8px',3]
                      ].map(([s, i]) => {
                        const styles = {};
                        s.split(';').forEach(rule => { const [k, v] = rule.split(':'); if (k && v) styles[k.trim().replace(/-([a-z])/g, g => g[1].toUpperCase())] = v.trim(); });
                        return <div key={i} style={{ position: 'absolute', width: 24, height: 24, borderColor: '#6C63FF', ...styles }} />;
                      })}
                    </div>
                  </div>
                  <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.4)', padding: '4px 14px', borderRadius: 20 }}>🔍 Align QR code in the box</span>
                  </div>
                </div>
                <style>{`@keyframes scanLine { 0%{top:8%} 50%{top:88%} 100%{top:8%} }`}</style>
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 8 }}>— or type UPI ID directly —</div>
              <ManualUpiEntry onResult={onResult} onClose={handleClose} />
            </div>
          </div>
        )}

        {/* ── GALLERY MODE ── */}
        {mode === 'gallery' && (
          <div>
            {/* Drop zone / file picker */}
            <div
              onClick={() => galleryInputRef.current?.click()}
              style={{
                border: '2px dashed rgba(108,99,255,0.4)', borderRadius: 16,
                padding: galleryPreview ? 0 : '32px 20px',
                textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
                background: 'rgba(108,99,255,0.04)', overflow: 'hidden', minHeight: galleryPreview ? 0 : 160,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(108,99,255,0.8)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(108,99,255,0.4)'}
            >
              {galleryPreview ? (
                <img src={galleryPreview} alt="Selected" style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 14, display: 'block' }} />
              ) : (
                <>
                  <div style={{ fontSize: 52, marginBottom: 12 }}>🖼️</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Tap to choose from Gallery</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select a screenshot or photo containing a QR code</div>
                  <div style={{ marginTop: 14, background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 10, padding: '8px 20px', fontSize: 13, color: 'var(--primary-light)', fontWeight: 600 }}>📁 Choose Image</div>
                </>
              )}
            </div>
            <input ref={galleryInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleGalleryFile} />

            {/* Status */}
            {galleryPreview && (
              <div style={{ marginTop: 14 }}>
                {galleryDecoding && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(108,99,255,0.08)', borderRadius: 12, padding: '12px 16px' }}>
                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Decoding QR from image...</span>
                  </div>
                )}
                {galleryError && !galleryDecoding && (
                  <div style={{ background: 'rgba(255,75,75,0.08)', border: '1px solid rgba(255,75,75,0.2)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'var(--error)' }}>
                    ❌ {galleryError}
                    <button onClick={() => galleryInputRef.current?.click()} style={{ display: 'block', marginTop: 8, background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>Try another image →</button>
                  </div>
                )}
                {gallerySuccess && !galleryDecoding && (
                  <div style={{ background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.25)', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>✅</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--success)' }}>QR Code Decoded!</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, wordBreak: 'break-all' }}>Found: <strong style={{ color: 'var(--text-primary)' }}>{gallerySuccess}</strong></div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={useGalleryResult} className="btn-primary" style={{ flex: 2, padding: '10px 0', fontSize: 13 }}>⚡ Use This UPI</button>
                      <button onClick={() => { setGalleryPreview(null); setGallerySuccess(''); galleryInputRef.current?.click(); }} style={{ flex: 1, padding: '10px 0', fontSize: 13, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>Rescan</button>
                    </div>
                  </div>
                )}
                {!gallerySuccess && !galleryDecoding && !galleryError && (
                  <button onClick={() => galleryInputRef.current?.click()} style={{ width: '100%', padding: '11px 0', marginTop: 4, background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.25)', borderRadius: 12, fontSize: 13, color: 'var(--primary-light)', fontFamily: 'Outfit, sans-serif', fontWeight: 600, cursor: 'pointer' }}>🖼️ Choose Different Image</button>
                )}
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 8 }}>— or type UPI ID directly —</div>
              <ManualUpiEntry onResult={onResult} onClose={handleClose} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ManualUpiEntry({ onResult, onClose }) {
  const [val, setVal] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input className="input-field" placeholder="name@moneymitra" value={val} onChange={e => setVal(e.target.value)}
        style={{ flex: 1 }} onKeyDown={e => { if (e.key === 'Enter' && val) { onResult(val); onClose(); } }} />
      <button className="btn-primary" style={{ padding: '10px 16px', fontSize: 13 }}
        onClick={() => { if (val) { onResult(val); onClose(); } }}>Use</button>
    </div>
  );
}

// ── Main UPI Page ─────────────────────────────────────────────────────────────
export default function UPI() {
  const [upiIds, setUpiIds] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [sendForm, setSendForm] = useState({ from_account_id: '', to_upi_handle: '', amount: '', description: '' });
  const [lookupResult, setLookupResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState('send');
  const [showScanner, setShowScanner] = useState(false);
  const [showQrModal, setShowQrModal] = useState(null); // holds upi object

  useEffect(() => {
    Promise.all([upiAPI.getAll(), accountAPI.getAll(), beneficiaryAPI.getAll()])
      .then(([u, a, b]) => {
        setUpiIds(u.data.data || []);
        const active = a.data.data.filter(acc => acc.status === 'active');
        setAccounts(active);
        if (active.length > 0) setSendForm(f => ({ ...f, from_account_id: active[0].id }));
        setBeneficiaries(b.data.data || []);
      }).catch(() => toast.error('Failed to load UPI data'));
  }, []);

  const lookupUpi = async () => {
    if (!sendForm.to_upi_handle) return;
    try {
      const res = await upiAPI.lookup(sendForm.to_upi_handle);
      setLookupResult(res.data.data);
    } catch {
      setLookupResult(null);
      toast.error('UPI ID not found');
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await upiAPI.send({ ...sendForm, amount: parseFloat(sendForm.amount) });
      setResult(res.data.data);
      toast.success('⚡ UPI Payment Successful!');
      setSendForm(f => ({ ...f, to_upi_handle: '', amount: '', description: '' }));
      setLookupResult(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'UPI transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const handleScanResult = (scanned) => {
    // parse upi:// or plain handle
    let handle = scanned;
    if (scanned.startsWith('upi://pay?')) {
      const params = new URLSearchParams(scanned.replace('upi://pay?', ''));
      handle = params.get('pa') || scanned;
    }
    setSendForm(f => ({ ...f, to_upi_handle: handle }));
    setTab('send');
    toast.success(`📷 Scanned: ${handle}`);
    setTimeout(() => lookupUpiHandle(handle), 300);
  };

  const lookupUpiHandle = async (handle) => {
    try {
      const res = await upiAPI.lookup(handle);
      setLookupResult(res.data.data);
    } catch { setLookupResult(null); }
  };

  const upiQrValue = (upi) =>
    `upi://pay?pa=${upi.upi_handle}&pn=${encodeURIComponent(upi.account_type || 'Money Mitra')}&cu=INR`;

  const tabLabels = { send: '⚡ Send Money', receive: '📲 Receive / QR', ids: '🆔 My UPI IDs' };

  // UPI IDs belonging to user (for beneficiary UPI chips on send form)
  const upiBeneficiaries = upiIds;

  return (
    <div style={{ maxWidth: 660, margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-title">⚡ UPI Payments</h1>
        <p className="page-subtitle">Send & receive money via UPI instantly</p>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 12, padding: 4, marginBottom: 24, border: '1px solid var(--border)', gap: 4 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 4px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: tab === t ? 'var(--gradient-primary)' : 'transparent',
            color: tab === t ? 'white' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: 13, fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s'
          }}>{tabLabels[t]}</button>
        ))}
      </div>

      {/* ── SEND TAB ───────────────────────── */}
      {tab === 'send' && (
        <div className="glass-card" style={{ padding: 28 }}>
          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Pay From */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Pay From</label>
              <select className="input-field" value={sendForm.from_account_id}
                onChange={e => setSendForm(f => ({ ...f, from_account_id: e.target.value }))}
                style={{ background: 'var(--bg-input)' }}>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id} style={{ background: '#1a1a3e' }}>
                    {acc.account_type.toUpperCase()} ···{acc.account_number.slice(-4)} — {formatINR(acc.balance)}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient UPI + QR Scan */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Recipient UPI ID</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" className="input-field" placeholder="name@moneymitra"
                  value={sendForm.to_upi_handle}
                  onChange={e => { setSendForm(f => ({ ...f, to_upi_handle: e.target.value })); setLookupResult(null); }}
                  required style={{ flex: 1 }} />
                <button type="button" onClick={() => setShowScanner(true)} style={{
                  background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.3)',
                  borderRadius: 10, padding: '0 14px', cursor: 'pointer', fontSize: 20,
                  color: 'var(--primary-light)', transition: 'all 0.18s', whiteSpace: 'nowrap'
                }} title="Scan QR Code">
                  📷
                </button>
                <button type="button" className="btn-secondary" onClick={lookupUpi} style={{ padding: '12px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>
                  🔍 Verify
                </button>
              </div>

              {/* Lookup Result */}
              {lookupResult && (
                <div style={{ marginTop: 10, background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{lookupResult.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lookupResult.upi_handle}</div>
                  </div>
                </div>
              )}

              {/* Beneficiary UPI Quick-Select */}
              {beneficiaries.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>⚡ Quick select from saved beneficiaries:</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {beneficiaries.map(ben => (
                      <button key={ben.id} type="button" onClick={() => {
                        setSendForm(f => ({ ...f, to_upi_handle: '' }));
                        toast('💡 Beneficiary works for bank transfers. For UPI, enter their UPI ID.', { icon: 'ℹ️', duration: 3000 });
                      }} style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 20, padding: '5px 14px', cursor: 'pointer',
                        fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'Outfit, sans-serif',
                        display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.18s'
                      }}>
                        <span>{ben.is_verified ? '✅' : '👤'}</span>
                        <span style={{ fontWeight: 600 }}>{ben.nickname}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>···{ben.account_number?.slice(-4)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* My own UPI quick chips */}
              {upiBeneficiaries.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>📲 My UPI IDs (send to another of yours):</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {upiBeneficiaries.map(upi => (
                      <button key={upi.id} type="button" onClick={() => {
                        setSendForm(f => ({ ...f, to_upi_handle: upi.upi_handle }));
                        lookupUpiHandle(upi.upi_handle);
                      }} style={{
                        background: sendForm.to_upi_handle === upi.upi_handle ? 'rgba(108,99,255,0.18)' : 'var(--bg-card)',
                        border: `1px solid ${sendForm.to_upi_handle === upi.upi_handle ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 20, padding: '5px 14px', cursor: 'pointer',
                        fontSize: 12, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', transition: 'all 0.18s'
                      }}>
                        ⚡ {upi.upi_handle}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Amount */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Amount (₹)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 18, fontWeight: 700 }}>₹</span>
                <input type="number" className="input-field" placeholder="0.00" min="1" max="200000" step="0.01"
                  value={sendForm.amount} onChange={e => setSendForm(f => ({ ...f, amount: e.target.value }))}
                  required style={{ paddingLeft: 36 }} />
              </div>
              {/* Quick amounts */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {[100, 200, 500, 1000, 2000].map(amt => (
                  <button key={amt} type="button" onClick={() => setSendForm(f => ({ ...f, amount: amt }))} style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)',
                    fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s'
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    ₹{amt.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>UPI limit: ₹2,00,000 per transaction</p>
            </div>

            {/* Note */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Note (Optional)</label>
              <input type="text" className="input-field" placeholder="For what?" maxLength={50}
                value={sendForm.description} onChange={e => setSendForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <button type="submit" className="btn-primary" disabled={loading || !sendForm.from_account_id || !sendForm.to_upi_handle || !sendForm.amount}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Processing...
                </span>
              ) : '⚡ Pay via UPI'}
            </button>
          </form>

          {result && (
            <div style={{ marginTop: 24, background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 12, fontSize: 16 }}>⚡ Payment Successful!</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[['Amount', formatINR(result.amount)], ['To UPI', result.to_upi], ['Ref No.', result.reference_number], ['New Balance', formatINR(result.new_balance)]].map(([l, v]) => (
                  <div key={l} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: l === 'Ref No.' ? 'monospace' : 'inherit' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RECEIVE / QR TAB ───────────────────────── */}
      {tab === 'receive' && (
        <div className="glass-card" style={{ padding: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>📲 Your Payment QR Codes</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
            Share any QR below to receive money instantly
          </div>

          {upiIds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No UPI IDs yet</div>
              <p style={{ fontSize: 13 }}>Create a UPI ID from the "My UPI IDs" tab first</p>
              <button onClick={() => setTab('ids')} className="btn-primary" style={{ marginTop: 16 }}>Create UPI ID →</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {upiIds.map(upi => (
                <div key={upi.id} style={{
                  background: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(255,107,157,0.05))',
                  border: '1px solid rgba(108,99,255,0.2)', borderRadius: 18, padding: 24,
                  display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap'
                }}>
                  {/* QR Code */}
                  <div style={{
                    background: '#fff', borderRadius: 16, padding: 14,
                    boxShadow: '0 8px 32px rgba(108,99,255,0.2)', flexShrink: 0
                  }}>
                    <QRCodeSVG
                      value={upiQrValue(upi)}
                      size={150}
                      bgColor="#ffffff"
                      fgColor="#1a1a3e"
                      level="H"
                      imageSettings={{
                        src: '',
                        x: undefined,
                        y: undefined,
                        height: 0,
                        width: 0,
                        excavate: false,
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-light)' }}>⚡</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-light)' }}>{upi.upi_handle}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                      🏦 Linked: ···{upi.account_number?.slice(-4)} · {upi.account_type}
                    </div>
                    {upi.is_primary && (
                      <span style={{ fontSize: 10, background: 'rgba(108,99,255,0.15)', color: 'var(--primary-light)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 10, padding: '2px 10px', fontWeight: 700 }}>
                        PRIMARY
                      </span>
                    )}

                    <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {/* Copy UPI handle */}
                      <button onClick={() => { navigator.clipboard.writeText(upi.upi_handle); toast.success('UPI ID copied!'); }}
                        style={{
                          background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.25)',
                          borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12,
                          color: 'var(--primary-light)', fontFamily: 'Outfit, sans-serif', fontWeight: 600
                        }}>
                        📋 Copy UPI ID
                      </button>

                      {/* Download QR */}
                      <button onClick={() => setShowQrModal(upi)} style={{
                        background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)',
                        borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12,
                        color: 'var(--success)', fontFamily: 'Outfit, sans-serif', fontWeight: 600
                      }}>
                        🔍 Enlarge QR
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MY UPI IDs TAB ───────────────────────── */}
      {tab === 'ids' && (
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>My UPI IDs</div>
          {upiIds.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">⚡</div><p>No UPI IDs found. Create one from your bank account.</p></div>
          ) : upiIds.map(upi => (
            <div key={upi.id} style={{
              background: 'var(--bg-input)', borderRadius: 12, padding: 16, marginBottom: 10,
              border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-light)' }}>⚡ {upi.upi_handle}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Linked to ···{upi.account_number?.slice(-4)} · {upi.account_type}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => { setTab('receive'); }} style={{
                  background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.25)',
                  borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                  color: 'var(--primary-light)', fontFamily: 'Outfit, sans-serif', fontWeight: 600
                }}>
                  📲 QR
                </button>
                {upi.is_primary && <span className="badge badge-primary">Primary</span>}
                <span className={`badge ${upi.is_active ? 'badge-success' : 'badge-error'}`}>
                  {upi.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── QR SCANNER MODAL ───────────────────────── */}
      {showScanner && (
        <QrScannerModal
          onResult={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* ── ENLARGED QR MODAL ───────────────────────── */}
      {showQrModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          backdropFilter: 'blur(6px)'
        }} onClick={() => setShowQrModal(null)}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 24,
            padding: 36, textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.6)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📲 {showQrModal.upi_handle}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Scan to pay me via UPI</div>
            <div style={{ background: '#fff', borderRadius: 20, padding: 20, display: 'inline-block', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
              <QRCodeSVG value={upiQrValue(showQrModal)} size={240} bgColor="#ffffff" fgColor="#1a1a3e" level="H" />
            </div>
            <div style={{ marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
              UPI ID: <strong style={{ color: 'var(--primary-light)' }}>{showQrModal.upi_handle}</strong>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center' }}>
              <button onClick={() => { navigator.clipboard.writeText(showQrModal.upi_handle); toast.success('Copied!'); }} style={{
                background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.25)',
                borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontSize: 13,
                color: 'var(--primary-light)', fontFamily: 'Outfit, sans-serif', fontWeight: 600
              }}>📋 Copy UPI ID</button>
              <button onClick={() => setShowQrModal(null)} style={{
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontSize: 13,
                color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif', fontWeight: 600
              }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
