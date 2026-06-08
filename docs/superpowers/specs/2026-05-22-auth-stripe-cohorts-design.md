# Auth, Stripe & Cohort System Design

**Date:** 2026-05-22
**Status:** Approved
**Stack:** React 19 + Vite 7 + Supabase + Stripe + PostHog

---

## Overview

Transform Hello-EQ from a free, optionally-authenticated app into a cohort-based paid product with:
- Mandatory authentication (Google, email/password, magic link)
- Time-boxed access passes sold through Stripe ($79 / 8 weeks)
- Free-tier usage limits with paywall upgrade flow
- Cohort enrollment windows managed by admins
- Admin dashboard for cohort and user management
- PostHog analytics for product performance tracking

---

## 1. Authentication

### Current State
- Supabase email/password auth exists but is optional
- Google OAuth credentials exist in env but not wired up
- `AuthContext.tsx` and `SignInPage.tsx` exist

### Target State
- Auth is **mandatory** — unauthenticated users redirected to `/auth/signin`
- Three sign-in methods:
  - **Google OAuth** — configured in Supabase dashboard using existing `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  - **Email/password** — existing flow, kept as-is
  - **Magic link** — passwordless email sign-in via Supabase
- `AuthContext.tsx` extended to handle all three methods
- `SignInPage.tsx` redesigned with all three options (Google button prominent, email/password form, magic link option)
- Auth guard component wraps all routes, redirecting unauthenticated users to `/auth/signin`
- Admin detection: check `user.email` against `VITE_ALLOWED_ADMIN_EMAILS` env var

### Admin Emails (Initial)
```
arunima.productmanager@gmail.com
innovations.arz@gmail.com
arunima.ceo@gmail.com
danazahreddine@hotmail.com
praveen@praveen.science
```

### Adding New Admins
Add email to `VITE_ALLOWED_ADMIN_EMAILS` in Vercel dashboard (comma-separated list). No code changes needed. Redeploy for changes to take effect.

---

## 2. Database Schema

All new tables in Supabase PostgreSQL with Row-Level Security (RLS).

### `cohorts` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | Auto-generated |
| `name` | text | e.g., "Summer 2026 Cohort" |
| `enrollment_opens_at` | timestamptz | When purchase window opens |
| `enrollment_closes_at` | timestamptz | When purchase window closes |
| `cohort_starts_at` | timestamptz | When 8-week access begins |
| `cohort_ends_at` | timestamptz | When access expires |
| `price_cents` | int | 7900 for $79, configurable per cohort |
| `stripe_price_id` | text | Linked Stripe Price object |
| `max_seats` | int, nullable | Optional enrollment cap |
| `is_active` | boolean | Admin can deactivate |
| `created_at` | timestamptz | Auto-set |

RLS: Public read for active cohorts with open enrollment. Admin-only write.

### `user_passes` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | Auto-generated |
| `user_id` | uuid, FK | References `auth.users` |
| `cohort_id` | uuid, FK | References `cohorts` |
| `stripe_checkout_session_id` | text | From Stripe webhook |
| `stripe_payment_intent_id` | text | From Stripe webhook |
| `purchased_at` | timestamptz | When payment completed |
| `access_starts_at` | timestamptz | Mirrors cohort start |
| `access_ends_at` | timestamptz | Mirrors cohort end |
| `status` | text | `active`, `expired`, `refunded` |

RLS: Users can only read their own passes. Server writes via service role.

### `usage_counts` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | Auto-generated |
| `user_id` | uuid, FK | References `auth.users` |
| `feature` | text | `coach`, `validator`, `taste` |
| `count` | int | Default 0 |
| `updated_at` | timestamptz | Auto-updated |

Unique constraint on `(user_id, feature)`. RLS: Users read own counts. Server increments via service role.

### Gating Logic
1. Check `user_passes` for active pass (`status = 'active'` AND `now()` between `access_starts_at` and `access_ends_at`) -> unlimited access
2. No active pass -> check `usage_counts` against free limits:
   - Coach: 3 sessions
   - Validator: 2 sessions
   - Taste exercises: 5 sessions
3. Limit exceeded -> show paywall

### Usage Increment
Server-side only. Each API call (`/api/claude`, `/api/validator`, `/api/evaluate-taste`) increments count via Supabase service role key. Client reads counts for display but never writes (prevents tampering).

---

## 3. Stripe Integration

### Purchase Flow
1. User hits free-tier limit -> sees upgrade prompt
2. Upgrade prompt shows currently open cohort (name, dates, price, seats remaining)
3. User clicks "Join Cohort" -> frontend calls `POST /api/create-checkout-session`
4. Server creates Stripe Checkout Session:
   - Mode: `payment` (one-time)
   - Metadata: `{ user_id, cohort_id }`
   - `success_url`: `/account?purchase=success`
   - `cancel_url`: `/account?purchase=cancelled`
5. User redirected to Stripe hosted checkout
6. After payment, Stripe sends `checkout.session.completed` webhook to `/api/stripe-webhook`
7. Webhook handler:
   - Verifies Stripe signature
   - Extracts `user_id` and `cohort_id` from metadata
   - Creates `user_passes` row with `status: 'active'`
   - Decrements available seats (if `max_seats` set)
8. User returns to success URL, app fetches active pass

### New API Routes
| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/create-checkout-session` | POST | Create Stripe Checkout | Required (user JWT) |
| `/api/stripe-webhook` | POST | Handle Stripe events | Stripe signature verification |

