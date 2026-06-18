# Drilloop — Architecture (Connection Product Migration)

> Status: **CONFIRMED — implementation in progress.** Decisions below are locked
> (cohort passes · matching opt-out · manual-trigger matching · Supabase+Vercel).
> See [`docs/DRILLOOP.md`](docs/DRILLOOP.md) for setup + what is wired end-to-end
> vs. the remaining mechanical migration. Confirmed decisions are marked ✅;
> defaults I chose (and you can override) are marked ⚙️.

---

## 1. Context & Scope

Drilloop today is a **client-side prototype**: member progress, authored drills, and
membership state all live in `localStorage` / Dexie (IndexedDB). The only live backend
call is `/api/claude` for grading and authoring.

We are evolving it into a **community connection product**: members answer daily
**knowledge drills** and new **profile drills**; a **matching engine** periodically
proposes 1:1 connections across the member base with a human-readable rationale; members
**accept / decline / snooze** suggestions in a new **Connect** tab; the creator sees
**network health** in Creator Studio.

This is **not** a localStorage extension. We rebuild the Drilloop data layer on a real
backend with persistent storage, server-verified auth, and real payments — while reusing
the substantial backend infrastructure that **already exists** in this repo.

---

## 2. What Already Exists (and why we reuse it)

A full-stack foundation is already in place. The migration **extends** it rather than
replacing it:

| Capability | Already in repo | Decision |
|---|---|---|
| **Database + Auth** | Supabase (Postgres + Auth + RLS). Email/password, Google OAuth, magic link all wired in [`src/context/AuthContext.tsx`](src/context/AuthContext.tsx). | Reuse. |
| **Server functions** | Vercel serverless functions in [`api/`](api/) (`@vercel/node`). | Reuse + add. |
| **LLM proxy** | [`api/claude.ts`](api/claude.ts) — server-side `ANTHROPIC_API_KEY`, in-memory rate limiting (30/min), token + cost logging, Supabase usage tracking. | Reuse + harden. |
| **Payments** | [`api/create-checkout-session.ts`](api/create-checkout-session.ts), [`api/stripe-webhook.ts`](api/stripe-webhook.ts); cohort/pass model in `20260522_cohorts_passes_usage.sql`. | Reuse (cohort passes ✅). |
| **RLS migration pattern** | `enable row level security` + owner-scoped policies + `security definer` functions for privileged server writes (see `increment_usage`). | Follow this pattern exactly. |
| **Validation** | `zod@4` already a dependency. | Use for all structured Claude outputs. |
| **Tests** | `vitest` configured. | Use for matching + profile-merge logic. |

### 2.1 Confirmed Architecture Decisions

- ✅ **Stack:** Stay on **Supabase + Vercel**. No Next.js/Prisma rewrite. We rebuild
  only the Drilloop data layer; routing (React Router 7), build (Vite), and styling
  (Tailwind 4) are unchanged.
- ✅ **Auth:** Reuse Supabase Auth (sessions are server-verified via Supabase JWT;
  privileged operations run in Vercel functions with the **service role**, never trusting
  client claims). Add a `role` (`member | creator | admin`) on a new `profiles` table.
- ✅ **Payments:** Keep the existing **cohort-pass** model (one-time Stripe payment →
  time-boxed access window). The schema is designed so a future move to recurring
  subscriptions is additive, not a rewrite.
- ✅ **Matching cadence:** **Manual trigger only** to start — an admin/creator-invoked
  "Run matching" endpoint. The schedule (Vercel Cron) is deferred; §7 documents exactly
  how to turn it on later with zero schema change.
- ✅ **Matching pool default:** **Opt-out** (members are in the pool by default, with a
  one-click way to leave). Rationale + mitigations in §8.
- ✅ **Match shape:** **1:1 pairs** only for now.

---

## 3. System Topology

```
┌─────────────────────────────────────── Browser (React 19 + RR7 + Tailwind) ──┐
│  Member view: Today · Program · Progress · Connect(new)                       │
│  Creator Studio: Author(+profile drills) · Insights · Shoutouts · Connections │
│  Data access: Supabase JS (RLS-scoped reads/writes) + fetch() to /api/*       │
└───────────────┬───────────────────────────────────────────────┬──────────────┘
                │ Supabase JWT (RLS)                              │ fetch
                ▼                                                 ▼
┌──────────────────────────────┐        ┌──────────────────────────────────────┐
│  Supabase Postgres           │        │  Vercel Functions (api/*.ts)          │
│  - RLS-protected member reads│◄──────►│  service-role writes (bypass RLS):    │
│  - drills, attempts,         │ service│  - /api/drilloop/grade  (knowledge)   │
│    member_profiles, matches, │  role  │  - /api/drilloop/profile-extract      │
│    connections, runs, …      │        │  - /api/admin/run-matching (manual)   │
│  - SQL views: phase_strengths│        │  - /api/claude (existing LLM proxy)   │
│    creator_insights_*        │        │  - Stripe checkout + webhook (exist)  │
└──────────────────────────────┘        └───────────────┬──────────────────────┘
                                                         │ ANTHROPIC_API_KEY
                                                         ▼
                                                  Anthropic API (Claude)
```

