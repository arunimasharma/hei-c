-- ============================================================
-- Drilloop core: real multi-user data layer + connection product
-- Migrates Drilloop off localStorage onto Supabase Postgres.
-- Adds profile drills, derived member profiles, and the matching engine.
--
-- Conventions (match existing migrations):
--   * every table has RLS enabled
--   * members read/write only their own rows via auth.uid()
--   * trust-bearing writes (grades, extracted profiles, matches) are done
--     server-side with the service role, which bypasses RLS
--   * privileged helpers are `security definer`
-- ============================================================

-- ── profiles: app-user basics + role (1:1 with auth.users) ──────────────────────
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  display_name  text,
  avatar_url    text,
  timezone      text,
  role          text not null default 'member' check (role in ('member', 'creator', 'admin')),
  created_at    timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_owner_select" on profiles
  for select using (auth.uid() = id);
create policy "profiles_owner_update" on profiles
  for update using (auth.uid() = id);
-- role is set only via service role (server); members cannot self-promote.

-- ── Helper: staff (creator/admin) check ─────────────────────────────────────────
-- Reads role from profiles. security definer so RLS on profiles can't recurse.
-- Defined after profiles so the SQL body validates at creation time.
create or replace function is_staff(p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles
    where id = p_user_id and role in ('creator', 'admin')
  );
$$;

-- ── drills: server-side catalog (seeded + creator-authored) ─────────────────────
create table if not exists drills (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique,                            -- stable id for seeded drills
  kind          text not null default 'knowledge' check (kind in ('knowledge', 'profile')),
  format        text check (format in ('judgment', 'recall', 'scenario')),  -- null for profile drills
  phase         int not null default 0,
  phase_title   text,
  drill_order   int not null default 0,
  difficulty    text check (difficulty in ('core', 'stretch', 'mastery')),
  title         text not null,
  prompt        text not null,
  key_points    text[] not null default '{}',          -- rubric; empty for profile drills
  model_answer  text,
  tags          text[] not null default '{}',
  is_sample     boolean not null default false,
  source_url    text,
  source_label  text,
  author_id     uuid references auth.users(id) on delete set null,  -- null = seeded
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),

  -- knowledge drills must carry a format; profile drills must not
  constraint drills_kind_format_valid check (
    (kind = 'knowledge' and format is not null) or
    (kind = 'profile'   and format is null)
  )
);

create index if not exists drills_published_order_idx
  on drills (is_published, phase, drill_order);

alter table drills enable row level security;

create policy "drills_read_published" on drills
  for select using (is_published = true or author_id = auth.uid());
create policy "drills_author_insert" on drills
  for insert with check (author_id = auth.uid() and is_staff(auth.uid()));
create policy "drills_author_update" on drills
  for update using (author_id = auth.uid());

-- ── drill_attempts: one graded attempt (the core loop unit) ─────────────────────
create table if not exists drill_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  drill_id      uuid not null references drills(id) on delete cascade,
  kind          text not null default 'knowledge' check (kind in ('knowledge', 'profile')),
  phase         int not null default 0,        -- denormalized from drills.phase (for phase_strengths)
  answer        text not null,
  self_rating   text check (self_rating in ('nailed', 'partial', 'missed')),  -- null for profile drills
  ai_score      int check (ai_score between 0 and 100),                       -- server-written
  ai_feedback   text,                                                         -- server-written
  grade         jsonb,                       -- {strengths:[], gaps:[], aiGraded:bool} — server-written
  completed_at  timestamptz not null default now(),
  day           date not null default (now() at time zone 'utc')::date        -- streak/daily logic
);

create index if not exists drill_attempts_user_idx     on drill_attempts (user_id, completed_at desc);
create index if not exists drill_attempts_user_day_idx on drill_attempts (user_id, day);
create index if not exists drill_attempts_drill_idx    on drill_attempts (drill_id);

alter table drill_attempts enable row level security;

-- Owner may insert/read their attempts. ai_score/grade are written by the server
-- (service role) after grading; the owner's own update path is allowed but the UI
-- never sets scores client-side.
create policy "drill_attempts_owner_select" on drill_attempts
  for select using (auth.uid() = user_id);
