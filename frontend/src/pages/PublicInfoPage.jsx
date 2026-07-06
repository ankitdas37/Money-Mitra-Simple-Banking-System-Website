import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const contentData = {
  'savings': {
    title: 'Savings Account',
    subtitle: 'Grow your wealth with high-interest, zero-fee savings.',
    icon: 'fa-piggy-bank',
    color: '#00E5A0', // Neon Green
    content: [
      { heading: 'Smart Savings for the Future', text: 'At Money Mitra, we believe your money should work as hard as you do. Our Savings Accounts offer industry-leading interest rates with absolutely zero hidden fees or maintenance charges.' },
      { heading: 'Automated Wealth Building', text: 'Set up auto-sweeps to move excess funds into high-yield deposits. Reach your financial goals faster with our intuitive dashboard and AI-powered insights.' },
      { heading: 'Key Benefits', text: '✓ 6.5% Annual Interest\n✓ Zero Minimum Balance\n✓ Free Virtual Debit Card\n✓ Instant Account Opening' }
    ]
  },
  'current': {
    title: 'Current Account',
    subtitle: 'Powerful banking solutions for modern businesses.',
    icon: 'fa-briefcase',
    color: '#6C63FF', // Primary Purple
    content: [
      { heading: 'Built for Scale', text: 'Whether you are a freelancer or a growing enterprise, Money Mitra Current Accounts give you the tools to manage your cash flow efficiently.' },
      { heading: 'Seamless Transactions', text: 'Enjoy unlimited NEFT, RTGS, and IMPS transfers. Integrate seamlessly with your existing accounting software through our powerful developer API.' },
      { heading: 'Key Benefits', text: '✓ Unlimited Transactions\n✓ Dedicated Relationship Manager\n✓ Multi-user Access Controls\n✓ Automated Invoicing & Reminders' }
    ]
  },
  'upi': {
    title: 'UPI Transfers',
    subtitle: 'Lightning-fast payments straight from your phone.',
    icon: 'fa-bolt',
    color: '#FF5757', // Neon Red
    content: [
      { heading: 'Instant Payments, Anywhere', text: 'Money Mitra brings you the fastest UPI experience. Scan any QR code or enter a UPI ID to send money securely within seconds.' },
      { heading: 'Zero Failure Rate', text: 'Powered by a robust multi-bank routing system, our UPI transactions boast a 99.99% success rate. Say goodbye to pending payments.' },
      { heading: 'Key Benefits', text: '✓ Scan & Pay instantly\n✓ Split bills with friends\n✓ Track all UPI expenses\n✓ Bank-grade encryption' }
    ]
  },
  'loans': {
    title: 'Personal Loans',
    subtitle: 'Instant approvals, low rates, zero hassle.',
    icon: 'fa-hand-holding-dollar',
    color: '#F4D03F', // Gold
    content: [
      { heading: 'Finance Your Dreams', text: 'Need funds for a wedding, medical emergency, or a new gadget? Money Mitra offers instant personal loans up to ₹10 Lakhs right within the app.' },
      { heading: 'Paperless & Instant', text: 'No queues, no endless documentation. Our AI-driven credit model approves your loan instantly based on your transaction history and credit score.' },
      { heading: 'Key Benefits', text: '✓ Rates starting at 10.5% p.a.\n✓ Zero Foreclosure Charges\n✓ Flexible EMI Options (3-60 months)\n✓ Funds credited in 5 minutes' }
    ]
  },
  'cards': {
    title: 'Credit Cards',
    subtitle: 'Anime-styled metal cards with ultimate rewards.',
    icon: 'fa-credit-card',
    color: '#FF00FF', // Magenta
    content: [
      { heading: 'The Most Rewarding Card', text: 'Get 5% cashback on all online spends, unlimited lounge access, and zero forex markup. The Money Mitra Signature Card is designed for the modern spender.' },
      { heading: 'Virtual & Physical', text: 'Generate unlimited virtual cards for secure online shopping. Order our premium anime-themed metal physical cards delivered to your doorstep.' },
      { heading: 'Key Benefits', text: '✓ Up to ₹5 Lakh Credit Limit\n✓ 50 Days Interest-Free Period\n✓ Real-time Spend Tracking\n✓ In-app Card Controls (Freeze/Block)' }
    ]
  },
  'privacy': {
    title: 'Privacy Policy',
    subtitle: 'Your data is yours. We keep it that way.',
    icon: 'fa-shield-halved',
    color: '#4A90E2', // Blue
    content: [
      { heading: 'Data Collection & Usage', text: 'Money Mitra only collects data that is absolutely necessary to provide you with secure banking services (e.g., KYC details, transaction logs). We never sell your personal data to third parties.' },
      { heading: 'End-to-End Encryption', text: 'All your financial and personal data is encrypted both at rest and in transit using military-grade AES-256 encryption. Your privacy is our highest priority.' },
      { heading: 'Your Rights', text: 'You have the right to request access, correction, or deletion of your data at any time through the app settings or by contacting our Data Protection Officer.' }
    ]
  },
  'terms': {
    title: 'Terms of Service',
    subtitle: 'The rules of engagement for using Money Mitra.',
    icon: 'fa-file-contract',
    color: '#95A5A6', // Gray
    content: [
      { heading: 'User Agreement', text: 'By accessing Money Mitra, you agree to comply with our platform policies. Accounts are meant for personal or authorized business use only.' },
      { heading: 'Account Responsibilities', text: 'You are responsible for maintaining the confidentiality of your login credentials. Notify us immediately of any unauthorized use of your account.' },
      { heading: 'Service Availability', text: 'While we strive for 100% uptime, Money Mitra reserves the right to suspend services for scheduled maintenance or security upgrades.' }
    ]
  },
  'cookies': {
    title: 'Cookie Policy',
    subtitle: 'How we use cookies to improve your experience.',
    icon: 'fa-cookie-bite',
    color: '#D35400', // Orange/Brown
    content: [
      { heading: 'What are Cookies?', text: 'Cookies are small text files stored on your device that help us remember your preferences and keep your session secure while you browse.' },
      { heading: 'How We Use Them', text: 'We use essential cookies for authentication and security. We also use analytics cookies to understand how you interact with our platform so we can improve the UI/UX.' },
      { heading: 'Managing Preferences', text: 'You can disable non-essential cookies at any time through your browser settings, though some platform features may not function optimally.' }
    ]
  },
  'security': {
    title: 'Security',
    subtitle: 'Bank-grade security built for the digital age.',
    icon: 'fa-lock',
    color: '#27AE60', // Emerald
    content: [
      { heading: 'Multi-Layered Defense', text: 'Money Mitra employs biometric authentication, mandatory 2FA, and behavioral analytics to detect and block suspicious activities before they happen.' },
      { heading: 'Fraud Protection', text: 'Our real-time AI monitors transactions 24/7. In the rare event of unauthorized access, our zero-liability policy ensures your money is fully protected.' },
      { heading: 'Vulnerability Disclosures', text: 'We regularly conduct third-party audits and host bug bounty programs to continuously strengthen our digital infrastructure.' }
    ]
  },
  'blog': {
    title: 'Money Mitra Blog',
    subtitle: 'Insights, updates, and financial wisdom.',
    icon: 'fa-newspaper',
    color: '#8E44AD', // Violet
    content: [
      { heading: 'Latest Updates', text: 'Stay tuned for deep dives into our engineering process, new feature announcements, and tutorials on how to maximize your wealth using Money Mitra.' },
      { heading: 'Financial Literacy', text: 'Read our weekly articles breaking down complex financial topics like compounding interest, credit scores, and investment strategies into simple, anime-themed guides.' },
      { heading: 'Join the Community', text: 'We frequently feature guest posts from our community. Got a success story? Share it with us to get featured on the official blog!' }
    ]
  },
  'press': {
    title: 'Press & Media',
    subtitle: 'Money Mitra in the news.',
    icon: 'fa-microphone',
    color: '#E74C3C', // Crimson
    content: [
      { heading: 'Media Kit', text: 'Looking to write about Money Mitra? Download our official Media Kit containing high-res logos, brand guidelines, and leadership headshots.' },
      { heading: 'Recent Features', text: 'Money Mitra was recently featured in Fintech Today for "Revolutionizing Gen-Z Banking" and awarded "Best UI/UX Design of 2026" by the Global Design Awards.' },
      { heading: 'Press Contacts', text: 'For all press and media inquiries, please reach out to press@moneymitra.com. Our PR team responds within 24 hours.' }
    ]
  }
};

