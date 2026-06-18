import type { Drill } from '../types/drilloop';

// ── Profile drills ──
// A second drill kind: instead of being graded against a rubric, the free-text
// answer is parsed by Claude into the member's structured profile (goals /
// interests / expertise / seeking / offering). These feed the matching engine.
// They carry no rubric, no model answer, and no practice `format`.

export const PROFILE_PHASE_TITLE = 'About you';

function profileDrill(slug: string, order: number, title: string, prompt: string): Drill {
  return {
    id: slug,
    kind: 'profile',
    phase: 0,
    phaseTitle: PROFILE_PHASE_TITLE,
    order,
    type: 'judgment', // unused for profile drills; satisfies the shared Drill shape
    difficulty: 'core',
    title,
    prompt,
    keyPoints: [],
    modelAnswer: '',
    tags: ['profile'],
    isSample: false,
  };
}

export const PROFILE_DRILLS: Drill[] = [
  profileDrill(
    'p-stuck-problem', 200,
    'What are you stuck on?',
    "What's a problem you're currently stuck on at work — something you'd genuinely welcome an outside perspective on? Be specific about the shape of the problem.",
  ),
  profileDrill(
    'p-sharper-skill', 201,
    'Where do you want to get sharper?',
    "What's a skill or area you want to be noticeably sharper at six months from now, and why does it matter for where you're headed?",
  ),
  profileDrill(
    'p-can-teach', 202,
    'What could you teach?',
    'What could you teach someone else right now — a topic, skill, or hard-won lesson you could go deep on for an hour without preparing?',
  ),
  profileDrill(
    'p-who-to-meet', 203,
    'Who would be useful to meet?',
    'What kind of person would be most useful for you to meet right now — by role, stage, expertise, or situation — and what would you hope to get from the conversation?',
  ),
  profileDrill(
    'p-recent-win', 204,
    'What are you proud of lately?',
    "What's something you've shipped, decided, or figured out in the last few months that you're proud of? What made it hard?",
  ),
];
