import { useState } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const WEBHOOK_URL = import.meta.env.VITE_SIGNUP_WEBHOOK_URL as string | undefined;

async function saveSignup(name: string, email: string) {
  const entry = { name, email, timestamp: new Date().toISOString() };

  // Persist locally so admin can inspect from the browser
  try {
    const existing = JSON.parse(localStorage.getItem('heq_club_signups') || '[]');
    existing.push(entry);
    localStorage.setItem('heq_club_signups', JSON.stringify(existing));
  } catch { /* ignore */ }

  // POST to webhook if configured (e.g. Google Apps Script, Formspree, Airtable)
  if (WEBHOOK_URL) {
    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch { /* non-blocking — local save already succeeded */ }
  }
}

export default function AiGateModal() {
  const { aiGated, unlockAi } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!aiGated) return null;

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && !submitting;

  const handleContinue = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!email.trim()) { setError('Please enter your email.'); return; }
    setError('');
    setSubmitting(true);
    await saveSignup(name.trim(), email.trim());
    setSubmitting(false);
    unlockAi();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
    border: '1px solid #E5E7EB', fontSize: '0.875rem', color: '#1F2937',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    backgroundColor: 'white',
  };

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 201,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
      }}>
        <div style={{
          backgroundColor: 'white', borderRadius: '20px',
          padding: '2rem', maxWidth: '420px', width: '100%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
          textAlign: 'center',
        }}>
          {/* Icon */}
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #4A5FC1 0%, #7C3AED 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 8px 24px rgba(74,95,193,0.3)',
          }}>
            <Sparkles size={26} color="white" />
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', margin: '0 0 0.5rem' }}>
            Join the HEQ Club to continue
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            You've used your 5 free AI features. Fill out the form below and join the{' '}
            <strong style={{ color: '#4A5FC1' }}>HEQ Club</strong> to unlock unlimited AI coaching.
          </p>

          {/* Name + Email form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', textAlign: 'left' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>
                Your name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Sarah Chen"
                value={name}
                onChange={e => setName(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#4A5FC1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74,95,193,0.12)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>
                Email address <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#4A5FC1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74,95,193,0.12)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            {error && (
              <p style={{ fontSize: '0.8125rem', color: '#DC2626', margin: 0 }}>{error}</p>
            )}
          </div>

          {/* Google Form link */}
          <a
            href="https://forms.gle/qZAfUaUeYH4FNJnQ9"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem', borderRadius: '12px',
              border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', color: '#4A5FC1',
              fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none',
              marginBottom: '0.75rem',
            }}
          >
            Open HEQ Club form <ExternalLink size={13} />
          </a>

          {/* Submit */}
          <button
            onClick={handleContinue}
            disabled={!canSubmit}
            style={{
              width: '100%', padding: '0.875rem', borderRadius: '12px',
              border: 'none', backgroundColor: canSubmit ? '#4A5FC1' : '#E5E7EB',
              fontSize: '0.9375rem', fontWeight: 600,
              color: canSubmit ? 'white' : '#9CA3AF',
              cursor: canSubmit ? 'pointer' : 'default', fontFamily: 'inherit',
              transition: 'background-color 0.2s',
            }}
          >
            {submitting ? 'Saving…' : "I've joined — continue"}
          </button>
        </div>
      </div>
    </>
  );
}