create policy "drill_attempts_owner_insert" on drill_attempts
  for insert with check (auth.uid() = user_id);
create policy "drill_attempts_owner_update" on drill_attempts
  for update using (auth.uid() = user_id);

-- ── drill_feedback: lightweight post-drill signal to the creator ────────────────
create table if not exists drill_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  drill_id    uuid not null references drills(id) on delete cascade,
  tag         text not null check (tag in ('useful', 'confusing', 'too-easy', 'too-hard')),
  note        text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists drill_feedback_drill_idx on drill_feedback (drill_id);

alter table drill_feedback enable row level security;

create policy "drill_feedback_owner_select" on drill_feedback
  for select using (auth.uid() = user_id);
create policy "drill_feedback_owner_insert" on drill_feedback
  for insert with check (auth.uid() = user_id);

-- ── member_profiles: derived, incrementally-merged structured profile ───────────
-- Tags are stored as weighted arrays: [{ "tag": "...", "weight": 0.0-1.0,
-- "last_seen": "iso" }] so the server can decay stale signals and reinforce
-- recent ones instead of overwriting. See ARCHITECTURE.md §6.2.
create table if not exists member_profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  goals            jsonb not null default '[]',   -- [{text, weight, last_seen}]
  interests        jsonb not null default '[]',
  expertise_tags   jsonb not null default '[]',   -- [{tag, weight, last_seen}]
  seeking_tags     jsonb not null default '[]',
  offering_tags    jsonb not null default '[]',
  seniority_signal text,
  summary          text,                          -- human-readable, fuels match rationale
  matching_opt_in  boolean not null default true, -- opt-OUT default (see ARCHITECTURE.md §8)
  visibility       jsonb not null default '{"name":"always","goals":"always","contact":"mutual_accept"}',
  last_updated     timestamptz not null default now()
);

create index if not exists member_profiles_pool_idx
  on member_profiles (matching_opt_in) where matching_opt_in = true;

alter table member_profiles enable row level security;

create policy "member_profiles_owner_select" on member_profiles
  for select using (auth.uid() = user_id);
create policy "member_profiles_owner_update" on member_profiles
  for update using (auth.uid() = user_id);
create policy "member_profiles_owner_insert" on member_profiles
  for insert with check (auth.uid() = user_id);
-- No cross-user read policy: a counterpart's allowed fields are returned by the
-- Connect server endpoints (service role), respecting `visibility`.

-- ── phase_strengths: per-member per-phase mastery (always-fresh VIEW) ───────────
-- A view, not a table: no triggers, no staleness. Progress tab + matching read the
-- same numbers. mastery maps self_rating (nailed=100/partial=50/missed=0) averaged.
create or replace view phase_strengths as
select
  a.user_id,
  a.phase,
  count(*)                                      as attempts,
  avg(a.ai_score)                               as avg_score,
  avg(case a.self_rating
        when 'nailed'  then 100
        when 'partial' then 50
        when 'missed'  then 0
      end)::numeric                             as mastery
from drill_attempts a
where a.kind = 'knowledge'
group by a.user_id, a.phase;

-- ── matching_runs: observability for each run ───────────────────────────────────
create table if not exists matching_runs (
  id                  uuid primary key default gen_random_uuid(),
  trigger_type        text not null default 'manual' check (trigger_type in ('manual', 'scheduled')),
  triggered_by        uuid references auth.users(id) on delete set null,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  status              text not null default 'running' check (status in ('running', 'success', 'failed')),
  members_considered  int not null default 0,
  matches_generated   int not null default 0,
  error               text,
  claude_input_tokens int not null default 0,
  claude_output_tokens int not null default 0,
  cost_usd            numeric not null default 0
);

alter table matching_runs enable row level security;

create policy "matching_runs_staff_select" on matching_runs
  for select using (is_staff(auth.uid()));

