import {
  createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode,
} from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { identifyUser, resetUser } from '../lib/posthog';

// ---------------------------------------------------------------------------
// Dev-only auth bypass: set VITE_DEV_AUTH_BYPASS=true in .env to skip Google/
// Supabase sign-in entirely when running locally. The app behaves as if a user
// named "Dev User" is permanently signed in.
// ---------------------------------------------------------------------------
const DEV_AUTH_BYPASS =
  import.meta.env.DEV &&
  import.meta.env.VITE_DEV_AUTH_BYPASS === 'true';

function makeDevSession(): { session: Session; user: User } {
  const user = {
    id: 'dev-local-user-00000000',
    email: import.meta.env.VITE_DEV_AUTH_EMAIL as string || 'dev@localhost',
    app_metadata: {},
    user_metadata: { full_name: 'Dev User' },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as unknown as User;

  const session = {
    access_token: 'dev-access-token',
    refresh_token: 'dev-refresh-token',
    expires_in: 99999,
    token_type: 'bearer',
    user,
  } as unknown as Session;

  return { session, user };
}

interface SignUpResult {
  error: AuthError | null;
  needsEmailConfirmation: boolean;
  session: Session | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  authReady: boolean;
  signIn: (email: string, password: string) => Promise<AuthError | null>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<AuthError | null>;
  signInWithMagicLink: (email: string) => Promise<{ error: AuthError | null; sent: boolean }>;
  isAdmin: boolean;
}

const ADMIN_EMAILS = (import.meta.env.VITE_ALLOWED_ADMIN_EMAILS as string || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // ── Dev bypass path ──────────────────────────────────────────────────────
  const devData = useMemo(() => (DEV_AUTH_BYPASS ? makeDevSession() : null), []);

  const [session, setSession] = useState<Session | null>(devData?.session ?? null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured || DEV_AUTH_BYPASS);

  useEffect(() => {
    if (DEV_AUTH_BYPASS) {
      // eslint-disable-next-line no-console
      console.info('[AuthContext] Dev auth bypass active — signed in as', devData!.user.email);
      return;
    }

    if (!isSupabaseConfigured || !supabase) return;

    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => {})
      .finally(() => setAuthReady(true));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        identifyUser(newSession.user.id, { email: newSession.user.email });
      } else {
        resetUser();
      }
    });

    return () => subscription.unsubscribe();
  }, [devData]);

  const noop = useCallback(async () => null, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthError | null> => {
    if (DEV_AUTH_BYPASS || !supabase) return null;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data.session) setSession(data.session);
    return error;
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    if (DEV_AUTH_BYPASS || !supabase) return { error: null, needsEmailConfirmation: false, session: null };
    const { data, error } = await supabase.auth.signUp({ email, password });
    const needsEmailConfirmation = !error && !!data.user && !data.session;
    if (data.session) setSession(data.session);
    return { error, needsEmailConfirmation, session: data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (DEV_AUTH_BYPASS || !supabase) return;
    await supabase.auth.signOut();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthError | null> => {
    if (DEV_AUTH_BYPASS || !supabase) return null;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return error;
  }, []);

  const signInWithMagicLink = useCallback(async (email: string): Promise<{ error: AuthError | null; sent: boolean }> => {
    if (DEV_AUTH_BYPASS || !supabase) return { error: null, sent: false };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    return { error, sent: !error };
  }, []);

  const user = session?.user ?? null;
  const isAdmin = Boolean(
    DEV_AUTH_BYPASS || (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())),
  );

  return (
    <AuthContext.Provider value={{
      session, user, authReady,
      signIn, signUp, signOut,
      signInWithGoogle: DEV_AUTH_BYPASS ? noop : signInWithGoogle,
      signInWithMagicLink,
      isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
