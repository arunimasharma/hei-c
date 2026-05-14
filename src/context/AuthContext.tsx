import {
  createContext, useContext, useEffect, useState, useCallback, type ReactNode,
} from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface SignUpResult {
  error: AuthError | null;
  /** True when Supabase returned a user but no session, meaning the project has
   *  email confirmation enabled and the user must verify their email before
   *  they can sign in. */
  needsEmailConfirmation: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  /** True once the initial getSession() call resolves — prevents flicker. */
  authReady: boolean;
  signIn: (email: string, password: string) => Promise<AuthError | null>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // When Supabase isn't configured, skip the async getSession call entirely
  // so the app never blocks on missing credentials.
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => {})
      .finally(() => setAuthReady(true));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthError | null> => {
    if (!supabase) return null;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    if (!supabase) return { error: null, needsEmailConfirmation: false };
    const { data, error } = await supabase.auth.signUp({ email, password });
    // When email confirmation is enabled in Supabase, signUp returns a user
    // record but no session. Without a session the user cannot sign in until
    // they click the verification link, so the UI needs to surface that.
    const needsEmailConfirmation = !error && !!data.user && !data.session;
    return { error, needsEmailConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      authReady,
      signIn, signUp, signOut,
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