**Trust boundary:** the browser may read its own rows via RLS, but every **write that
derives trust** (grade scores, extracted profiles, generated matches, payment state)
happens in a Vercel function using the service-role key. The client never writes a score,
a profile, or a match directly.

---

## 4. Data Model

New Drilloop tables live alongside the existing `cohorts / user_passes / usage_counts /
public_profiles / validator_*` tables. `auth.users` is the identity root.

### 4.1 Entity overview

| Table | Purpose | Write path |
|---|---|---|
| `profiles` | App-user basics + `role`. 1:1 with `auth.users`. | Owner (basics) / server (role). |
| `drills` | Server-side drill catalog (seeded + authored). Adds `kind` = knowledge \| profile. | Creator (own) / seed script. |
| `drill_attempts` | One graded attempt. Core unit. | Owner inserts answer; **server** writes grade. |
| `drill_feedback` | Post-drill signal (useful/confusing/…). | Owner. |
| `member_profiles` | **Derived, evolving** structured profile from profile drills + matching prefs. | **Server** (merge); owner edits/clears. |
| `phase_strengths` *(VIEW)* | Per-member per-phase mastery, always-fresh. | Computed. |
| `matches` | Generated 1:1 pairings + per-side status. | **Server** (job); owner updates own side. |
| `connections` | Mutually-accepted matches + outcome logging. | **Server** creates; owners log outcome. |
| `matching_runs` | Observability for each matching run. | **Server**. |
| `creator_insights_*` *(VIEWS)* | Aggregated, anonymized network/learning health. | Computed. |

### 4.2 Naming note — `kind` vs `type`

The brief adds a drill `type` of `knowledge | profile`. The **existing** `Drill.type` is
already `judgment | recall | scenario` (the *practice format*). To avoid a collision we
name the new axis **`kind`** (`knowledge | profile`) and keep the existing axis as
**`format`** (`judgment | recall | scenario`). Profile drills set `format = null`.

### 4.3 Key table shapes (full DDL in the migration)

**`profiles`** — `id (=auth.users.id)`, `email`, `display_name`, `avatar_url`,
`timezone`, `role member|creator|admin = member`, `created_at`.

**`drills`** — `id uuid`, `slug` (stable seed id), `kind knowledge|profile`,
`format judgment|recall|scenario|null`, `phase`, `phase_title`, `drill_order`,
`difficulty core|stretch|mastery`, `title`, `prompt`, `key_points text[]`,
`model_answer`, `tags text[]`, `is_sample`, `source_url`, `source_label`,
`author_id (null=seeded)`, `is_published`, `created_at`.

**`drill_attempts`** — `id`, `user_id`, `drill_id`, `kind` (denormalized),
`answer`, `self_rating nailed|partial|missed|null`, `ai_score int|null`, `ai_feedback`,
`grade jsonb` (`{strengths, gaps, aiGraded}`), `completed_at`, `day date`.

**`member_profiles`** — the high-risk, incrementally-merged table:
```
user_id uuid PK
goals          jsonb  -- [{text, weight, last_seen}]
interests      jsonb  -- [{text, weight, last_seen}]
expertise_tags jsonb  -- [{tag,  weight, last_seen}]
seeking_tags   jsonb  -- [{tag,  weight, last_seen}]
offering_tags  jsonb  -- [{tag,  weight, last_seen}]
seniority_signal text
summary        text          -- human-readable, for match rationale prompts
matching_opt_in boolean default true        -- ✅ opt-out
visibility     jsonb default '{"name":"always","goals":"always","contact":"mutual_accept"}'
last_updated   timestamptz
```
Tags are **weighted** so we can merge new extractions and **decay** stale signals instead
of overwriting (algorithm in §6.2).

**`matches`** — `id`, `run_id`, `member_a_id`, `member_b_id` (canonical `a < b` to dedupe
& enforce cooldown), `rationale text`, `match_type knowledge_complement|goal_aligned|mixed`,
`confidence numeric`, `a_status`/`b_status` (`suggested|accepted|declined|snoozed`),
`status` (overall, derived), `snoozed_until`, `generated_at`, `expires_at`.
A `unique (member_a_id, member_b_id, run_id)` guard plus a cooldown query (§6.3) prevent
re-suggesting a declined pair too soon.

