# Hello-EQ Auth, Stripe & Cohorts — Demo Script

**Date:** 2026-05-23
**Branch:** `praveen/feature-first-plan-auth-stripe-cohort`
**Stats:** 37 files changed, 5,217 lines added

---

## What Was Built

1. **Mandatory Authentication** — Google OAuth, email/password, magic link (Supabase Auth)
2. **Cohort-Based Payments** — $79 / 8-week access pass via Stripe Checkout
3. **Free-Tier Gating** — 3 Coach, 2 Validator, 5 Taste exercises before paywall
4. **Admin Dashboard** — Cohort management, enrolled users, CSV export
5. **PostHog Analytics** — Event tracking across the full user funnel
6. **Usage Tracking** — Server-side, tamper-proof usage counting

---

## What You Can Demo Right Now

### Prerequisites

Start the dev server:

```bash
cd /Users/praveen/Downloads/Projects/ArunimaSharma/hei-c
git checkout praveen/feature-first-plan-auth-stripe-cohort
npm run dev
```

Open http://localhost:5173 in Chrome.

---

### Demo 1: Mandatory Auth Guard

**Story:** "Every user must now sign in. No more anonymous access."

1. Open http://localhost:5173 in an incognito window
2. You are immediately redirected to `/auth/signin`
3. Try navigating directly to http://localhost:5173/coach — redirected back to sign-in
4. Try http://localhost:5173/validator — same thing
5. **Key point:** The entire app is gated. No feature is accessible without authentication.

---

### Demo 2: Redesigned Sign-In Page

**Story:** "Three ways to sign in — Google (most prominent), email/password, and magic link."

1. On the sign-in page, show the layout:
   - Google OAuth button at the top (prominent, branded)
   - "or" divider
   - Email/password form below
   - "Sign in with magic link" option
   - Toggle between Sign In / Sign Up modes
2. **Sign up** with a test email (e.g., `testuser@example.com`) and password
3. After sign-up, you're redirected into the app
4. **Note for client:** Google OAuth requires one-time Supabase Dashboard configuration (5-minute setup). Magic link works once email templates are confirmed in Supabase.

---

### Demo 3: Admin Detection & Dashboard

**Story:** "Admins are detected by email. No role tables, no complex permissions."

1. Sign in with one of the admin emails (e.g., `arunima.productmanager@gmail.com`)
   - If this account doesn't exist yet, sign up with it first
2. Open the hamburger menu (top-right)
3. Show the **Admin** link that appears (only visible to admin emails)
4. Click it to open `/admin`
5. Walk through the Admin Dashboard:
   - **Summary cards** at the top (Total Users, Active Passes, etc. — will show 0s until Stripe is live)
   - **Create Cohort** form: name, enrollment dates, cohort start/end dates, price, max seats
   - **Cohort list** with status badges (upcoming, enrolling, active, ended)
   - Click a cohort row to expand and see enrolled users
   - **CSV Export** button for enrolled user data
6. Sign out and sign in as a non-admin email
7. Show that the Admin link is **not** in the menu
8. Navigate directly to http://localhost:5173/admin — redirected to `/unauthorized`

**Adding new admins:** Add the email to `VITE_ALLOWED_ADMIN_EMAILS` in Vercel env vars (comma-separated). Redeploy. No code changes needed.

---

### Demo 4: Free-Tier Usage Limits & Paywall

**Story:** "Free users get limited sessions. When they hit the limit, they see an upgrade prompt."

1. Sign in as a non-admin user
2. Use the Coach feature — note the subtle usage counter: "1 of 3 coach sessions used"
3. After 3 sessions, the Coach UI is replaced with the **Paywall Prompt**:
   - Shows which limit was hit
   - If a cohort is open: shows cohort name, dates, price, seats remaining, "Join Cohort" button
   - If no cohort is open: "No cohort currently available"
4. Same flow for Validator (limit: 2) and Taste exercises (limit: 5)

**Note:** Usage tracking is server-side and tamper-proof. The client displays counts but never writes them. Each API call (`/api/claude`, `/api/validator`, `/api/evaluate-taste`) increments the count on the server.

**Note for demo:** In dev mode, clicking "Join Cohort" returns a 503 (Stripe not available in dev). In production with Stripe configured, it redirects to Stripe's hosted checkout page.

---

### Demo 5: Account Page — Pass Status

**Story:** "Users can see their pass status, history, and upgrade options."

1. Navigate to the Account page
2. Show the new sections:
   - **Pass Status Badge** — shows "No active pass" for free users
   - For paid users (after Stripe is live): shows cohort name, days remaining, progress bar
   - Warning banner when < 7 days remaining
   - **Upgrade card** with "Join Cohort" button (when a cohort is open)
3. After a successful Stripe purchase (production), the URL includes `?purchase=success` and shows a confirmation message

---

### Demo 6: Code Architecture Walkthrough

