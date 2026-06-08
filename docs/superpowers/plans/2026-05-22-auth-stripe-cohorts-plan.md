# Auth, Stripe & Cohort System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mandatory auth (Google, email/password, magic link), Stripe cohort-based payments ($79/8 weeks), free-tier usage gating, admin dashboard, and PostHog analytics to Hello-EQ.

**Architecture:** Extend existing Supabase Auth with Google OAuth and magic link. Add three new Supabase tables (`cohorts`, `user_passes`, `usage_counts`). Stripe Checkout for one-time payments with webhook confirmation. Server-side usage enforcement in existing API routes. PostHog JS SDK for product analytics. Admin dashboard at `/admin` gated by allowed emails env var.

**Tech Stack:** React 19, Vite 7, Supabase (Auth + PostgreSQL + RLS), Stripe Checkout, PostHog JS, Vercel Serverless Functions, TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-22-auth-stripe-cohorts-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|----------------|
| `supabase/migrations/20260522_cohorts_passes_usage.sql` | Schema for cohorts, user_passes, usage_counts tables + RLS |
| `src/services/passService.ts` | Client-side pass status & usage count queries |
| `src/context/PassContext.tsx` | React context for pass status + usage counts + gating logic |
| `src/components/common/RequireAuth.tsx` | Route guard — redirects unauthenticated users to sign-in |
| `src/components/common/PaywallPrompt.tsx` | Upgrade prompt shown when free limits hit |
| `src/components/common/PassStatusBadge.tsx` | Shows pass status (active/expired/days remaining) |
| `api/create-checkout-session.ts` | Creates Stripe Checkout session |
| `api/stripe-webhook.ts` | Handles Stripe `checkout.session.completed` event |
| `api/usage-increment.ts` | Server-side usage count increment (called by existing API routes) |
| `src/pages/AdminPage.tsx` | Admin dashboard — cohort management, user lookup |
| `src/services/adminService.ts` | Admin API calls (CRUD cohorts, query users/passes) |
| `src/lib/posthog.ts` | PostHog initialization + helper |
| `src/services/__tests__/passService.test.ts` | Tests for pass/usage gating logic |

### Modified Files
| File | Changes |
|------|---------|
| `package.json` | Add `stripe`, `posthog-js` dependencies |
| `.env.example` | Add Stripe, PostHog, admin emails env vars |
| `src/lib/supabaseClient.ts` | No changes needed (already works) |
| `src/context/AuthContext.tsx` | Add `signInWithGoogle()` and `signInWithMagicLink()` methods |
| `src/pages/SignInPage.tsx` | Add Google button + magic link option, remove guest bypass |
| `src/App.tsx` | Wrap routes in `RequireAuth` + `PassProvider`, add admin routes |
| `src/main.tsx` | Initialize PostHog |
| `src/pages/AccountPage.tsx` | Add pass status section + upgrade button |
| `api/claude.ts` | Add auth check + usage increment call |
| `api/validator.ts` | Add auth check + usage increment call |
| `api/evaluate-taste.ts` | Add auth check + usage increment call |
| `vite.config.ts` | Add dev middleware for new API routes |
| `vercel.json` | No changes needed (SPA fallback already covers `/admin`) |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install stripe and posthog-js**

Run:
```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npm install stripe posthog-js
```

Expected: Both packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Verify installation**

Run:
```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && node -e "require('stripe'); console.log('stripe OK')" && node -e "require('posthog-js'); console.log('posthog OK')"
```

Expected: Both print OK.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add stripe and posthog-js"
```

---

## Task 2: Environment Variables

**Files:**
- Modify: `.env.example`
- Modify: `.env` (local only, not committed)

- [ ] **Step 1: Update .env.example**

Add these sections after the existing server variables:

```
# ── Stripe — cohort payments ───────────────────────────────────────────────────
# Used by /api/create-checkout-session and /api/stripe-webhook.
# Find these at: Stripe Dashboard → Developers → API Keys / Webhooks.
# If absent: payment features are disabled; all users stay on free tier.
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
# Client-side publishable key — safe for browser exposure.
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# ── Admin emails ───────────────────────────────────────────────────────────────
# Comma-separated list of emails that can access /admin.
# To add a new admin: append their email, redeploy.
VITE_ALLOWED_ADMIN_EMAILS=arunima.productmanager@gmail.com,innovations.arz@gmail.com,arunima.ceo@gmail.com,danazahreddine@hotmail.com,praveen@praveen.science

# ── PostHog — product analytics ────────────────────────────────────────────────
# Used by src/lib/posthog.ts. Get your key at: PostHog → Project Settings → API Key.
# If absent: analytics disabled; app works normally without tracking.
VITE_POSTHOG_KEY=phc_...
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

- [ ] **Step 2: Update local .env with placeholder values**

Add the same keys to your local `.env` file with your actual values. Do not commit `.env`.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: add Stripe, PostHog, admin env vars to .env.example"
```

---

## Task 3: Database Schema — Cohorts, Passes, Usage

**Files:**
- Create: `supabase/migrations/20260522_cohorts_passes_usage.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- cohorts / user_passes / usage_counts: Cohort payment system
-- ============================================================

-- ── Cohorts ─────────────────────────────────────────────────────────────────────
create table if not exists cohorts (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  enrollment_opens_at  timestamptz not null,
  enrollment_closes_at timestamptz not null,
  cohort_starts_at     timestamptz not null,
  cohort_ends_at       timestamptz not null,
  price_cents          int not null default 7900,
  stripe_price_id      text,
  max_seats            int,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),

  constraint cohorts_dates_valid check (
    enrollment_opens_at < enrollment_closes_at
    and cohort_starts_at < cohort_ends_at
  )
);

-- Public read for active cohorts with open enrollment windows.
-- Admin write via service role key (bypasses RLS).
alter table cohorts enable row level security;

create policy "cohorts_public_read"
  on cohorts for select
  using (is_active = true);

-- ── User Passes ─────────────────────────────────────────────────────────────────
create table if not exists user_passes (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  cohort_id                  uuid not null references cohorts(id) on delete restrict,
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  purchased_at               timestamptz not null default now(),
  access_starts_at           timestamptz not null,
  access_ends_at             timestamptz not null,
  status                     text not null default 'active' check (status in ('active', 'expired', 'refunded'))
);

create index if not exists user_passes_user_active_idx
  on user_passes (user_id, access_ends_at desc)
  where status = 'active';

alter table user_passes enable row level security;

create policy "user_passes_owner_select"
  on user_passes for select
  using (auth.uid() = user_id);

-- ── Usage Counts ────────────────────────────────────────────────────────────────
create table if not exists usage_counts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  feature    text not null check (feature in ('coach', 'validator', 'taste')),
  count      int not null default 0,
  updated_at timestamptz not null default now(),

  constraint usage_counts_user_feature_unique unique (user_id, feature)
);

alter table usage_counts enable row level security;

create policy "usage_counts_owner_select"
  on usage_counts for select
  using (auth.uid() = user_id);

-- Server-side increment function (called via service role, bypasses RLS)
create or replace function increment_usage(p_user_id uuid, p_feature text)
returns int
language plpgsql
security definer
as $$
declare
  new_count int;
begin
  insert into usage_counts (user_id, feature, count, updated_at)
  values (p_user_id, p_feature, 1, now())
  on conflict (user_id, feature)
  do update set count = usage_counts.count + 1, updated_at = now()
  returning count into new_count;

  return new_count;