**`connections`** — `id`, `match_id`, `member_a_id`, `member_b_id`, `connected_at`,
`met boolean`, `a_outcome_rating`/`b_outcome_rating int`, `a_outcome_note`/`b_outcome_note`,
`status active|archived`. Created by the server when **both** sides accept.

**`matching_runs`** — `id`, `trigger_type manual|scheduled`, `triggered_by`, `started_at`,
`finished_at`, `status running|success|failed`, `members_considered`, `matches_generated`,
`error`, `claude_input_tokens`, `claude_output_tokens`, `cost_usd`.

**`phase_strengths` (VIEW)** — derived live from `drill_attempts ⨝ drills`:
`user_id, phase, attempts, avg_score, mastery (0-100)`. A view (not a table) means **no
staleness and no triggers**; the matching job and Progress tab read the same fresh numbers.

**`creator_insights_*` (VIEWS)** — `creator_insights_drills` (per-drill attempts /
completion / avg score / struggle rate), `creator_insights_network` (matches generated,
acceptance rate, top `match_type`, trending goal/interest clusters). All **aggregate /
anonymized** — no individual private profile fields exposed.

### 4.4 RLS posture

- `profiles`, `drill_attempts`, `drill_feedback`, `member_profiles`: **owner-only**
  read/write (`auth.uid() = user_id`).
- `drills`: published drills readable by any authenticated user; authors manage their own.
- `matches`: readable when `auth.uid() IN (member_a_id, member_b_id)`; a member may update
  **only their own side's** status.
- `connections`: readable/updatable by the two participants (own outcome fields only).
- `matching_runs`, `creator_insights_*`: creator/admin only (via an `is_staff()`
  `security definer` helper that reads `profiles.role`).
- **Counterpart visibility is server-mediated**, not via a broad cross-user RLS read: the
  Connect endpoints return only the fields §8 permits for a given match state (name+goals
  while suggested; contact only after mutual accept). No member can read another member's
  `member_profiles` row directly.

---

## 5. Services (Vercel functions)

| Endpoint | Auth | Responsibility |
|---|---|---|
| `POST /api/drilloop/grade` | member JWT | Knowledge-drill grading. Calls Claude (strict JSON), zod-validates, **server-writes** `ai_score`/`grade` to the attempt. Heuristic fallback preserved. |
| `POST /api/drilloop/profile-extract` | member JWT | Profile-drill **structured extraction** → zod-validated tags → **merge** into `member_profiles` (§6.2). |
| `POST /api/admin/run-matching` | admin/creator | **Manual** matching run (§6). Writes `matching_runs` + `matches`. |
| `POST /api/drilloop/match-respond` | member JWT | Accept/decline/snooze a match side; on mutual accept, create `connection`. |
| `api/claude.ts` | (existing) | Shared LLM proxy — extended with a server-to-server path + retries for batch matching. |
| Stripe checkout + webhook | (existing) | Cohort-pass purchase → access window. |

All structured Claude calls share one rule: **never trust raw model JSON.** Parse →
`zod.safeParse` → on failure, one repair retry → on second failure, fail loudly (log to
`matching_runs.error` / return a typed error to the client). No silent fallthrough.

---

## 6. Matching Engine

A pure, testable core (`src/services/matching/`) wrapped by the `/api/admin/run-matching`
function. Manual trigger now; same core runs under Cron later.

**Flow:**
1. Load active, **opted-in** members' `phase_strengths` + `member_profiles`.
2. Build **anonymized** member summaries (id replaced by an opaque handle; only goals /
   tags / phase strengths — no email, no name) for the Claude prompt.
3. Send **batches** to Claude asking for proposed pairs with
   `{match_type, rationale, confidence}` as strict JSON; zod-validate.
4. Apply **guardrails** (§6.3): cooldown filter, per-member caps, overload balancing.
5. Write surviving pairs to `matches` (status `suggested`); record run stats in
   `matching_runs`.

### 6.1 Match signals
- **Knowledge complementarity:** strong-in-phase-X paired with weak-in-phase-X
  (from `phase_strengths`).
- **Goal/interest alignment:** overlap of `seeking_tags ↔ offering_tags`, or shared
  goal/interest clusters (from `member_profiles`).
- `match_type` records which dominated: `knowledge_complement | goal_aligned | mixed`.

### 6.2 Profile-merge algorithm (high-risk → unit-tested)
Tags are `{tag, weight∈[0,1], last_seen}`. On each new profile-drill extraction:
- **Decay** every existing tag: `weight *= DECAY` (⚙️ `DECAY = 0.9`).
- **Reinforce/insert** each newly-extracted tag:
  `weight = min(1, weight + INCREMENT)` (⚙️ `INCREMENT = 0.5`), `last_seen = now`.