### New Environment Variables
```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_...
```

### Stripe Setup
- One Stripe Product: "Hello-EQ Cohort Access"
- Price object created per cohort (admin dashboard triggers creation)
- Webhook endpoint registered in Stripe dashboard

### Edge Cases
- User already has active pass -> hide purchase button, show pass status
- Enrollment closed -> show "Enrollment closed, next cohort starts [date]"
- Cohort full (max seats reached) -> show "Sold out"
- Payment fails -> Stripe handles retry UI on checkout page
- Double-purchase prevention -> check for existing active pass before creating checkout session

---

## 4. Cohort Enrollment Windows & Admin Dashboard

### Enrollment Window Logic
- Each cohort has `enrollment_opens_at` and `enrollment_closes_at`
- Public app queries for cohorts where `now()` is within enrollment window AND `is_active = true`
- No open cohort -> "No cohort currently open. Join the waitlist." (optional email capture)
- Open cohort -> show details + purchase button
- One active pass per user (no stacking)

### Admin Dashboard

Gated by `VITE_ALLOWED_ADMIN_EMAILS` check. Accessible at `/admin`.

#### Admin Home (`/admin`)
- Summary cards: total users, active passes, current cohort enrollment count, revenue
- Quick links to manage cohorts and view users

#### Cohort Management (`/admin/cohorts`)
- List all cohorts (past, current, upcoming) with status badges
- **Create cohort** form: name, enrollment window dates, cohort start/end dates, price, max seats
- **Edit cohort**: modify details (warnings if enrollment already started)
- **Close enrollment early**: toggle `is_active` to false
- Creating a cohort auto-creates the Stripe Price object via API

#### Enrolled Users (`/admin/cohorts/:id/users`)
- List of users enrolled in a specific cohort
- Shows: email, purchase date, usage stats (coach/validator/taste counts)
- Basic CSV export

#### User Lookup (`/admin/users`)
- Search by email
- Shows: sign-in method, pass history, usage counts, account created date

---

## 5. PostHog Analytics

### Integration
- Install `posthog-js` SDK
- Initialize in `main.tsx` with `VITE_POSTHOG_KEY` env var
- Identify users on sign-in: `posthog.identify(user.id, { email, sign_in_method })`
- Reset on sign-out: `posthog.reset()`

### Events
| Event | Trigger | Properties |
|-------|---------|------------|
| `user_signed_up` | First sign-in | `method` |
| `user_signed_in` | Every sign-in | `method` |
| `coach_session_started` | Coach chat started | `is_paid`, `usage_count` |
| `validator_session_started` | Validator started | `is_paid`, `usage_count` |
| `taste_exercise_started` | Exercise started | `is_paid`, `usage_count` |
| `free_limit_hit` | Usage limit reached | `feature`, `limit` |
| `paywall_shown` | Upgrade prompt shown | `feature`, `cohort_id` |
| `checkout_started` | "Join Cohort" clicked | `cohort_id`, `price` |
| `purchase_completed` | Webhook confirms payment | `cohort_id`, `user_id` |
| `pass_expired` | Pass expires | `cohort_id` |

### Key Funnels (built in PostHog UI)
- Sign-up -> Feature use -> Limit hit -> Paywall -> Checkout -> Purchase
- Free vs paid feature usage comparison
- Retention by cohort

---

## 6. Paywall UI & User Experience

### Free Users
- Usage count shown subtly (e.g., "2 of 3 coach sessions used")
- Limit hit -> feature UI replaced with upgrade prompt:
  - "You've used all 3 free coach sessions"
  - If cohort open: cohort name, dates, price, "Join Cohort" button
  - If no cohort open: "No cohort currently available. We'll notify you when the next one opens."
- Upgrade prompt also accessible from Account page

### Paid Users
- No usage counters (unlimited access)
- Pass status badge on Account page: "Summer 2026 Cohort - 23 days remaining"
- Time-remaining progress bar
- < 7 days remaining -> gentle banner: "Your access expires soon"
- After expiry -> reverts to free-tier limits, usage counts preserved

### Account Page Additions
- Current pass status (active/expired/none)
- Pass history (previous cohorts)
- Usage stats (informational for paid users)
- "Upgrade" or "Renew" button depending on state

### Sign-In Page Redesign
- Three methods displayed clearly: Google (prominent), email/password, magic link
- Clean, branded layout consistent with existing design
- Redirect to original destination after sign-in

---

## 7. New Environment Variables Summary

```
# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_...

# Admin
VITE_ALLOWED_ADMIN_EMAILS=arunima.productmanager@gmail.com,innovations.arz@gmail.com,arunima.ceo@gmail.com,danazahreddine@hotmail.com,praveen@praveen.science

# PostHog
VITE_POSTHOG_KEY=phc_...

# Existing (unchanged)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## 8. New Dependencies

```
stripe              # Stripe Node.js SDK (server-side, API routes)
posthog-js          # PostHog analytics (client-side)
```

No other new dependencies required. Supabase client already installed.