export default function PublicInfoPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract the last segment — works for both /upi and /info/upi
  const segments = location.pathname.split('/').filter(Boolean);
  const pageId = segments[segments.length - 1];
  const data = contentData[pageId];

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pageId]);

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '48px', marginBottom: '16px' }}>404</h1>
          <p style={{ color: 'var(--text-muted)' }}>Page not found.</p>
          <button onClick={() => navigate('/')} className="btn btn-primary" style={{ marginTop: '24px' }}>Go Home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: 'var(--bg-dark)', color: 'var(--text)', position: 'relative', overflowX: 'hidden' }}>
      <div className="animated-bg" style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
      
      <div style={{ position: 'relative', zIndex: 1, padding: '24px', maxWidth: '1000px', margin: '0 auto', paddingTop: '40px' }}>
        
        <button 
          onClick={() => {
            const hasToken = !!localStorage.getItem('accessToken');
            if (hasToken) navigate('/dashboard');
            else window.location.replace('/home.html');
          }}
          className="btn btn-outline" 
          style={{ marginBottom: '40px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <span>←</span> Back to Home
        </button>

        {/* Header Section */}
        <header style={{ 
          textAlign: 'center', 
          marginBottom: '60px',
          padding: '40px',
          background: 'rgba(7, 7, 26, 0.6)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Decorative glowing orb */}
          <div style={{
            position: 'absolute',
            top: '-50px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '150px',
            height: '150px',
            background: data.color,
            filter: 'blur(80px)',
            opacity: 0.3,
            zIndex: 0
          }} />

          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${data.color}, var(--bg-card))`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: '32px',
            color: 'white',
            boxShadow: `0 10px 20px ${data.color}33`,
            position: 'relative',
            zIndex: 1
          }}>
            <i className={`fa-solid ${data.icon}`}></i>
          </div>
          
          <h1 style={{ fontSize: '42px', fontWeight: 800, marginBottom: '12px', position: 'relative', zIndex: 1 }}>
            {data.title}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '20px', position: 'relative', zIndex: 1 }}>
            {data.subtitle}
          </p>
        </header>

        {/* Content Blocks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '80px' }}>
          {data.content.map((section, idx) => (
            <div key={idx} className="card reveal" style={{ 
              padding: '32px',
              borderLeft: `4px solid ${data.color}`,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(10px)';
              e.currentTarget.style.boxShadow = `-5px 10px 20px ${data.color}22`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'white' }}>
                {section.heading}
              </h2>
              <div style={{ 
                color: 'var(--text-muted)', 
                fontSize: '16px', 
                lineHeight: '1.8',
                whiteSpace: 'pre-line' 
              }}>
                {section.text}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