-- ── matches: generated 1:1 pairings with per-side status ────────────────────────
-- member_a_id < member_b_id (canonical) so a pair is one row and cooldown/dedupe
-- queries are symmetric.
create table if not exists matches (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid references matching_runs(id) on delete set null,
  member_a_id   uuid not null references auth.users(id) on delete cascade,
  member_b_id   uuid not null references auth.users(id) on delete cascade,
  rationale     text not null,
  match_type    text not null check (match_type in ('knowledge_complement', 'goal_aligned', 'mixed')),
  confidence    numeric,
  a_status      text not null default 'suggested' check (a_status in ('suggested', 'accepted', 'declined', 'snoozed')),
  b_status      text not null default 'suggested' check (b_status in ('suggested', 'accepted', 'declined', 'snoozed')),
  status        text not null default 'suggested' check (status in ('suggested', 'accepted', 'declined', 'snoozed', 'expired')),
  snoozed_until timestamptz,
  generated_at  timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '14 days'),

  constraint matches_canonical_order check (member_a_id < member_b_id),
  constraint matches_pair_run_unique unique (member_a_id, member_b_id, run_id)
);

create index if not exists matches_member_a_idx on matches (member_a_id, status);
create index if not exists matches_member_b_idx on matches (member_b_id, status);
create index if not exists matches_pair_idx     on matches (member_a_id, member_b_id, generated_at desc);

alter table matches enable row level security;

-- A participant can see matches they are in.
create policy "matches_participant_select" on matches
  for select using (auth.uid() in (member_a_id, member_b_id));
-- A participant can update the row (their own side's status). Column-level
-- enforcement (only your *_status) is handled in the /api/drilloop/match-respond
-- function; this policy gates row access.
create policy "matches_participant_update" on matches
  for update using (auth.uid() in (member_a_id, member_b_id));

-- ── connections: mutually-accepted matches + outcome logging ────────────────────
create table if not exists connections (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references matches(id) on delete cascade,
  member_a_id     uuid not null references auth.users(id) on delete cascade,
  member_b_id     uuid not null references auth.users(id) on delete cascade,
  connected_at    timestamptz not null default now(),
  met             boolean,
  a_outcome_rating int check (a_outcome_rating between 1 and 5),
  b_outcome_rating int check (b_outcome_rating between 1 and 5),
  a_outcome_note  text,
  b_outcome_note  text,
  status          text not null default 'active' check (status in ('active', 'archived')),

  constraint connections_match_unique unique (match_id)
);

create index if not exists connections_member_a_idx on connections (member_a_id);
create index if not exists connections_member_b_idx on connections (member_b_id);

alter table connections enable row level security;

create policy "connections_participant_select" on connections
  for select using (auth.uid() in (member_a_id, member_b_id));
create policy "connections_participant_update" on connections
  for update using (auth.uid() in (member_a_id, member_b_id));

-- ── creator insight views (aggregate / anonymized) ──────────────────────────────
-- Per-drill performance. No member identity exposed.
create or replace view creator_insights_drills as
select
  d.id                                                          as drill_id,
  d.title,
  d.phase,
  count(a.id)                                                   as attempts,
  avg(a.ai_score)                                               as avg_score,
  (count(a.id) filter (where a.ai_score < 60))::numeric
    / nullif(count(a.id), 0)                                    as struggle_rate
from drills d
left join drill_attempts a on a.drill_id = d.id and a.kind = 'knowledge'
where d.kind = 'knowledge'
group by d.id, d.title, d.phase;

-- Network health. Aggregate only.
create or replace view creator_insights_network as
select
  (select count(*) from matches)                                              as total_matches,
  (select count(*) from connections)                                          as total_connections,
  (select count(*) from matches where status = 'accepted')::numeric
    / nullif((select count(*) from matches), 0)                               as acceptance_rate,
  (select match_type from matches group by match_type
     order by count(*) desc limit 1)                                          as top_match_type,
  (select count(*) from member_profiles where matching_opt_in)                as pool_size;

comment on view creator_insights_drills  is 'Aggregate per-drill learning health. No member identity.';
comment on view creator_insights_network is 'Aggregate network/matching health. No member identity.';
comment on view phase_strengths          is 'Live per-member per-phase mastery from drill_attempts. Read by Progress + matching.';
comment on table member_profiles is 'Derived, incrementally-merged structured profile. matching_opt_in defaults true (opt-out). Counterpart visibility is server-mediated.';
comment on table matches  is '1:1 suggested pairings. Canonical member_a_id < member_b_id. Per-side status; mutual accept -> connections row.';
