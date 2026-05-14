-- ============================================================
-- validator_sessions / validator_messages: Idea Validator
-- ============================================================
-- A user takes a messy product idea through a focused AI interview
-- and produces a structured product brief. Only the chat transcript
-- and generated markdown doc are persisted — no derivative scoring,
-- no tags, no cross-feature joins.
-- ============================================================

create table if not exists validator_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  mode              text not null check (mode in ('aspiring', 'working')),
  title             text,
  generated_doc     text,
  doc_generated_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index if not exists validator_sessions_user_active_idx
  on validator_sessions (user_id, created_at desc)
  where deleted_at is null;

create table if not exists validator_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references validator_sessions(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists validator_messages_session_idx
  on validator_messages (session_id, created_at);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table validator_sessions enable row level security;
alter table validator_messages enable row level security;

-- Sessions: owner-only access (no public surface).
create policy "validator_sessions_owner_select"
  on validator_sessions for select
  using (auth.uid() = user_id and deleted_at is null);

create policy "validator_sessions_owner_insert"
  on validator_sessions for insert
  with check (auth.uid() = user_id);

create policy "validator_sessions_owner_update"
  on validator_sessions for update
  using (auth.uid() = user_id);

-- Messages: ownership flows through the parent session.
create policy "validator_messages_owner_select"
  on validator_messages for select
  using (
    exists (
      select 1 from validator_sessions s
      where s.id = validator_messages.session_id
        and s.user_id = auth.uid()
        and s.deleted_at is null
    )
  );

create policy "validator_messages_owner_insert"
  on validator_messages for insert
  with check (
    exists (
      select 1 from validator_sessions s
      where s.id = validator_messages.session_id
        and s.user_id = auth.uid()
    )
  );

comment on table validator_sessions is
  'Idea Validator interview sessions. Soft-deleted via deleted_at; RLS hides deleted rows from selects.';
comment on column validator_sessions.mode is
  'Interview mode: aspiring PM (portfolio/APM) vs working PM (real product bet).';
comment on column validator_sessions.generated_doc is
  'Markdown product brief produced by /api/validator op=generate. Nullable until first generation.';