end;
$$;

comment on table cohorts is 'Cohort enrollment windows with pricing. Public read; admin write via service role.';
comment on table user_passes is 'Time-boxed access passes purchased via Stripe. Owner-read; server-write via service role.';
comment on table usage_counts is 'Per-user per-feature usage counters for free-tier gating. Owner-read; server-increment via service role.';
```

- [ ] **Step 2: Apply migration to Supabase**

Run this SQL in the Supabase Dashboard → SQL Editor, or use the Supabase CLI:
```bash
supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260522_cohorts_passes_usage.sql
git commit -m "db: add cohorts, user_passes, usage_counts tables with RLS"
```

---

## Task 4: Auth Context — Add Google OAuth + Magic Link

**Files:**
- Modify: `src/context/AuthContext.tsx`

- [ ] **Step 1: Write test for new auth methods**

Create `src/context/__tests__/AuthContext.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// Unit test for the auth context interface — we verify the shape of the
// context value and the signInWithGoogle/signInWithMagicLink methods exist.
// Full integration tests require a Supabase instance.

describe('AuthContext interface', () => {
  it('should export AuthProvider and useAuth', async () => {
    const mod = await import('../AuthContext');
    expect(mod.AuthProvider).toBeDefined();
    expect(mod.useAuth).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it passes (baseline)**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npx vitest run src/context/__tests__/AuthContext.test.ts
```

- [ ] **Step 3: Update AuthContext.tsx**

Replace the full file content of `src/context/AuthContext.tsx`:

```typescript
import {
  createContext, useContext, useEffect, useState, useCallback, type ReactNode,
} from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

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
```

- [ ] **Step 4: Run test**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npx vitest run src/context/__tests__/AuthContext.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/context/AuthContext.tsx src/context/__tests__/AuthContext.test.ts
git commit -m "feat(auth): add Google OAuth, magic link, and admin detection to AuthContext"
```

---

## Task 5: RequireAuth Guard Component

**Files:**
- Create: `src/components/common/RequireAuth.tsx`

- [ ] **Step 1: Create RequireAuth component**

```typescript
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) return null;

  if (!user) {
    return <Navigate to={`/auth/signin?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/RequireAuth.tsx
git commit -m "feat(auth): add RequireAuth route guard component"
```

---

## Task 6: Pass Service — Client-Side Pass & Usage Queries

**Files:**
- Create: `src/services/passService.ts`
- Create: `src/services/__tests__/passService.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from 'vitest';
import { hasActivePass, isFeatureLocked, FREE_LIMITS } from '../passService';
import type { UserPass, UsageCount } from '../passService';

describe('passService', () => {
  const now = new Date();
  const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  describe('hasActivePass', () => {
    it('returns true when pass is active and within dates', () => {
      const passes: UserPass[] = [{
        id: '1', user_id: 'u1', cohort_id: 'c1',
        status: 'active',
        access_starts_at: pastDate.toISOString(),
        access_ends_at: futureDate.toISOString(),
        purchased_at: pastDate.toISOString(),
      }];
      expect(hasActivePass(passes)).toBe(true);
    });

    it('returns false when pass is expired', () => {
      const farPast = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const passes: UserPass[] = [{
        id: '1', user_id: 'u1', cohort_id: 'c1',
        status: 'active',
        access_starts_at: farPast.toISOString(),
        access_ends_at: pastDate.toISOString(),
        purchased_at: farPast.toISOString(),
      }];
      expect(hasActivePass(passes)).toBe(false);
    });

    it('returns false when no passes', () => {
      expect(hasActivePass([])).toBe(false);
    });
  });

  describe('isFeatureLocked', () => {
    it('returns false when user has active pass', () => {
      expect(isFeatureLocked('coach', 10, true)).toBe(false);
    });

    it('returns false when under free limit', () => {
      expect(isFeatureLocked('coach', 2, false)).toBe(false);
    });

    it('returns true when at free limit without pass', () => {
      expect(isFeatureLocked('coach', FREE_LIMITS.coach, false)).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npx vitest run src/services/__tests__/passService.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write passService.ts**

```typescript
import { supabase } from '../lib/supabaseClient';

export interface UserPass {
  id: string;
  user_id: string;
  cohort_id: string;
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
  purchased_at: string;
  access_starts_at: string;
  access_ends_at: string;
  status: 'active' | 'expired' | 'refunded';
}

export interface UsageCount {
  feature: 'coach' | 'validator' | 'taste';
  count: number;
}

export interface Cohort {
  id: string;
  name: string;
  enrollment_opens_at: string;
  enrollment_closes_at: string;
  cohort_starts_at: string;
  cohort_ends_at: string;
  price_cents: number;
  stripe_price_id: string | null;
  max_seats: number | null;
  is_active: boolean;
}

export const FREE_LIMITS = {
  coach: 3,
  validator: 2,
  taste: 5,
} as const;

export type FeatureKey = keyof typeof FREE_LIMITS;

export function hasActivePass(passes: UserPass[]): boolean {
  const now = new Date();
  return passes.some(
    p => p.status === 'active'
      && new Date(p.access_starts_at) <= now
      && new Date(p.access_ends_at) > now,
  );
}

export function isFeatureLocked(feature: FeatureKey, usageCount: number, hasPaidPass: boolean): boolean {
  if (hasPaidPass) return false;
  return usageCount >= FREE_LIMITS[feature];
}

export function daysRemaining(passes: UserPass[]): number | null {
  const now = new Date();
  const active = passes.find(
    p => p.status === 'active'
      && new Date(p.access_starts_at) <= now
      && new Date(p.access_ends_at) > now,
  );
  if (!active) return null;
  const msRemaining = new Date(active.access_ends_at).getTime() - now.getTime();
  return Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
}

export async function fetchUserPasses(): Promise<UserPass[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('user_passes')
    .select('*')
    .order('purchased_at', { ascending: false });
  if (error) { console.error('[HEQ] fetchUserPasses error:', error.message); return []; }
  return data ?? [];
}

export async function fetchUsageCounts(): Promise<UsageCount[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('usage_counts')
    .select('feature, count');
  if (error) { console.error('[HEQ] fetchUsageCounts error:', error.message); return []; }
  return data ?? [];
}

export async function fetchOpenCohort(): Promise<Cohort | null> {
  if (!supabase) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('cohorts')
    .select('*')
    .eq('is_active', true)
    .lte('enrollment_opens_at', now)
    .gte('enrollment_closes_at', now)
    .limit(1)
    .single();
  if (error || !data) return null;
  return data;
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npx vitest run src/services/__tests__/passService.test.ts
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/passService.ts src/services/__tests__/passService.test.ts
git commit -m "feat(pass): add pass service with free-tier gating logic"
```

---

## Task 7: Pass Context — React Provider for Pass State

**Files:**
- Create: `src/context/PassContext.tsx`

- [ ] **Step 1: Create PassContext**

```typescript
import {
  createContext, useContext, useEffect, useState, useCallback, type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  fetchUserPasses, fetchUsageCounts, fetchOpenCohort,
  hasActivePass, isFeatureLocked, daysRemaining,
  type UserPass, type UsageCount, type Cohort, type FeatureKey, FREE_LIMITS,
} from '../services/passService';

interface PassContextType {
  passes: UserPass[];
  usageCounts: Record<FeatureKey, number>;
  openCohort: Cohort | null;
  hasPaidPass: boolean;
  daysLeft: number | null;
  isLocked: (feature: FeatureKey) => boolean;
  getUsage: (feature: FeatureKey) => { used: number; limit: number };
  refresh: () => Promise<void>;
  loading: boolean;
}

const PassContext = createContext<PassContextType | undefined>(undefined);

export function PassProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [passes, setPasses] = useState<UserPass[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<FeatureKey, number>>({ coach: 0, validator: 0, taste: 0 });
  const [openCohort, setOpenCohort] = useState<Cohort | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setPasses([]);
      setUsageCounts({ coach: 0, validator: 0, taste: 0 });
      setOpenCohort(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [passData, usageData, cohort] = await Promise.all([
      fetchUserPasses(),
      fetchUsageCounts(),
      fetchOpenCohort(),
    ]);
    setPasses(passData);
    const counts: Record<FeatureKey, number> = { coach: 0, validator: 0, taste: 0 };
    usageData.forEach(u => {
      if (u.feature in counts) counts[u.feature as FeatureKey] = u.count;
    });
    setUsageCounts(counts);
    setOpenCohort(cohort);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const hasPaidPass = hasActivePass(passes);
  const daysLeft = daysRemaining(passes);

  const isLocked = useCallback(
    (feature: FeatureKey) => isFeatureLocked(feature, usageCounts[feature], hasPaidPass),
    [usageCounts, hasPaidPass],
  );

  const getUsage = useCallback(
    (feature: FeatureKey) => ({ used: usageCounts[feature], limit: FREE_LIMITS[feature] }),
    [usageCounts],
  );

  return (
    <PassContext.Provider value={{
      passes, usageCounts, openCohort,
      hasPaidPass, daysLeft,
      isLocked, getUsage, refresh, loading,
    }}>
      {children}
    </PassContext.Provider>
  );
}

export function usePass(): PassContextType {
  const ctx = useContext(PassContext);
  if (!ctx) throw new Error('usePass must be used within PassProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/context/PassContext.tsx
git commit -m "feat(pass): add PassContext provider for pass state and usage gating"
```

---

## Task 8: PaywallPrompt Component

**Files:**
- Create: `src/components/common/PaywallPrompt.tsx`

- [ ] **Step 1: Create PaywallPrompt**

```typescript
import { motion } from 'motion/react';
import { Lock } from 'lucide-react';
import Button from './Button';
import Card from './Card';
import { usePass } from '../../context/PassContext';
import type { FeatureKey } from '../../services/passService';

const FEATURE_LABELS: Record<FeatureKey, string> = {
  coach: 'coach sessions',
  validator: 'Idea Validator sessions',
  taste: 'Product Taste exercises',
};

interface PaywallPromptProps {
  feature: FeatureKey;
  onUpgrade: () => void;
}

export default function PaywallPrompt({ feature, onUpgrade }: PaywallPromptProps) {
  const { getUsage, openCohort } = usePass();
  const { limit } = getUsage(feature);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '16px',
          backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 1.25rem',
        }}>
          <Lock size={24} color="#F59E0B" />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', margin: '0 0 0.5rem' }}>
          You've used all {limit} free {FEATURE_LABELS[feature]}
        </h3>

        {openCohort ? (
          <>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              Join <strong>{openCohort.name}</strong> for unlimited access to all features.
              <br />
              ${(openCohort.price_cents / 100).toFixed(0)} for{' '}
              {Math.round((new Date(openCohort.cohort_ends_at).getTime() - new Date(openCohort.cohort_starts_at).getTime()) / (1000 * 60 * 60 * 24 * 7))}{' '}
              weeks of full access.
            </p>
            <Button onClick={onUpgrade} size="lg">
              Join Cohort
            </Button>
          </>
        ) : (
          <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0', lineHeight: 1.6 }}>
            No cohort is currently open for enrollment.
            <br />
            Check back soon for the next cohort!
          </p>
        )}
      </Card>
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/PaywallPrompt.tsx
git commit -m "feat(paywall): add PaywallPrompt component for free-tier upgrade"
```

---

## Task 9: PassStatusBadge Component

**Files:**
- Create: `src/components/common/PassStatusBadge.tsx`

- [ ] **Step 1: Create PassStatusBadge**

```typescript
import { Shield, Clock } from 'lucide-react';
import Card from './Card';
import { usePass } from '../../context/PassContext';

export default function PassStatusBadge() {
  const { hasPaidPass, daysLeft, passes } = usePass();

  if (!hasPaidPass && passes.length === 0) return null;

  const activeCohortName = passes.find(p => p.status === 'active')?.cohort_id;
  const isExpiringSoon = daysLeft !== null && daysLeft <= 7;

  return (
    <Card style={{
      padding: '1rem 1.25rem',
      borderLeft: `4px solid ${hasPaidPass ? '#10B981' : '#F59E0B'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          backgroundColor: hasPaidPass ? '#ECFDF5' : '#FEF3C7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {hasPaidPass
            ? <Shield size={18} color="#10B981" />
            : <Clock size={18} color="#F59E0B" />
          }
        </div>
        <div>
          <p style={{
            fontSize: '0.875rem', fontWeight: 600, margin: 0,
            color: hasPaidPass ? '#065F46' : '#92400E',
          }}>
            {hasPaidPass
              ? `Active Pass — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
              : 'Pass Expired'
            }
          </p>
          {isExpiringSoon && hasPaidPass && (
            <p style={{ fontSize: '0.75rem', color: '#F59E0B', margin: '0.125rem 0 0' }}>
              Your access expires soon
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/PassStatusBadge.tsx
git commit -m "feat(pass): add PassStatusBadge component for account page"
```

---

## Task 10: Stripe Checkout API Route

**Files:**
- Create: `api/create-checkout-session.ts`

- [ ] **Step 1: Create the checkout session endpoint**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
    res.status(503).json({ error: 'Payment service not configured.' });
    return;
  }

  // Verify auth via Supabase JWT
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

  if (authError || !user) {
    res.status(401).json({ error: 'Invalid or expired session.' });
    return;
  }

  const { cohort_id } = req.body as { cohort_id?: string };
  if (!cohort_id) {
    res.status(400).json({ error: 'cohort_id is required.' });
    return;
  }

  // Check cohort exists and is open
  const { data: cohort, error: cohortError } = await supabase
    .from('cohorts')
    .select('*')
    .eq('id', cohort_id)
    .eq('is_active', true)
    .single();

  if (cohortError || !cohort) {
    res.status(404).json({ error: 'Cohort not found or enrollment closed.' });
    return;
  }

  const now = new Date();
  if (now < new Date(cohort.enrollment_opens_at) || now > new Date(cohort.enrollment_closes_at)) {
    res.status(400).json({ error: 'Enrollment window is not open.' });
    return;
  }

  // Check if user already has an active pass
  const { data: existingPasses } = await supabase
    .from('user_passes')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gte('access_ends_at', now.toISOString())
    .limit(1);

  if (existingPasses && existingPasses.length > 0) {
    res.status(400).json({ error: 'You already have an active pass.' });
    return;
  }

  // Check seat availability
  if (cohort.max_seats !== null) {
    const { count } = await supabase
      .from('user_passes')
      .select('*', { count: 'exact', head: true })
      .eq('cohort_id', cohort_id)
      .in('status', ['active']);

    if (count !== null && count >= cohort.max_seats) {
      res.status(400).json({ error: 'This cohort is sold out.' });
      return;
    }
  }

  const stripe = new Stripe(stripeKey);

  const origin = req.headers.origin || 'https://hello-eq.com';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price: cohort.stripe_price_id,
      quantity: 1,
    }],
    metadata: {
      user_id: user.id,
      cohort_id: cohort.id,
    },
    customer_email: user.email,
    success_url: `${origin}/account?purchase=success`,
    cancel_url: `${origin}/account?purchase=cancelled`,
  });

  res.status(200).json({ url: session.url });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/create-checkout-session.ts
git commit -m "feat(stripe): add create-checkout-session API route"
```

---

## Task 11: Stripe Webhook API Route

**Files:**
- Create: `api/stripe-webhook.ts`

- [ ] **Step 1: Create the webhook handler**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Vercel provides the raw body as a Buffer when we disable body parsing.
export const config = { api: { bodyParser: false } };

function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    res.status(503).json({ error: 'Webhook not configured.' });
    return;
  }

  const stripe = new Stripe(stripeKey);
  const rawBody = await readRawBody(req);
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    console.error('[HEQ] Stripe webhook signature verification failed:', message);
    res.status(400).json({ error: 'Invalid signature.' });
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const cohortId = session.metadata?.cohort_id;

    if (!userId || !cohortId) {
      console.error('[HEQ] Stripe webhook: missing metadata', { userId, cohortId });
      res.status(400).json({ error: 'Missing metadata.' });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch cohort dates
    const { data: cohort } = await supabase
      .from('cohorts')
      .select('cohort_starts_at, cohort_ends_at')
      .eq('id', cohortId)
      .single();

    if (!cohort) {
      console.error('[HEQ] Stripe webhook: cohort not found', cohortId);
      res.status(400).json({ error: 'Cohort not found.' });
      return;
    }

    // Create the pass
    const { error: insertError } = await supabase
      .from('user_passes')
      .insert({
        user_id: userId,
        cohort_id: cohortId,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
        access_starts_at: cohort.cohort_starts_at,
        access_ends_at: cohort.cohort_ends_at,
        status: 'active',
      });

    if (insertError) {
      console.error('[HEQ] Stripe webhook: insert error', insertError.message);
      res.status(500).json({ error: 'Failed to create pass.' });
      return;
    }

    console.log(JSON.stringify({
      event: 'pass_created',
      user_id: userId,
      cohort_id: cohortId,
      checkout_session_id: session.id,
    }));
  }

  res.status(200).json({ received: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/stripe-webhook.ts
git commit -m "feat(stripe): add stripe-webhook handler for checkout.session.completed"
```

---

## Task 12: Usage Increment API Route

**Files:**
- Create: `api/usage-increment.ts`

- [ ] **Step 1: Create the usage increment endpoint**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(503).json({ error: 'Service not configured.' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

  if (authError || !user) {
    res.status(401).json({ error: 'Invalid session.' });
    return;
  }

  const { feature } = req.body as { feature?: string };
  if (!feature || !['coach', 'validator', 'taste'].includes(feature)) {
    res.status(400).json({ error: 'feature must be "coach", "validator", or "taste".' });
    return;
  }

  // Check for active pass — if they have one, still increment but don't gate
  const { data: newCount, error: rpcError } = await supabase
    .rpc('increment_usage', { p_user_id: user.id, p_feature: feature });

  if (rpcError) {
    console.error('[HEQ] usage-increment error:', rpcError.message);
    res.status(500).json({ error: 'Failed to increment usage.' });
    return;
  }

  res.status(200).json({ count: newCount });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/usage-increment.ts
git commit -m "feat(usage): add usage-increment API route with auth"
```

---

## Task 13: Update Existing API Routes — Add Auth + Usage Gating

**Files:**
- Modify: `api/claude.ts`
- Modify: `api/validator.ts`
- Modify: `api/evaluate-taste.ts`

- [ ] **Step 1: Read api/evaluate-taste.ts**

Read the current file to understand its structure before modifying.

- [ ] **Step 2: Update api/claude.ts — add auth header passthrough and usage increment**

At the top of the `handler` function in `api/claude.ts`, after the rate limit check (line 59), add the usage increment call. The coach feature should increment usage server-side. Add this import at the top:

```typescript
import { createClient } from '@supabase/supabase-js';
```

After the rate limit check block and before `const startMs = Date.now();`, add:

```typescript
  // ── Usage tracking (non-blocking) ──────────────────────────────────────────
  const authHeader = req.headers.authorization as string | undefined;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (authHeader?.startsWith('Bearer ') && supabaseUrl && serviceKey) {
    const sb = createClient(supabaseUrl, serviceKey);
    const { data: { user } } = await sb.auth.getUser(authHeader.replace('Bearer ', ''));
    if (user) {
      // Fire-and-forget — don't block the AI response on usage tracking
      sb.rpc('increment_usage', { p_user_id: user.id, p_feature: 'coach' }).catch(() => {});
    }
  }
```

- [ ] **Step 3: Update api/validator.ts — add usage increment**

Same pattern: add `import { createClient } from '@supabase/supabase-js';` at the top. In the handler, after body parsing and before the `op` switch, add the usage increment block with `p_feature: 'validator'`.

- [ ] **Step 4: Update api/evaluate-taste.ts — add usage increment**

Same pattern with `p_feature: 'taste'`.

- [ ] **Step 5: Run typecheck**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add api/claude.ts api/validator.ts api/evaluate-taste.ts
git commit -m "feat(usage): add server-side usage tracking to AI API routes"
```

---

## Task 14: Client-Side Auth Token in API Calls

**Files:**
- Modify: `src/services/claudeApi.ts`

- [ ] **Step 1: Update claudeApi.ts to send auth token**

Add auth token to the fetch headers. Import supabase at the top:

```typescript
import { supabase } from '../lib/supabaseClient';
```

Create a helper function at the top of the file (after imports):

```typescript
async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  }
  return headers;
}
```

Then update `callClaude` and `callClaudeMessages` to use `await getAuthHeaders()` instead of the hardcoded `{ 'Content-Type': 'application/json' }` headers.

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/services/claudeApi.ts
git commit -m "feat(auth): send auth token with Claude API calls for usage tracking"
```

---

## Task 15: SignInPage — Add Google + Magic Link

**Files:**
- Modify: `src/pages/SignInPage.tsx`

- [ ] **Step 1: Rewrite SignInPage with three auth methods**

Replace the full file with:

```typescript
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

          {/* Google Sign-In Button */}
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

          {/* Magic Link Form */}
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
            /* Email/Password Form */
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

          {/* Mode switchers */}
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
```

Note: The "Continue as guest" option is removed — auth is now mandatory.

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/SignInPage.tsx
git commit -m "feat(auth): redesign SignInPage with Google OAuth, magic link, email/password"
```

---

## Task 16: Update App.tsx — RequireAuth + PassProvider + Admin Route

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update App.tsx**

```typescript
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { PassProvider } from './context/PassContext';
import RequireAuth from './components/common/RequireAuth';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import InsightsPage from './pages/InsightsPage';
import GrowthPage from './pages/GrowthPage';
import AccountPage from './pages/AccountPage';
import ProductTastePage from './pages/ProductTastePage';
import TransparencyHubPage from './pages/TransparencyHubPage';
import InfluencePage from './pages/InfluencePage';
import SignalsPage from './pages/SignalsPage';
import ActionsPage from './pages/ActionsPage';
import { Analytics } from '@vercel/analytics/react';

const UsageDashboardPage  = lazy(() => import('./pages/UsageDashboardPage'));
const SignInPage          = lazy(() => import('./pages/SignInPage'));
const UnauthorizedPage    = lazy(() => import('./pages/UnauthorizedPage'));
const PublicProfilePage   = lazy(() => import('./pages/PublicProfilePage'));
const ValidatorIndexPage   = lazy(() => import('./pages/ValidatorIndexPage'));
const ValidatorNewPage     = lazy(() => import('./pages/ValidatorNewPage'));
const ValidatorSessionPage = lazy(() => import('./pages/ValidatorSessionPage'));
const AdminPage            = lazy(() => import('./pages/AdminPage'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <AppProvider>
      <PassProvider>
        <Routes>
          {/* ── Public routes — no auth required ── */}
          <Route path="/auth/signin" element={<Suspense fallback={null}><SignInPage /></Suspense>} />
          <Route path="/unauthorized" element={<Suspense fallback={null}><UnauthorizedPage /></Suspense>} />
          <Route path="/p/:slug" element={<Suspense fallback={null}><PublicProfilePage /></Suspense>} />

          {/* ── Protected routes — auth required ── */}
          <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
          <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
          <Route path="/product" element={<RequireAuth><ProductTastePage /></RequireAuth>} />
          <Route path="/insights" element={<RequireAuth><InsightsPage /></RequireAuth>} />
          <Route path="/growth" element={<RequireAuth><GrowthPage /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
          <Route path="/transparency" element={<RequireAuth><TransparencyHubPage /></RequireAuth>} />
          <Route path="/influence" element={<RequireAuth><InfluencePage /></RequireAuth>} />
          <Route path="/signals" element={<RequireAuth><SignalsPage /></RequireAuth>} />
          <Route path="/actions" element={<RequireAuth><ActionsPage /></RequireAuth>} />

          {/* ── Idea Validator (auth required) ── */}
          <Route path="/validator" element={<RequireAuth><Suspense fallback={null}><ValidatorIndexPage /></Suspense></RequireAuth>} />
          <Route path="/validator/new" element={<RequireAuth><Suspense fallback={null}><ValidatorNewPage /></Suspense></RequireAuth>} />
          <Route path="/validator/:sessionId" element={<RequireAuth><Suspense fallback={null}><ValidatorSessionPage /></Suspense></RequireAuth>} />

          {/* ── Admin (auth + admin email required) ── */}
          <Route path="/admin" element={<RequireAuth><Suspense fallback={null}><AdminPage /></Suspense></RequireAuth>} />

          {/* ── Usage dashboard ── */}
          <Route path="/dashboard" element={<RequireAuth><Suspense fallback={null}><UsageDashboardPage /></Suspense></RequireAuth>} />

          {/* Legacy redirects */}
          <Route path="/timeline" element={<Navigate to="/insights" replace />} />
          <Route path="/goals" element={<Navigate to="/growth" replace />} />
          <Route path="/profile" element={<Navigate to="/account" replace />} />
          <Route path="/settings" element={<Navigate to="/account" replace />} />
          <Route path="/add-emotion" element={<Navigate to="/" replace />} />
          <Route path="/add-event" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PassProvider>
      </AppProvider>
      </AuthProvider>
      <Analytics />
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npm run typecheck
```

Note: This will fail until AdminPage.tsx exists. Create a stub first if needed:

```typescript
// src/pages/AdminPage.tsx (stub)
export default function AdminPage() {
  return <div>Admin — coming soon</div>;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/pages/AdminPage.tsx
git commit -m "feat(app): wrap routes in RequireAuth + PassProvider, add admin route"
```

---

## Task 17: PostHog Integration

**Files:**
- Create: `src/lib/posthog.ts`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create PostHog initialization module**

```typescript
import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

export const isPostHogConfigured = Boolean(POSTHOG_KEY);

if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST || 'https://us.i.posthog.com',
    autocapture: false,
    capture_pageview: true,
    persistence: 'localStorage',
  });
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!isPostHogConfigured) return;
  posthog.identify(userId, properties);
}

export function resetUser() {
  if (!isPostHogConfigured) return;
  posthog.reset();
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!isPostHogConfigured) return;
  posthog.capture(event, properties);
}
```

- [ ] **Step 2: Update main.tsx to import PostHog**

Add this import at the top of `src/main.tsx` (after the CSS import):

```typescript
import './lib/posthog';
```

- [ ] **Step 3: Add PostHog identify/reset calls to AuthContext**

In `src/context/AuthContext.tsx`, add at the top:

```typescript
import { identifyUser, resetUser } from '../lib/posthog';
```

In the `useEffect` that handles `onAuthStateChange`, add PostHog calls:

```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
  setSession(newSession);
  if (newSession?.user) {
    identifyUser(newSession.user.id, { email: newSession.user.email });
  } else {
    resetUser();
  }
});
```

- [ ] **Step 4: Run typecheck**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/posthog.ts src/main.tsx src/context/AuthContext.tsx
git commit -m "feat(analytics): integrate PostHog with user identification"
```

---

## Task 18: Add PostHog Event Tracking to Key Flows

**Files:**
- Modify: `src/pages/HomePage.tsx` (coach session tracking)
- Modify: `src/pages/ProductTastePage.tsx` (taste exercise tracking)
- Modify: `src/pages/ValidatorNewPage.tsx` (validator session tracking)
- Modify: `src/components/common/PaywallPrompt.tsx` (paywall tracking)

- [ ] **Step 1: Add tracking events**

In each file, import `trackEvent`:

```typescript
import { trackEvent } from '../lib/posthog';
```

Then add `trackEvent()` calls at key points:

**HomePage.tsx** — when coach session starts:
```typescript
trackEvent('coach_session_started', { is_paid: hasPaidPass, usage_count: usageCounts.coach });
```

**ProductTastePage.tsx** — when taste exercise starts:
```typescript
trackEvent('taste_exercise_started', { is_paid: hasPaidPass, usage_count: usageCounts.taste });
```

**ValidatorNewPage.tsx** — when validator session starts:
```typescript
trackEvent('validator_session_started', { is_paid: hasPaidPass, usage_count: usageCounts.validator });
```

**PaywallPrompt.tsx** — when paywall is shown and when checkout is clicked:
```typescript
// On mount:
trackEvent('paywall_shown', { feature, cohort_id: openCohort?.id });

// On upgrade click:
trackEvent('checkout_started', { cohort_id: openCohort?.id, price: openCohort?.price_cents });
```

Note: The exact line numbers for inserting these calls depend on reading the current files. The implementer should find the appropriate location in each file's event handler.

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/HomePage.tsx src/pages/ProductTastePage.tsx src/pages/ValidatorNewPage.tsx src/components/common/PaywallPrompt.tsx
git commit -m "feat(analytics): add PostHog event tracking to key user flows"
```

---

## Task 19: Update AccountPage — Add Pass Status + Upgrade

**Files:**
- Modify: `src/pages/AccountPage.tsx`

- [ ] **Step 1: Add pass status section to AccountPage**

At the top of the `AccountPage` component, add imports and hooks:

```typescript
import PassStatusBadge from '../components/common/PassStatusBadge';
import PaywallPrompt from '../components/common/PaywallPrompt';
import { usePass } from '../context/PassContext';
import { supabase } from '../lib/supabaseClient';
```

Inside the component:

```typescript
const { hasPaidPass, openCohort } = usePass();
const [purchaseLoading, setPurchaseLoading] = useState(false);
const [searchParams] = useSearchParams();
const purchaseStatus = searchParams.get('purchase');

const handleUpgrade = async () => {
  if (!openCohort || !supabase) return;
  setPurchaseLoading(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ cohort_id: openCohort.id }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  } finally {
    setPurchaseLoading(false);
  }
};
```

Add `useSearchParams` to the imports from `react-router`.

In the Profile tab section (after the Basic Info Card), add:

```tsx
{/* Pass Status */}
<PassStatusBadge />

{/* Purchase success/cancel messages */}
{purchaseStatus === 'success' && (
  <Card style={{ borderLeft: '4px solid #10B981', padding: '1rem 1.25rem' }}>
    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#065F46', margin: 0 }}>
      Purchase successful! Your access is now active.
    </p>
  </Card>
)}
{purchaseStatus === 'cancelled' && (
  <Card style={{ borderLeft: '4px solid #F59E0B', padding: '1rem 1.25rem' }}>
    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#92400E', margin: 0 }}>
      Purchase cancelled. You can try again anytime.
    </p>
  </Card>
)}

{/* Upgrade button for free users */}
{!hasPaidPass && openCohort && (
  <Card>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
          Upgrade to {openCohort.name}
        </h3>
        <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.25rem 0 0' }}>
          ${(openCohort.price_cents / 100).toFixed(0)} for full access
        </p>
      </div>
      <Button size="sm" onClick={handleUpgrade} disabled={purchaseLoading}>
        {purchaseLoading ? 'Loading...' : 'Upgrade'}
      </Button>
    </div>
  </Card>
)}
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/AccountPage.tsx
git commit -m "feat(account): add pass status, upgrade button, and purchase feedback"
```

---

## Task 20: Admin Dashboard — Full Implementation

**Files:**
- Create: `src/pages/AdminPage.tsx` (replace stub)
- Create: `src/services/adminService.ts`

- [ ] **Step 1: Create admin service**

```typescript
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { Cohort } from './passService';

export interface AdminCohort extends Cohort {
  enrolled_count?: number;
}

export interface EnrolledUser {
  user_id: string;
  email: string;
  purchased_at: string;
  coach_usage: number;
  validator_usage: number;
  taste_usage: number;
}

export async function fetchAllCohorts(): Promise<AdminCohort[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('cohorts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('[HEQ] fetchAllCohorts:', error.message); return []; }
  return data ?? [];
}

export async function createCohort(cohort: {
  name: string;
  enrollment_opens_at: string;
  enrollment_closes_at: string;
  cohort_starts_at: string;
  cohort_ends_at: string;
  price_cents: number;
  max_seats: number | null;
}): Promise<AdminCohort | null> {
  if (!supabase) return null;

  // Create Stripe Price via our API
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const priceRes = await fetch('/api/admin/create-stripe-price', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ price_cents: cohort.price_cents, cohort_name: cohort.name }),
  });

  let stripePriceId: string | null = null;
  if (priceRes.ok) {
    const priceData = await priceRes.json();
    stripePriceId = priceData.price_id;
  }

  const { data, error } = await supabase
    .from('cohorts')
    .insert({
      ...cohort,
      stripe_price_id: stripePriceId,
      is_active: true,
    })
    .select()
    .single();

  if (error) { console.error('[HEQ] createCohort:', error.message); return null; }
  return data;
}

export async function updateCohort(id: string, updates: Partial<AdminCohort>): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('cohorts')
    .update(updates)
    .eq('id', id);
  if (error) { console.error('[HEQ] updateCohort:', error.message); return false; }
  return true;
}

export async function fetchCohortUsers(cohortId: string): Promise<EnrolledUser[]> {
  if (!supabase) return [];
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  const res = await fetch(`/api/admin/cohort-users?cohort_id=${cohortId}`, {
    headers: { 'Authorization': `Bearer ${session.access_token}` },
  });
  if (!res.ok) return [];
  return res.json();
}
```

- [ ] **Step 2: Create admin API route for Stripe price creation**

Create `api/admin/create-stripe-price.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = (process.env.VITE_ALLOWED_ADMIN_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeKey || !supabaseUrl || !serviceKey) { res.status(503).json({ error: 'Not configured.' }); return; }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'Auth required.' }); return; }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }

  const { price_cents, cohort_name } = req.body as { price_cents: number; cohort_name: string };
  const stripe = new Stripe(stripeKey);

  // Find or create the product
  const products = await stripe.products.list({ limit: 1, active: true });
  let productId: string;
  if (products.data.length > 0) {
    productId = products.data[0].id;
  } else {
    const product = await stripe.products.create({ name: 'Hello-EQ Cohort Access' });
    productId = product.id;
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: price_cents,
    currency: 'usd',
    metadata: { cohort_name },
  });

  res.status(200).json({ price_id: price.id });
}
```

- [ ] **Step 3: Create admin API route for cohort users**

Create `api/admin/cohort-users.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = (process.env.VITE_ALLOWED_ADMIN_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) { res.status(503).json({ error: 'Not configured.' }); return; }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'Auth required.' }); return; }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }

  const cohortId = req.query.cohort_id as string;
  if (!cohortId) { res.status(400).json({ error: 'cohort_id required.' }); return; }

  // Get passes for this cohort
  const { data: passes } = await supabase
    .from('user_passes')
    .select('user_id, purchased_at')
    .eq('cohort_id', cohortId);

  if (!passes || passes.length === 0) { res.status(200).json([]); return; }

  const userIds = passes.map(p => p.user_id);

  // Get user emails from auth
  const users: Array<{ user_id: string; email: string; purchased_at: string; coach_usage: number; validator_usage: number; taste_usage: number }> = [];

  for (const pass of passes) {
    const { data: { user: authUser } } = await supabase.auth.admin.getUserById(pass.user_id);

    // Get usage counts
    const { data: usage } = await supabase
      .from('usage_counts')
      .select('feature, count')
      .eq('user_id', pass.user_id);

    const counts = { coach: 0, validator: 0, taste: 0 };
    usage?.forEach(u => {
      if (u.feature in counts) counts[u.feature as keyof typeof counts] = u.count;
    });

    users.push({
      user_id: pass.user_id,
      email: authUser?.email ?? 'unknown',
      purchased_at: pass.purchased_at,
      coach_usage: counts.coach,
      validator_usage: counts.validator,
      taste_usage: counts.taste,
    });
  }

  res.status(200).json(users);
}
```

- [ ] **Step 4: Create AdminPage.tsx**

Replace the stub `src/pages/AdminPage.tsx` with the full implementation:

```typescript
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { fetchAllCohorts, createCohort, updateCohort, fetchCohortUsers, type AdminCohort, type EnrolledUser } from '../services/adminService';
import { Users, Calendar, DollarSign, Plus, ChevronDown, ChevronUp, Download } from 'lucide-react';

export default function AdminPage() {
  const { isAdmin, authReady } = useAuth();
  const [cohorts, setCohorts] = useState<AdminCohort[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedCohort, setExpandedCohort] = useState<string | null>(null);
  const [cohortUsers, setCohortUsers] = useState<Record<string, EnrolledUser[]>>({});
  const [loading, setLoading] = useState(true);

  // Create form state
  const [form, setForm] = useState({
    name: '',
    enrollment_opens_at: '',
    enrollment_closes_at: '',
    cohort_starts_at: '',
    cohort_ends_at: '',
    price_cents: 7900,
    max_seats: '',
  });

  useEffect(() => {
    loadCohorts();
  }, []);

  async function loadCohorts() {
    setLoading(true);
    const data = await fetchAllCohorts();
    setCohorts(data);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const cohort = await createCohort({
      name: form.name,
      enrollment_opens_at: new Date(form.enrollment_opens_at).toISOString(),
      enrollment_closes_at: new Date(form.enrollment_closes_at).toISOString(),
      cohort_starts_at: new Date(form.cohort_starts_at).toISOString(),
      cohort_ends_at: new Date(form.cohort_ends_at).toISOString(),
      price_cents: form.price_cents,
      max_seats: form.max_seats ? parseInt(form.max_seats) : null,
    });
    if (cohort) {
      setCohorts(prev => [cohort, ...prev]);
      setShowCreateForm(false);
      setForm({ name: '', enrollment_opens_at: '', enrollment_closes_at: '', cohort_starts_at: '', cohort_ends_at: '', price_cents: 7900, max_seats: '' });
    }
  }

  async function handleToggleActive(cohort: AdminCohort) {
    const success = await updateCohort(cohort.id, { is_active: !cohort.is_active });
    if (success) loadCohorts();
  }

  async function handleExpandCohort(cohortId: string) {
    if (expandedCohort === cohortId) {
      setExpandedCohort(null);
      return;
    }
    setExpandedCohort(cohortId);
    if (!cohortUsers[cohortId]) {
      const users = await fetchCohortUsers(cohortId);
      setCohortUsers(prev => ({ ...prev, [cohortId]: users }));
    }
  }

  function exportCSV(cohortId: string) {
    const users = cohortUsers[cohortId];
    if (!users) return;
    const header = 'Email,Purchased At,Coach Usage,Validator Usage,Taste Usage\n';
    const rows = users.map(u =>
      `${u.email},${u.purchased_at},${u.coach_usage},${u.validator_usage},${u.taste_usage}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cohort-${cohortId}-users.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authReady) return null;
  if (!isAdmin) return <Navigate to="/unauthorized" replace />;

  const now = new Date();

  return (
    <DashboardLayout>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Admin Dashboard</h1>
          <Button size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus size={16} /> New Cohort
          </Button>
        </div>

        {/* Create Cohort Form */}
        {showCreateForm && (
          <Card>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: '0 0 1rem' }}>Create New Cohort</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input label="Cohort Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Summer 2026 Cohort" required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Input label="Enrollment Opens" type="datetime-local" value={form.enrollment_opens_at} onChange={e => setForm({ ...form, enrollment_opens_at: e.target.value })} required />
                <Input label="Enrollment Closes" type="datetime-local" value={form.enrollment_closes_at} onChange={e => setForm({ ...form, enrollment_closes_at: e.target.value })} required />
                <Input label="Cohort Starts" type="datetime-local" value={form.cohort_starts_at} onChange={e => setForm({ ...form, cohort_starts_at: e.target.value })} required />
                <Input label="Cohort Ends" type="datetime-local" value={form.cohort_ends_at} onChange={e => setForm({ ...form, cohort_ends_at: e.target.value })} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Input label="Price (cents)" type="number" value={String(form.price_cents)} onChange={e => setForm({ ...form, price_cents: parseInt(e.target.value) || 0 })} required />
                <Input label="Max Seats (optional)" type="number" value={form.max_seats} onChange={e => setForm({ ...form, max_seats: e.target.value })} placeholder="Leave empty for unlimited" />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button variant="outline" type="button" onClick={() => setShowCreateForm(false)} style={{ flex: 1 }}>Cancel</Button>
                <Button type="submit" style={{ flex: 1 }}>Create Cohort</Button>
              </div>
            </form>
          </Card>
        )}

        {/* Cohort List */}
        {loading ? (
          <p style={{ color: '#6B7280', textAlign: 'center' }}>Loading cohorts...</p>
        ) : cohorts.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: '#6B7280' }}>No cohorts yet. Create your first one!</p>
          </Card>
        ) : (
          cohorts.map(cohort => {
            const isOpen = now >= new Date(cohort.enrollment_opens_at) && now <= new Date(cohort.enrollment_closes_at) && cohort.is_active;
            const isActive = now >= new Date(cohort.cohort_starts_at) && now <= new Date(cohort.cohort_ends_at);
            const isPast = now > new Date(cohort.cohort_ends_at);
            const isExpanded = expandedCohort === cohort.id;
            const users = cohortUsers[cohort.id] ?? [];

            return (
              <Card key={cohort.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>{cohort.name}</h3>
                      <span style={{
                        fontSize: '0.6875rem', fontWeight: 600, padding: '0.125rem 0.5rem', borderRadius: '999px',
                        backgroundColor: isOpen ? '#ECFDF5' : isPast ? '#F3F4F6' : isActive ? '#EFF6FF' : '#FEF3C7',
                        color: isOpen ? '#065F46' : isPast ? '#6B7280' : isActive ? '#1E40AF' : '#92400E',
                      }}>
                        {isOpen ? 'Enrolling' : isPast ? 'Ended' : isActive ? 'Active' : 'Upcoming'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.25rem 0 0' }}>
                      ${(cohort.price_cents / 100).toFixed(0)} &middot; {new Date(cohort.cohort_starts_at).toLocaleDateString()} — {new Date(cohort.cohort_ends_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button size="sm" variant={cohort.is_active ? 'outline' : 'primary'} onClick={() => handleToggleActive(cohort)}>
                      {cohort.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleExpandCohort(cohort.id)}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </Button>
                  </div>
                </div>

                {/* Summary stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: isExpanded ? '1rem' : 0 }}>
                  <div style={{ backgroundColor: '#F9FAFB', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                    <Calendar size={16} color="#6B7280" style={{ margin: '0 auto 0.25rem' }} />
                    <p style={{ fontSize: '0.6875rem', color: '#9CA3AF', margin: 0 }}>Enrollment</p>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937', margin: '0.125rem 0 0' }}>
                      {new Date(cohort.enrollment_opens_at).toLocaleDateString()} — {new Date(cohort.enrollment_closes_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ backgroundColor: '#F9FAFB', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                    <Users size={16} color="#6B7280" style={{ margin: '0 auto 0.25rem' }} />
                    <p style={{ fontSize: '0.6875rem', color: '#9CA3AF', margin: 0 }}>Seats</p>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937', margin: '0.125rem 0 0' }}>
                      {cohort.max_seats ? `${cohort.max_seats} max` : 'Unlimited'}
                    </p>
                  </div>
                  <div style={{ backgroundColor: '#F9FAFB', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                    <DollarSign size={16} color="#6B7280" style={{ margin: '0 auto 0.25rem' }} />
                    <p style={{ fontSize: '0.6875rem', color: '#9CA3AF', margin: 0 }}>Price</p>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937', margin: '0.125rem 0 0' }}>
                      ${(cohort.price_cents / 100).toFixed(0)}
                    </p>
                  </div>
                </div>

                {/* Enrolled Users (expanded) */}
                {isExpanded && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                        Enrolled Users ({users.length})
                      </h4>
                      {users.length > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => exportCSV(cohort.id)}>
                          <Download size={14} /> CSV
                        </Button>
                      )}
                    </div>
                    {users.length === 0 ? (
                      <p style={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>No enrolled users yet.</p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                              <th style={{ textAlign: 'left', padding: '0.5rem', color: '#6B7280', fontWeight: 600 }}>Email</th>
                              <th style={{ textAlign: 'left', padding: '0.5rem', color: '#6B7280', fontWeight: 600 }}>Purchased</th>
                              <th style={{ textAlign: 'center', padding: '0.5rem', color: '#6B7280', fontWeight: 600 }}>Coach</th>
                              <th style={{ textAlign: 'center', padding: '0.5rem', color: '#6B7280', fontWeight: 600 }}>Validator</th>
                              <th style={{ textAlign: 'center', padding: '0.5rem', color: '#6B7280', fontWeight: 600 }}>Taste</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.map(u => (
                              <tr key={u.user_id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                <td style={{ padding: '0.5rem', color: '#1F2937' }}>{u.email}</td>
                                <td style={{ padding: '0.5rem', color: '#6B7280' }}>{new Date(u.purchased_at).toLocaleDateString()}</td>
                                <td style={{ padding: '0.5rem', color: '#6B7280', textAlign: 'center' }}>{u.coach_usage}</td>
                                <td style={{ padding: '0.5rem', color: '#6B7280', textAlign: 'center' }}>{u.validator_usage}</td>
                                <td style={{ padding: '0.5rem', color: '#6B7280', textAlign: 'center' }}>{u.taste_usage}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </DashboardLayout>
  );
}
```

- [ ] **Step 5: Run typecheck**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminPage.tsx src/services/adminService.ts api/admin/create-stripe-price.ts api/admin/cohort-users.ts
git commit -m "feat(admin): add admin dashboard with cohort management and user listing"
```

---

## Task 21: Add Admin Link to Header

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add admin link to Header menu**

In `Header.tsx`, import `useAuth` is already imported. Destructure `isAdmin` from it:

```typescript
const { user: authUser, isAdmin } = useAuth();
```

In the hamburger menu's "More" section (after the Account link), add:

```tsx
{isAdmin && (
  <Link
    key="/admin"
    to="/admin"
    onClick={() => setMenuOpen(false)}
    style={{
      display: 'flex', alignItems: 'center', gap: '0.625rem',
      padding: '0.625rem 0.875rem', borderRadius: '8px',
      fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
      color: location.pathname === '/admin' ? '#7C3AED' : '#7C3AED',
      backgroundColor: location.pathname === '/admin' ? 'rgba(124,58,237,0.08)' : 'transparent',
    }}
    onMouseEnter={(e) => { if (location.pathname !== '/admin') e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.04)'; }}
    onMouseLeave={(e) => { if (location.pathname !== '/admin') e.currentTarget.style.backgroundColor = 'transparent'; }}
  >
    <Settings size={15} color="#7C3AED" /> Admin
  </Link>
)}
```

Import `Settings` is already imported in Header.tsx.

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(admin): add admin link to header menu for authorized users"
```

---

## Task 22: Vite Dev Middleware for New API Routes

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add dev middleware for checkout and usage-increment**

In `vite.config.ts`, add two new dev middleware plugins after the existing ones. These are simplified proxies for local development:

Add a `checkoutDevPlugin` function:

```typescript
function checkoutDevPlugin(stripeKey: string): Plugin {
  return {
    name: 'heq-checkout-dev',
    configureServer(server) {
      server.middlewares.use(
        '/api/create-checkout-session',
        async (req: IncomingMessage, res: ServerResponse) => {
          res.statusCode = 503
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Stripe checkout not available in dev. Use Vercel preview or production.' }))
        },
      )
    },
  }
}
```

Add a `usageIncrementDevPlugin` function that mirrors the production endpoint locally using the Supabase service role key from env.

Then register both plugins in the `plugins` array.

- [ ] **Step 2: Run dev server to verify no startup errors**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && timeout 10 npm run dev || true
```

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat(dev): add dev middleware stubs for checkout and usage-increment"
```

---

## Task 23: Configure Google OAuth in Supabase

This is a manual step — not code.

- [ ] **Step 1: Configure Google OAuth provider in Supabase Dashboard**

1. Go to Supabase Dashboard → Authentication → Providers → Google
2. Enable Google provider
3. Enter `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from your `.env`
4. Copy the callback URL shown in Supabase (e.g., `https://fygdmqaixqaxurtnavzv.supabase.co/auth/v1/callback`)
5. Go to Google Cloud Console → APIs & Services → Credentials → Your OAuth client
6. Add the Supabase callback URL to "Authorized redirect URIs"
7. Add your production URL (e.g., `https://hello-eq.com`) and `http://localhost:5173` to "Authorized JavaScript origins"

- [ ] **Step 2: Test Google sign-in locally**

Run `npm run dev`, go to `/auth/signin`, click "Continue with Google".

---

## Task 24: Configure Stripe

This is a manual step — not code.

- [ ] **Step 1: Create Stripe account and get keys**

1. Go to https://dashboard.stripe.com
2. Get your test keys: Publishable key (`pk_test_...`) and Secret key (`sk_test_...`)
3. Add to `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

- [ ] **Step 2: Set up webhook endpoint**

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-vercel-url.vercel.app/api/stripe-webhook`
3. Select event: `checkout.session.completed`
4. Copy the webhook signing secret (`whsec_...`)
5. Add to `.env`: `STRIPE_WEBHOOK_SECRET=whsec_...`

- [ ] **Step 3: Add all keys to Vercel environment variables**

Go to Vercel → Project Settings → Environment Variables and add all Stripe, PostHog, and admin email variables.

---

## Task 25: Create PostHog Project

This is a manual step — not code.

- [ ] **Step 1: Create PostHog account**

1. Go to https://posthog.com and create a free account
2. Create a new project
3. Copy the API key (`phc_...`)
4. Add to `.env`:
   ```
   VITE_POSTHOG_KEY=phc_...
   VITE_POSTHOG_HOST=https://us.i.posthog.com
   ```

---

## Task 26: End-to-End Testing

- [ ] **Step 1: Run typecheck**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npm run typecheck
```

- [ ] **Step 2: Run all tests**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npm test
```

- [ ] **Step 3: Run lint**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npm run lint
```

- [ ] **Step 4: Build**

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c && npm run build
```

- [ ] **Step 5: Manual test checklist**

1. Visit `/` — should redirect to `/auth/signin`
2. Sign in with email/password — should work
3. Sign in with Google — should redirect to Google and back
4. Sign in with magic link — should show "check inbox" message
5. Visit `/account` — should show pass status section
6. Visit `/admin` — should show admin dashboard (for admin emails only)
7. Visit `/admin` as non-admin — should redirect to `/unauthorized`
8. Create a cohort in admin — should appear in the list
9. Use coach 3 times — should show paywall on 4th attempt
10. Click "Join Cohort" — should redirect to Stripe Checkout (in test mode)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete auth, Stripe cohort payments, admin dashboard, and PostHog integration"
```
