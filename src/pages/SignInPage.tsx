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
  const { signIn, signUp, user, authReady } = useAuth();
  const { state } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Honor a ?next= path set by gates (e.g. RequireAuth) so the user lands
  // back where they tried to go. Restrict to in-app paths to avoid open redirects.
  const nextParam = searchParams.get('next');
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState<null | 'auto-signed-in' | 'needs-confirmation'>(null);

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setError(null);
    setSignupSuccess(null);
    setPassword('');
    setConfirmPassword('');
  };

  const continueAsGuest = () => {
    sessionStorage.setItem('heq_guest_session', 'true');
    navigate('/', { replace: true });
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
        const { error: authError, needsEmailConfirmation, session } = await signUp(email, password);
        if (authError) {
          setError(authError.message);
          return;
        }
        if (needsEmailConfirmation) {
          // User must click the verification link before they can sign in.
          // Keep them on the signup view with a clear message — switching to
          // signin would just put them in a loop of "Email not confirmed".
          setSignupSuccess('needs-confirmation');
          setPassword('');
          setConfirmPassword('');
          return;
        }
        // Email confirmation is disabled: Supabase auto-created a session.
        // Navigate explicitly — don't rely on the <Navigate> guard at the top
        // of this component, which depends on onAuthStateChange races we've
        // already been bitten by.
        setSignupSuccess('auto-signed-in');
        if (session) {
          navigate(safeNext, { replace: true });
        }
        return;
      }

      // Sign in flow
      const authError = await signIn(email, password);
      if (authError) {
        setError(authError.message);
        return;
      }

      // Run one-time Dexie → Supabase migration.
      try {
        setMigrating(true);
        const { supabase } = await import('../lib/supabaseClient');
        const migrationTimeout = new Promise<void>(resolve => setTimeout(resolve, 5000));
        const migrationRun = supabase?.auth.getUser().then(({ data }) => {
          if (data.user) return migrateToSupabase(data.user.id, state);
        }) ?? Promise.resolve();
        await Promise.race([migrationRun, migrationTimeout]);
      } catch {
        // Migration failure is non-fatal — data will sync on next action.
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

        {/* Benefits panel — shown on signup or initial landing */}
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

        {/* Auth card */}
        <div style={{
          backgroundColor: 'white', borderRadius: '20px',
          padding: '2.5rem 2rem',
          boxShadow: '0 4px 24px rgba(74, 95, 193, 0.1)',
        }}>
          {/* Logo / heading */}
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
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.375rem' }}>
              {mode === 'signin'
                ? 'Sign in to access your growth journey'
                : 'Free forever — your growth data, always with you'}
            </p>
          </div>

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
              Account created! Taking you in…
            </div>
          )}

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
                ? 'Syncing your data…'
                : loading
                  ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
                  : (mode === 'signin' ? 'Sign In' : 'Create Account')}
            </Button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: '#6B7280' }}>
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

          <div style={{ marginTop: '1.25rem', borderTop: '1px solid #F3F4F6', paddingTop: '1.25rem', textAlign: 'center' }}>
            <button
              onClick={continueAsGuest}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9CA3AF', padding: 0, fontFamily: 'inherit', fontSize: '0.8125rem',
              }}
            >
              Continue without signing in
            </button>
            <p style={{ fontSize: '0.75rem', color: '#D1D5DB', margin: '0.25rem 0 0' }}>
              Your data won't be saved between sessions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
