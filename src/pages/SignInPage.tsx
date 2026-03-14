import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { migrateToSupabase } from '../services/migrationService';
import Button from '../components/common/Button';
import Input from '../components/common/Input';

export default function SignInPage() {
  const { signIn, signUp, user } = useAuth();
  const { state } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const authError = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password);

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Run one-time Dexie → Supabase migration.
    // user may not yet be set in context at this point (onAuthStateChange fires async),
    // so we re-fetch the session directly.
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

    navigate('/', { replace: true });
  };

  // Redirect if already signed in
  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #F8F7FF 0%, #EEF0FB 100%)',
      padding: '1.5rem',
    }}>
      <div style={{
        width: '100%', maxWidth: '400px',
        backgroundColor: 'white', borderRadius: '20px',
        padding: '2.5rem 2rem',
        boxShadow: '0 4px 24px rgba(74, 95, 193, 0.1)',
      }}>
        {/* Logo / heading */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #4A5FC1, #8B7EC8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            fontSize: '1.5rem',
          }}>
            🧠
          </div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.375rem' }}>
            {mode === 'signin'
              ? 'Sign in to sync your data across devices'
              : 'Sign up to start tracking your growth'}
          </p>
        </div>

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
            error={error ?? undefined}
          />

          <Button type="submit" fullWidth disabled={loading || migrating} style={{ marginTop: '0.5rem' }}>
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
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#4A5FC1', fontWeight: 600, padding: 0, fontFamily: 'inherit', fontSize: 'inherit',
            }}
          >
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.8125rem', color: '#9CA3AF' }}>
          <button
            onClick={() => navigate('/', { replace: true })}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9CA3AF', padding: 0, fontFamily: 'inherit', fontSize: 'inherit',
              textDecoration: 'underline',
            }}
          >
            Continue without signing in
          </button>
        </p>
      </div>
    </div>
  );
}
