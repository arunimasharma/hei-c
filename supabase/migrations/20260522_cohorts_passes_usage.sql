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
