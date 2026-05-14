-- ============================================================
-- validator_sessions: rename modes for v2
-- ============================================================
-- v1 used PM-framed modes ("aspiring", "working") which actively harmed the
-- experience for non-PM users (the AI repeatedly pushed PM-only validation
-- channels). v2 retunes the toggle around the user's intent:
--
--   aspiring → quick_prototype   (smallest testable thing, fast)
--   working  → strategic_bet     (real product investment, more rigor)
--
-- The semantics changed; this is intentional. Existing sessions are migrated
-- 1:1 because the closer mapping is mostly about effort/rigor and the prior
-- labels' PM framing is being dropped entirely. If a previously-"working"
-- session was actually a quick prototype, the user can switch modes from the
-- UI; it will reset the conversation, which is the correct v1→v2 behavior.
-- ============================================================

-- Drop the old CHECK constraint so the UPDATE doesn't violate it.
alter table validator_sessions drop constraint if exists validator_sessions_mode_check;

-- Map legacy values to new ones.
update validator_sessions
   set mode = case mode
                when 'aspiring' then 'quick_prototype'
                when 'working'  then 'strategic_bet'
                else mode
              end
 where mode in ('aspiring', 'working');

-- Recreate the CHECK with the new domain.
alter table validator_sessions
  add constraint validator_sessions_mode_check
  check (mode in ('quick_prototype', 'strategic_bet'));

comment on column validator_sessions.mode is
  'Interview mode: quick_prototype (smallest testable thing) vs strategic_bet (real product investment).';
