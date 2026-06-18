/**
 * Drilloop seed script.
 *
 *   npx tsx scripts/seed.ts          # seed the drill catalog (knowledge + profile)
 *   npx tsx scripts/seed.ts --demo   # also create a demo cohort for matching tests
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
 * (load your .env first, e.g. `set -a; source .env; set +a`).
 *
 * Idempotent: drills upsert on `slug`; demo members upsert on a fixed email set.
 */
import { createClient } from '@supabase/supabase-js';
import { DRILLS } from '../src/data/drilloopDrills';
import { PROFILE_DRILLS } from '../src/data/profileDrills';
import type { Drill } from '../src/types/drilloop';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}
const sb = createClient(url, key);

function drillToRow(d: Drill) {
  const kind = d.kind ?? 'knowledge';
  return {
    slug: d.id,
    kind,
    format: kind === 'knowledge' ? d.type : null,
    phase: d.phase,
    phase_title: d.phaseTitle,
    drill_order: d.order,
    difficulty: d.difficulty,
    title: d.title,
    prompt: d.prompt,
    key_points: kind === 'knowledge' ? d.keyPoints : [],
    model_answer: kind === 'knowledge' ? d.modelAnswer : null,
    tags: d.tags,
    is_sample: d.isSample ?? false,
    source_url: d.sourceUrl ?? null,
    source_label: d.sourceLabel ?? null,
    author_id: null,
    is_published: true,
  };
}

async function seedDrills() {
  const rows = [...DRILLS, ...PROFILE_DRILLS].map(drillToRow);
  const { error } = await sb.from('drills').upsert(rows, { onConflict: 'slug' });
  if (error) throw error;
  console.log(`✓ Seeded ${DRILLS.length} knowledge + ${PROFILE_DRILLS.length} profile drills.`);
}

// ── Demo cohort ──
// Six members with varied profiles + a few knowledge attempts each, so the
// matching engine has real signal (offering↔seeking overlap + phase complement).

interface DemoMember {
  email: string; name: string;
  goals: string[]; offering: string[]; seeking: string[]; interests: string[]; seniority: string;
  strongPhases: number[]; weakPhases: number[];
}

const DEMO: DemoMember[] = [
  { email: 'priya.demo@drilloop.test', name: 'Priya R.', seniority: 'senior PM',
    goals: ['ship our first agentic feature'], offering: ['evals', 'rubric design'], seeking: ['fundraising', 'gtm for ai'], interests: ['multi-agent systems'], strongPhases: [5], weakPhases: [7] },
  { email: 'marcus.demo@drilloop.test', name: 'Marcus L.', seniority: 'founder',
    goals: ['raise a seed round'], offering: ['fundraising', 'gtm for ai'], seeking: ['evals', 'reliability'], interests: ['agent reliability'], strongPhases: [7], weakPhases: [5] },
  { email: 'sara.demo@drilloop.test', name: 'Sara K.', seniority: 'group PM',
    goals: ['build a safety review process'], offering: ['safety', 'governance'], seeking: ['multi-agent design'], interests: ['ai safety'], strongPhases: [6], weakPhases: [4] },
  { email: 'devon.demo@drilloop.test', name: 'Devon M.', seniority: 'staff PM',
    goals: ['design a multi-agent system'], offering: ['multi-agent design', 'orchestration'], seeking: ['safety', 'governance'], interests: ['orchestration'], strongPhases: [4], weakPhases: [6] },
  { email: 'aisha.demo@drilloop.test', name: 'Aisha T.', seniority: 'principal PM',
    goals: ['mentor junior PMs on ai'], offering: ['mentoring', 'product judgment'], seeking: ['hands-on coding'], interests: ['ai product strategy'], strongPhases: [1, 2], weakPhases: [3] },
  { email: 'tom.demo@drilloop.test', name: 'Tom B.', seniority: 'PM',
    goals: ['get hands-on with agent code'], offering: ['hands-on coding'], seeking: ['mentoring', 'product judgment'], interests: ['agent components'], strongPhases: [3], weakPhases: [1] },
];

function weighted(tags: string[]) {
  return tags.map(tag => ({ tag, weight: 0.8, lastSeen: '2026-06-01T00:00:00.000Z' }));
}
function weightedGoals(texts: string[]) {
  return texts.map(text => ({ text, weight: 0.8, lastSeen: '2026-06-01T00:00:00.000Z' }));
}

async function seedDemo() {
  const knowledge = DRILLS.filter(d => (d.kind ?? 'knowledge') === 'knowledge');
  for (const m of DEMO) {
    // create-or-fetch auth user
    const { data: created, error: cErr } = await sb.auth.admin.createUser({
      email: m.email, email_confirm: true, user_metadata: { full_name: m.name },
    });
    let userId = created?.user?.id;
    if (cErr || !userId) {
      const { data: list } = await sb.auth.admin.listUsers();
      userId = list?.users.find(u => u.email === m.email)?.id;
      if (!userId) { console.warn(`! could not create/find ${m.email}: ${cErr?.message}`); continue; }
    }

    await sb.from('profiles').upsert({ id: userId, email: m.email, display_name: m.name, role: 'member' }, { onConflict: 'id' });
    await sb.from('member_profiles').upsert({
      user_id: userId,
      goals: weightedGoals(m.goals), interests: weightedGoals(m.interests),
      expertise_tags: weighted(m.offering), offering_tags: weighted(m.offering), seeking_tags: weighted(m.seeking),
      seniority_signal: m.seniority, summary: `${m.name}: ${m.goals.join('; ')}`,
      matching_opt_in: true, last_updated: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // a few attempts: strong phases rated 'nailed', weak phases 'missed'
    const attempts: Record<string, unknown>[] = [];
    const pick = (phase: number, rating: string, score: number) => {
      const d = knowledge.find(k => k.phase === phase);
      if (!d) return;
      attempts.push({
        user_id: userId, drill_id: null, // resolved below via slug
        _slug: d.id, kind: 'knowledge', phase, answer: 'demo answer',
        self_rating: rating, ai_score: score, ai_feedback: 'demo', grade: { strengths: [], gaps: [], aiGraded: false },
        day: '2026-06-05',
      });
    };
    m.strongPhases.forEach(p => pick(p, 'nailed', 92));
    m.weakPhases.forEach(p => pick(p, 'missed', 25));

    // resolve slugs -> drill ids
    const slugs = attempts.map(a => a._slug as string);
    const { data: drillRows } = await sb.from('drills').select('id, slug').in('slug', slugs);
    const idBySlug = new Map((drillRows ?? []).map(r => [r.slug as string, r.id as string]));
    const insertable = attempts
      .map(a => { const { _slug, ...rest } = a; return { ...rest, drill_id: idBySlug.get(_slug as string) }; })
      .filter(a => a.drill_id);
    if (insertable.length) await sb.from('drill_attempts').insert(insertable);

    console.log(`✓ Demo member ${m.name} (${insertable.length} attempts)`);
  }
  console.log(`✓ Seeded ${DEMO.length} demo members. Run a matching pass to generate suggestions.`);
}

async function main() {
  await seedDrills();
  if (process.argv.includes('--demo')) await seedDemo();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
