# Drilloop — Connection Product (Backend & Setup)

The migration of Drilloop from a localStorage prototype into a real, multi-user
connection product. Read [`ARCHITECTURE.md`](../ARCHITECTURE.md) first for the
design and rationale; this doc is the operational guide.

## Stack

- **DB / Auth:** Supabase (Postgres + Auth + RLS) — reused from the existing app.
- **API:** Vercel serverless functions in [`api/`](../api/).
- **LLM:** the existing `/api/claude` proxy + a server-side validated-JSON helper
  (`api/_lib/server.ts`) used by the new endpoints.
- **Matching:** a pure, tested core (`src/services/matching/`) wrapped by an
  admin-triggered endpoint.

## Environment variables

Server-side (Vercel function env — never `VITE_`-prefixed):

| Var | Used by |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | all Drilloop endpoints (service-role writes) |
| `ANTHROPIC_API_KEY` | grading, profile extraction, match rationales |
| `VITE_ALLOWED_ADMIN_EMAILS` | gates `/api/admin/run-matching` (comma-separated) |

Client-side: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (already present).
See [`.env.example`](../.env.example).

## 1. Apply the schema

No local Postgres is required for development of the pure logic, but the tables
must exist in your Supabase project. Apply the migration:

```bash
# via Supabase CLI (links to your project)
supabase db push
# — or paste supabase/migrations/20260612_drilloop_core.sql into the
#   Supabase Dashboard → SQL Editor and run it.
```

This creates: `profiles`, `drills`, `drill_attempts`, `drill_feedback`,
`member_profiles`, `matches`, `connections`, `matching_runs`, the
`phase_strengths` view, and the `creator_insights_*` views — all with RLS.

> After applying, set your own user's role to `creator` (or `admin`) so you can
> read the creator views and trigger runs:
> `update profiles set role = 'creator' where email = 'you@example.com';`
> (Insert the row first if it doesn't exist — see seeding.)

## 2. Seed the catalog (and an optional demo cohort)

```bash
set -a; source .env; set +a            # load SUPABASE_URL + SERVICE_ROLE_KEY
npx tsx scripts/seed.ts                # knowledge + profile drills
npx tsx scripts/seed.ts --demo         # + 6 demo members with profiles & attempts
```

The `--demo` cohort is built so the matching engine has real signal
(offering↔seeking overlap and strong/weak phase complementarity).

## 3. Run a matching pass

Matching is **manual-trigger** for now (ARCHITECTURE.md §7). Two ways:

- **Creator Studio → Connections → "Run matching"** (UI button), or
- direct call:

```bash
curl -X POST https://<your-app>/api/admin/run-matching \
  -H "Authorization: Bearer <a signed-in admin's access token>"
```

Each run writes a `matching_runs` row (members considered, matches generated,
Claude token cost, errors) visible in the Connections tab.

### Enabling the weekly schedule later

No schema change needed. Add a cron entry (per current Vercel guidance, in
`vercel.ts`) pointing at `/api/cron/run-matching`, and have that endpoint verify
a `CRON_SECRET` header then call the same matching core with
`trigger_type = 'scheduled'`.

## 4. Tests

The two highest-risk modules are unit-tested:

```bash
npx vitest run src/services/matching      # 27 tests: engine + profile merge
npx vitest run                            # full suite
```

## Endpoints

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/drilloop/grade` | POST | member | Grade a knowledge answer, persist the attempt (server-scored). |
| `/api/drilloop/profile-extract` | POST | member | Extract a profile-drill answer → merge into `member_profiles`. |
| `/api/drilloop/matches` | GET | member | The viewer's suggestions + connections (visibility-gated counterpart). |
| `/api/drilloop/match-respond` | POST | member | Accept/decline/snooze; mutual accept → `connections` row. |
| `/api/admin/run-matching` | POST | admin | Manual matching run. |

## Privacy & consent

- Matching is **opt-out** (`member_profiles.matching_opt_in` defaults `true`).
  Members leave the pool from the Connect tab; `setMatchingOptIn(false)` stops
  future suggestions.
- A suggested match exposes only **name + goals**; **contact** is revealed only
  after **mutual accept**, and only if the counterpart's `visibility.contact`
  allows it. Enforced server-side in `api/_lib/matchView.ts`.
- Members can clear derived profile data (`clearProfileData()` in `repo.ts`).

## What is wired end-to-end vs. remaining

**Wired to the backend now:**
- Schema + RLS, seed script, the pure matching/merge cores (tested).
- All five endpoints above + the shared server lib (auth, validated Claude JSON).
- **Member Connect tab** (`src/components/drilloop/ConnectView.tsx`) — loads
  matches/connections, accept/decline/snooze, opt-out toggle, contact reveal.
- **Creator Studio → Connections tab** — network health from `creator_insights_*`
  views + "Run matching" trigger + run history.
- Client data layer: `src/services/drilloop/{repo,metrics,rows,heuristic,creatorRepo}.ts`.

**Remaining mechanical migration (same patterns, no new design):**
- The member **Today / Program / Progress** tabs and the creator **Insights /
  Shoutouts / Author** tabs still read the old localStorage stores
  (`drilloopStore.ts`, `drilloopCatalog.ts`, `drilloopInsights.ts`). Swap them to
  the new layer:
  - catalog → `repo.getCatalog()` / `getKnowledgeDrills()` / `getProfileDrills()`
  - attempts + metrics → `repo.getMyAttempts()` + `metrics.computeMetrics(catalog, attempts)`
  - knowledge submit → `repo.submitKnowledgeAttempt(...)` (server grades)
  - **profile drills** in Today → route `drill.kind === 'profile'` to
    `repo.submitProfileAttempt(...)` instead of the rubric DrillPlayer
  - creator Insights → `creatorRepo.getDrillStruggles()`; authoring → publish to
    the `drills` table (add a `kind` toggle for profile-drill prompts).

**Demo/synthetic data to remove** once Insights/Shoutouts read the views above
(documented, not yet deleted because those tabs still have no other data source):
- the hardcoded 7-name demo cohort and synthetic `activeMembers` / `paidMembers`
  / leaderboard rows in `src/services/drilloopInsights.ts`.
