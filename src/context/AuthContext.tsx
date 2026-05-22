import {
  createContext, useContext, useEffect, useState, useCallback, type ReactNode,
} from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { identifyUser, resetUser } from '../lib/posthog';

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
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
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
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthError | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data.session) setSession(data.session);
    return error;
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    if (!supabase) return { error: null, needsEmailConfirmation: false, session: null };
    const { data, error } = await supabase.auth.signUp({ email, password });
    const needsEmailConfirmation = !error && !!data.user && !data.session;
    if (data.session) setSession(data.session);
    return { error, needsEmailConfirmation, session: data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthError | null> => {
    if (!supabase) return null;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return error;
  }, []);

  const signInWithMagicLink = useCallback(async (email: string): Promise<{ error: AuthError | null; sent: boolean }> => {
    if (!supabase) return { error: null, sent: false };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    return { error, sent: !error };
  }, []);

  const user = session?.user ?? null;
  const isAdmin = Boolean(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));

  return (
    <AuthContext.Provider value={{
      session, user, authReady,
      signIn, signUp, signOut,
      signInWithGoogle, signInWithMagicLink,
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