- **Prune** tags with `weight < FLOOR` (⚙️ `FLOOR = 0.15`).
- Goals/interests merge by normalized text, keeping the most-recent `MAX_GOALS` (⚙️ `8`).
This means recent answers dominate while history fades gracefully — never a full overwrite.

### 6.3 Guardrails (defaults ⚙️ — override any)
- **Cooldown:** don't re-suggest a pair within `COOLDOWN_WEEKS` of a decline (⚙️ `8`).
- **Per-member cap:** ≤ `MAX_SUGGESTIONS_PER_RUN` open suggestions (⚙️ `3`).
- **Overload balance:** prefer members with the fewest lifetime suggestions so the same
  few people aren't always matched and others never are.
- **Self/dupe guard:** never match a member to themselves or to an existing active
  connection.

### 6.4 Observability
Every run writes a `matching_runs` row (trigger type, who, counts, token cost, errors).
Creator Studio → Connections surfaces last-run time, matches generated, and failures.

---

## 7. Background Jobs (deferred schedule)

Manual now; to enable the **weekly** schedule later with **no schema change**:
1. Add a `crons` entry (via `vercel.ts`, per current platform guidance) →
   `path: '/api/cron/run-matching'`.
2. `api/cron/run-matching.ts` verifies a `CRON_SECRET` header, then calls the **same**
   matching core with `trigger_type = 'scheduled'`.
The manual admin endpoint and the cron endpoint share one implementation.

---

## 8. Privacy & Consent

- ✅ **Opt-out default** (`matching_opt_in = true`). **Rationale:** this cohort is a
  paying, creator-curated membership where meeting peers is a stated product value, so
  default participation maximizes early match liquidity (needed for the engine to be
  useful at all). **Mitigations that make opt-out safe:** (a) a one-click "Leave the
  matching pool" toggle on Connect; (b) **staged disclosure** — a suggested match reveals
  only name + goals; **contact info is shared only after mutual accept**; (c) members can
  **edit or clear** their derived `member_profiles` at any time; (d) leaving the pool
  stops all future suggestions immediately and can purge derived profile data.
- **Visibility config** lives in `member_profiles.visibility` and is enforced
  **server-side** in the Connect endpoints, never by client filtering.
- Creator Studio sees **only aggregates** (`creator_insights_*` views) — never an
  individual's private profile fields.

---

## 9. Migration & Demo-Data Cleanup

- **Seed:** load the existing seeded drill bank (`src/data/drilloopDrills.ts`) into the
  `drills` table via a seed script (`kind = 'knowledge'`), plus a set of **profile
  drills**. Add a realistic demo cohort (varied goals/skills) for local matching tests.
- **Per-user local state:** offer a **best-effort one-time import** of the signed-in
  user's own `drilloop_state_v1` attempts on first authenticated load; otherwise members
  start fresh on real storage.
- **Remove entirely** (now that real multi-user data exists): the hardcoded 7-name demo
  cohort and synthetic leaderboard/`activeMembers`/`paidMembers` counts in
  `drilloopInsights.ts`, and the `isYou`-flagged fake leaderboard rows. These are
  documented for deletion in the migration PR.

---

## 10. Non-Functional Requirements

- **Error/loading states** everywhere a Claude call or payment webhook can fail — no
  silent failures. Grading and extraction surface typed errors to the UI.
- **Server-side schema validation** (zod) for every structured Claude output, with one
  repair-retry then loud failure.
- **Tests** focused on the two highest-risk pure modules: matching selection/guardrails
  and profile-merge/decay.
- **Observability:** `matching_runs` + extended `/api/claude` token/cost logging.

---

## 11. Build Order (after this doc is confirmed)

1. **Schema + RLS** migration (the file accompanying this doc) + seed script.
2. **Data layer + auth**: `profiles` row provisioning; Drilloop reads via Supabase RLS,
   writes via server functions. Migrate grading onto `drill_attempts`.
3. **Migrate existing loop** (drills/streaks/progress/insights) off localStorage.
4. **Profile drills** (Today queue scheduling + `profile-extract` + merge + authoring UI).
5. **Matching engine** (pure core + tests + `/api/admin/run-matching`).
6. **Connect tab** (member accept/decline/snooze, mutual-accept reveal, history).
7. **Creator Studio → Connections** (aggregate views).
8. **Cleanup**: remove demo/synthetic data; README + run instructions.

---

## 12. Open Defaults To Confirm (⚙️)

These have sensible defaults baked in above; flagging them so you can override before I build:
`DECAY=0.9`, `INCREMENT=0.5`, `FLOOR=0.15`, `MAX_GOALS=8`, `COOLDOWN_WEEKS=8`,
`MAX_SUGGESTIONS_PER_RUN=3`, profile-drill cadence (proposed: **every 7th drill in the
Today queue**), match `expires_at` (proposed: **14 days**).