**Story:** "Here's how it's built — clean, maintainable, production-ready."

Show these in the code editor:

| Layer | Key Files | Purpose |
|-------|-----------|---------|
| Auth | `src/context/AuthContext.tsx` | All 3 sign-in methods, admin detection |
| Gating | `src/context/PassContext.tsx` | Pass status, usage counts, locking logic |
| Route Guard | `src/components/common/RequireAuth.tsx` | Redirects unauthenticated users |
| Paywall | `src/components/common/PaywallPrompt.tsx` | Upgrade prompt with cohort info |
| Pass Badge | `src/components/common/PassStatusBadge.tsx` | Active/expired status display |
| Core Logic | `src/services/passService.ts` | Free limits, pass checking, pure functions |
| Stripe API | `api/create-checkout-session.ts` | Creates Stripe Checkout sessions |
| Webhook | `api/stripe-webhook.ts` | Handles payment confirmation |
| Usage | `api/usage-increment.ts` | Server-side usage counting |
| Admin APIs | `api/admin/*.ts` | Cohort CRUD, user lookup |
| Admin UI | `src/pages/AdminPage.tsx` | Full admin dashboard |
| Analytics | `src/lib/posthog.ts` | PostHog event tracking |
| DB Schema | `supabase/migrations/20260522_cohorts_passes_usage.sql` | 3 new tables with RLS |

---

## What Needs Configuration Before Go-Live

These are one-time setup steps. No code changes required.

### 1. Run Database Migration (5 min)

1. Go to Supabase Dashboard → SQL Editor
2. Paste contents of `supabase/migrations/20260522_cohorts_passes_usage.sql`
3. Click Run
4. This creates: `cohorts`, `user_passes`, `usage_counts` tables with RLS policies

### 2. Configure Google OAuth (10 min)

1. **Google Cloud Console:**
   - Go to APIs & Credentials → OAuth 2.0 Client IDs
   - Add authorized redirect URI: `https://fygdmqaixqaxurtnavzv.supabase.co/auth/v1/callback`
2. **Supabase Dashboard:**
   - Go to Authentication → Providers → Google
   - Enable Google provider
   - Paste `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (already in `.env`)
   - Save

### 3. Set Up Stripe (15 min)

1. Create Stripe account at https://stripe.com (or use existing)
2. Get test keys from Stripe Dashboard → Developers → API Keys:
   - `STRIPE_SECRET_KEY` (starts with `sk_test_`)
   - `VITE_STRIPE_PUBLISHABLE_KEY` (starts with `pk_test_`)
3. Set up webhook:
   - Stripe Dashboard → Developers → Webhooks → Add endpoint
   - URL: `https://your-vercel-domain.vercel.app/api/stripe-webhook`
   - Events: `checkout.session.completed`
   - Copy `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`)
4. Add all 3 keys to Vercel env vars

### 4. Set Up PostHog (5 min)

1. Create account at https://posthog.com (free tier is generous)
2. Get Project API Key from Settings
3. Add to Vercel env vars as `VITE_POSTHOG_KEY`

### 5. Add Environment Variables to Vercel

Add these to Vercel Dashboard → Settings → Environment Variables:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_ALLOWED_ADMIN_EMAILS=arunima.productmanager@gmail.com,innovations.arz@gmail.com,arunima.ceo@gmail.com,danazahreddine@hotmail.com,praveen@praveen.science
VITE_POSTHOG_KEY=phc_...
SUPABASE_URL=https://fygdmqaixqaxurtnavzv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from Supabase Dashboard → Project Settings → API>
```

### 6. Deploy

```bash
git push origin praveen/feature-first-plan-auth-stripe-cohort
# Merge to main and deploy via Vercel
```

---

## End-to-End Flow (After All Configuration)

This is what the full experience looks like once everything is configured:

1. New user visits Hello-EQ → redirected to sign-in
2. Signs in with Google (one click)
3. Uses Coach 3 times → sees "You've used all 3 free coach sessions"
4. Clicks "Join Cohort" → redirected to Stripe checkout
5. Pays $79 → redirected back with success message
6. Unlimited access for 8 weeks
7. Account page shows "Summer 2026 Cohort — 56 days remaining"
8. Admin creates next cohort from `/admin` dashboard
9. PostHog captures the entire funnel: signup → usage → limit → paywall → checkout → purchase

---

## Quick Reference

| Feature | Free Limit | Paid |
|---------|-----------|------|
| Coach | 3 sessions | Unlimited |
| Idea Validator | 2 sessions | Unlimited |
| Product Taste | 5 exercises | Unlimited |
| Pass Price | — | $79 / 8 weeks |

| Admin Email | Role |
|------------|------|
| arunima.productmanager@gmail.com | Admin |
| innovations.arz@gmail.com | Admin |
| arunima.ceo@gmail.com | Admin |
| danazahreddine@hotmail.com | Admin |
| praveen@praveen.science | Admin |
