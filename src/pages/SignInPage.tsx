import { useState } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { migrateToSupabase } from '../services/migrationService';
import Button from '../components/common/Button';
import Input from '../components/common/Input';

const BENEFITS = [
  { emoji: '🔮', title: 'Pattern recognition', desc: 'Spot emotional trends across weeks and months — not just today.' },
  { emoji: '📈', title: 'Progress tracking', desc: 'Watch your EQ, product taste, and AI skills improve over time with data-backed scores.' },
  { emoji: '🤖', title: 'Smarter AI coaching', desc: 'The more you log, the more personalised your AI suggestions become.' },
  { emoji: '🔄', title: 'Sync across devices', desc: 'Pick up where you left off on any device, any time.' },
];

export default function SignInPage() {
  const { signIn, signUp, signInWithGoogle, signInWithMagicLink, user, authReady } = useAuth();
  const { state } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get('next');
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/';

  const [mode, setMode] = useState<'signin' | 'signup' | 'magic-link'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState<null | 'auto-signed-in' | 'needs-confirmation'>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const switchMode = (next: 'signin' | 'signup' | 'magic-link') => {
    setMode(next);
    setError(null);
    setSignupSuccess(null);
    setMagicLinkSent(false);
    setPassword('');
    setConfirmPassword('');
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    const err = await signInWithGoogle();
    if (err) setError(err.message);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err, sent } = await signInWithMagicLink(email);
      if (err) { setError(err.message); return; }
      if (sent) setMagicLinkSent(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: authError, needsEmailConfirmation } = await signUp(email, password);
        if (authError) { setError(authError.message); return; }
        if (needsEmailConfirmation) {
          setSignupSuccess('needs-confirmation');
          setPassword('');
          setConfirmPassword('');
          return;
        }
        setSignupSuccess('auto-signed-in');
        navigate(safeNext, { replace: true });
        return;
      }

      const authError = await signIn(email, password);
      if (authError) { setError(authError.message); return; }

      try {
        setMigrating(true);
        const { supabase } = await import('../lib/supabaseClient');
        const migrationTimeout = new Promise<void>(resolve => setTimeout(resolve, 5000));
        const migrationRun = supabase?.auth.getUser().then(({ data }) => {
          if (data.user) return migrateToSupabase(data.user.id, state);
        }) ?? Promise.resolve();
        await Promise.race([migrationRun, migrationTimeout]);
      } catch {
        // Migration failure is non-fatal.
      } finally {
        setMigrating(false);
      }

      navigate(safeNext, { replace: true });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!authReady) return null;
  if (user) return <Navigate to={safeNext} replace />;

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #F8F7FF 0%, #EEF0FB 100%)',
      padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {mode === 'signup' && (
          <div style={{
            backgroundColor: 'white', borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 2px 12px rgba(74,95,193,0.08)',
            border: '1px solid rgba(74,95,193,0.1)',
          }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#4A5FC1', margin: '0 0 0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Why create an account?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {BENEFITS.map(b => (
                <div key={b.title} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.125rem', lineHeight: 1.3 }}>{b.emoji}</span>
                  <div>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937' }}>{b.title} </span>
                    <span style={{ fontSize: '0.8125rem', color: '#6B7280' }}>{b.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{
          backgroundColor: 'white', borderRadius: '20px',
          padding: '2.5rem 2rem',
          boxShadow: '0 4px 24px rgba(74, 95, 193, 0.1)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #4A5FC1, #8B7EC8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem', fontSize: '1.5rem',
            }}>
              🧠
            </div>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>
              {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Sign in with email'}
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.375rem' }}>
              {mode === 'signin'
                ? 'Sign in to access your growth journey'
                : mode === 'signup'
                  ? 'Start your growth journey today'
                  : "We'll send you a sign-in link"}
            </p>
          </div>

          {mode !== 'magic-link' && (
            <>
              <button
                onClick={handleGoogleSignIn}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '12px',
                  border: '1px solid #E5E7EB', backgroundColor: 'white', cursor: 'pointer',
                  fontSize: '0.875rem', fontWeight: 500, color: '#374151', fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.25rem 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
                <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 500 }}>or</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
              </div>
            </>
          )}

          {signupSuccess === 'needs-confirmation' && (
            <div style={{
              backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px',
              padding: '0.75rem 1rem', marginBottom: '1rem',
              fontSize: '0.875rem', color: '#92400E', textAlign: 'center',
            }}>
              Check your inbox to confirm <strong>{email}</strong>, then sign in below.
            </div>
          )}
          {signupSuccess === 'auto-signed-in' && (
            <div style={{
              backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px',
              padding: '0.75rem 1rem', marginBottom: '1rem',
              fontSize: '0.875rem', color: '#15803D', textAlign: 'center',
            }}>
              Account created! Taking you in...
            </div>
          )}
          {magicLinkSent && (
            <div style={{
              backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px',
              padding: '0.75rem 1rem', marginBottom: '1rem',
              fontSize: '0.875rem', color: '#15803D', textAlign: 'center',
            }}>
              Magic link sent to <strong>{email}</strong>. Check your inbox!
            </div>
          )}

          {mode === 'magic-link' ? (
            <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
              {error && <p style={{ fontSize: '0.8125rem', color: '#DC2626', margin: 0 }}>{error}</p>}
              <Button type="submit" fullWidth disabled={loading || magicLinkSent}>
                {magicLinkSent ? 'Check your inbox' : loading ? 'Sending...' : 'Send Magic Link'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
              {mode === 'signup' && (
                <Input
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  autoComplete="new-password"
                  error={error ?? undefined}
                />
              )}
              {mode === 'signin' && error && (
                <p style={{ fontSize: '0.8125rem', color: '#DC2626', margin: 0 }}>{error}</p>
              )}
              <Button type="submit" fullWidth disabled={loading || migrating} style={{ marginTop: '0.25rem' }}>
                {migrating
                  ? 'Syncing your data...'
                  : loading
                    ? (mode === 'signin' ? 'Signing in...' : 'Creating account...')
                    : (mode === 'signin' ? 'Sign In' : 'Create Account')}
              </Button>
            </form>
          )}

          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            {mode === 'magic-link' ? (
              <button
                onClick={() => switchMode('signin')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#4A5FC1', fontWeight: 600, padding: 0, fontFamily: 'inherit', fontSize: '0.875rem',
                }}
              >
                Sign in with password
              </button>
            ) : (
              <>
                <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: 0 }}>
                  {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                  <button
                    onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#4A5FC1', fontWeight: 600, padding: 0, fontFamily: 'inherit', fontSize: 'inherit',
                    }}
                  >
                    {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                  </button>
                </p>
                <button
                  onClick={() => switchMode('magic-link')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#9CA3AF', padding: 0, fontFamily: 'inherit', fontSize: '0.8125rem',
                  }}
                >
                  Sign in with magic link instead
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
