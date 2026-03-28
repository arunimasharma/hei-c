-- ============================================================
-- public_profiles: Verified Public Profile Orchestration
-- ============================================================
-- Stores only derived aggregates — no PII, no sensitive data.
-- Raw answers, journal entries, emotions, CBT analysis, and
-- career events are NEVER written to this table.
-- ============================================================

create table if not exists public_profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  public_slug  text not null unique,   -- URL-safe, user-visible identifier
  credibility_score int not null default 0 check (credibility_score between 0 and 100),
  expert_tags  text[] not null default '{}',
  proof_hash   text not null,          -- SHA-256 of score|tags|caseCount|YYYY-MM
  version      int not null default 1,
  last_updated timestamptz not null default now(),

  constraint public_profiles_user_id_unique unique (user_id)
);

-- Index for fast slug lookups (public API path)
create index if not exists public_profiles_slug_idx on public_profiles (public_slug);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public_profiles enable row level security;

-- Public read: anyone can fetch a profile by slug (powers the /p/[slug] page)
create policy "public_profiles_public_read"
  on public_profiles
  for select
  using (true);

-- Owners can insert/update their own row only
create policy "public_profiles_owner_write"
  on public_profiles
  for insert
  with check (auth.uid() = user_id);

create policy "public_profiles_owner_update"
  on public_profiles
  for update
  using (auth.uid() = user_id);

-- Owners can delete (disable public profile)
create policy "public_profiles_owner_delete"
  on public_profiles
  for delete
  using (auth.uid() = user_id);

-- ── Comments ──────────────────────────────────────────────────────────────────
comment on table public_profiles is
  'Opt-in public credibility profiles. Contains only derived aggregates — no raw user data.';
comment on column public_profiles.proof_hash is
  'SHA-256 of "score|sortedTags|caseCount|YYYY-MM". Lets viewers verify the score is derived from real activity without exposing underlying data.';
comment on column public_profiles.public_slug is
  'URL-safe human-readable identifier used in /p/{slug}. Never contains user PII.';
