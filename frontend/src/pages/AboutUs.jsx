import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const developers = [
  {
    id: 1,
    name: 'Ankit Das',
    college: 'Technique Polytechnic Institute (TPI)',
    regNo: 'D242525746',
    semester: '4th Semester',
    project: 'Minor Project',
    socials: {
      github: 'https://github.com/ankitdas37',
      linkedin: 'https://www.linkedin.com/in/ankit-das-434594340?utm_source=share_via&utm_content=profile&utm_medium=member_android',
      instagram: 'https://www.instagram.com/the.ankit.das?igsh=Z3l6MzRiZDR3czF1',
      email: 'mailto:ankitdas082006@gmail.com',
      whatsapp: 'https://wa.me/919339840967',
    },
    image: '/dev_im/ankit.jpg'
  },
  {
    id: 2,
    name: 'Anish Meddya',
    college: 'Technique Polytechnic Institute (TPI)',
    regNo: 'D242525845',
    semester: '4th Semester',
    project: 'Minor Project',
    socials: { github: '#', linkedin: '#', instagram: '#', email: '#', whatsapp: '#' },
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev2&backgroundColor=00E5A0'
  },
  {
    id: 3,
    name: 'Shreya Debnath',
    college: 'Technique Polytechnic Institute (TPI)',
    regNo: 'D242525785',
    semester: '4th Semester',
    project: 'Minor Project',
    socials: { github: '#', linkedin: '#', instagram: '#', email: '#', whatsapp: '#' },
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev3&backgroundColor=FF5757'
  },
  {
    id: 4,
    name: 'Anisha Roy',
    college: 'Technique Polytechnic Institute (TPI)',
    regNo: 'D242525758',
    semester: '4th Semester',
    project: 'Minor Project',
    socials: { github: '#', linkedin: '#', instagram: '#', email: '#', whatsapp: '#' },
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev4&backgroundColor=F4D03F'
  },
  {
    id: 5,
    name: 'Md Karimulla',
    college: 'Technique Polytechnic Institute (TPI)',
    regNo: 'D242525757',
    semester: '4th Semester',
    project: 'Minor Project',
    socials: { github: '#', linkedin: '#', instagram: '#', email: '#', whatsapp: '#' },
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev5&backgroundColor=9B59B6'
  },
  {
    id: 6,
    name: 'Sayak Roy',
    college: 'Technique Polytechnic Institute (TPI)',
    regNo: 'D242525893',
    semester: '4th Semester',
    project: 'Minor Project',
    socials: { github: '#', linkedin: '#', instagram: '#', email: '#', whatsapp: '#' },
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev6&backgroundColor=E67E22'
  }
];

const SOCIAL_ICONS = [
  {
    key: 'github',
    icon: 'fa-brands fa-github',
    label: 'GitHub',
    hoverColor: '#ffffff',
    bg: 'rgba(255,255,255,0.1)',
  },
  {
    key: 'linkedin',
    icon: 'fa-brands fa-linkedin',
    label: 'LinkedIn',
    hoverColor: '#0a66c2',
    bg: 'rgba(10,102,194,0.15)',
  },
  {
    key: 'instagram',
    icon: 'fa-brands fa-instagram',
    label: 'Instagram',
    hoverColor: '#E1306C',
    bg: 'rgba(225,48,108,0.15)',
  },
  {
    key: 'email',
    icon: 'fa-solid fa-envelope',
    label: 'Email',
    hoverColor: '#00E5A0',
    bg: 'rgba(0,229,160,0.12)',
  },
  {
    key: 'whatsapp',
    icon: 'fa-brands fa-whatsapp',
    label: 'WhatsApp',
    hoverColor: '#25D366',
    bg: 'rgba(37,211,102,0.15)',
  },
];

export default function AboutUs() {
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(null);

  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: 'var(--bg-dark)', color: 'var(--text)', position: 'relative', overflowX: 'hidden' }}>
      <div className="animated-bg" style={{ position: 'fixed', inset: 0, zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>

        <button
          onClick={() => {
            const hasToken = !!localStorage.getItem('accessToken');
            if (hasToken) { navigate('/dashboard'); }
            else { window.location.replace('/home.html'); }
          }}
          className="btn btn-outline"
          style={{ marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <span>←</span> Back to Home
        </button>

        <header style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '8px' }}>
            <span className="text-gradient">Money</span> Mitra
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '18px', letterSpacing: '1px' }}>Next-Gen Anime-Inspired Digital Banking</p>
        </header>

        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
            Developed By
          </h2>
          <div style={{ width: '60px', height: '4px', background: 'var(--primary)', margin: '0 auto', borderRadius: '2px' }} />
        </div>

        <div className="dev-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '32px'
        }}>
          {developers.map(dev => (
            <div key={dev.id} className="dev-card card" style={{
              position: 'relative',
              overflow: 'hidden',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.4s ease',
              cursor: 'pointer'
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-10px)';
                e.currentTarget.style.boxShadow = '0 15px 30px rgba(108, 99, 255, 0.2)';
                e.currentTarget.querySelector('.dev-image').style.transform = 'scale(1.1) rotate(3deg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.2)';
                e.currentTarget.querySelector('.dev-image').style.transform = 'scale(1) rotate(0deg)';
              }}>
              {/* Anime style background accent */}
              <div style={{
                position: 'absolute', top: '-50px', right: '-50px',
                width: '100px', height: '100px',
                background: 'radial-gradient(circle, rgba(108,99,255,0.4) 0%, rgba(0,0,0,0) 70%)',
                borderRadius: '50%', zIndex: 0
              }} />

              <div style={{
                width: '120px', height: '120px', borderRadius: '50%', padding: '4px',
                background: 'linear-gradient(45deg, var(--primary), var(--secondary))',
                marginBottom: '20px', zIndex: 1
              }}>
                <img
                  src={dev.image}
                  alt={dev.name}
                  className="dev-image"
                  onClick={(e) => { e.stopPropagation(); setSelectedImage(dev.image); }}
                  style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    objectFit: 'cover', backgroundColor: 'var(--bg-dark)',
                    transition: 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                  }}
                />
              </div>

              <h3 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 16px 0', zIndex: 1 }}>{dev.name}</h3>

              <div style={{ width: '100%', textAlign: 'left', marginBottom: '20px', zIndex: 1, padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>College:</strong> {dev.college}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Reg No:</strong> {dev.regNo}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Semester:</strong> {dev.semester}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Project:</strong> {dev.project}
                </div>
              </div>

              {/* Social Media Links — GitHub, LinkedIn, Instagram, Email, WhatsApp */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', zIndex: 1, marginTop: 'auto', flexWrap: 'wrap' }}>
                {SOCIAL_ICONS.map(({ key, icon, label, hoverColor, bg }) => (
                  dev.socials[key] && dev.socials[key] !== '#' ? (
                    <a
                      key={key}
                      href={dev.socials[key]}
                      target={key === 'email' ? '_self' : '_blank'}
                      rel="noopener noreferrer"
                      title={label}
                      style={{
                        width: 38, height: 38, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--text-muted)', fontSize: '17px',
                        transition: 'all 0.25s', textDecoration: 'none',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = hoverColor;
                        e.currentTarget.style.background = bg;
                        e.currentTarget.style.borderColor = hoverColor;
                        e.currentTarget.style.transform = 'translateY(-3px) scale(1.12)';
                        e.currentTarget.style.boxShadow = `0 6px 16px ${hoverColor}44`;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <i className={icon}></i>
                    </a>
                  ) : (
                    <span
                      key={key}
                      title={`${label} — not available`}
                      style={{
                        width: 38, height: 38, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.2)', fontSize: '17px',
                        cursor: 'not-allowed',
                      }}
                    >
                      <i className={icon}></i>
                    </span>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full-screen Image Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'zoom-out'
          }}
        >
          <button
            onClick={() => setSelectedImage(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'white',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              fontSize: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10000,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            ✕
          </button>
          <img
            src={selectedImage}
            alt="Expanded view"
            style={{
              maxWidth: '100%',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '16px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              cursor: 'default'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
