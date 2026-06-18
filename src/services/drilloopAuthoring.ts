import type { Drill, DrillDraft, DrillType, DrillDifficulty } from '../types/drilloop';
import { callClaude, parseActionResponse } from './claudeApi';

// ── Drilloop authoring layer (creator side) ──
// The make-or-break for creator adoption: paste a post/video transcript, Claude
// drafts 3-5 drills with rubrics, the creator edits and publishes. Without
// AI-assisted authoring, drill creation is too much work and the loop dies.
// Falls back to a structured template extractor when the API is unavailable.

function buildSystemPrompt(count: number): string {
  return [
    'You are the drill-authoring assistant for "Drilloop", a learning membership where creators turn their content into repeatable practice for an expert audience.',
    `From a creator's content (a post, transcript, or notes), draft ${count} high-quality drills that make the audience PRACTICE JUDGMENT, not recall definitions.`,
    'Each drill must be answerable in a few sentences and force the learner to make a defensible call, not recite facts.',
    'For each drill provide: a short title; a type ("judgment" | "scenario" | "recall"); a difficulty ("core" | "stretch" | "mastery"); the prompt/question; a rubric of 3-5 key points a strong answer hits; and a reference model answer (3-5 sentences).',
    'Return ONLY minified JSON, no markdown, with this exact shape:',
    '{"drills":[{"title":"","type":"judgment","difficulty":"core","prompt":"","keyPoints":["",""],"modelAnswer":""}]}',
  ].join('\n');
}

interface RawDraft {
  title?: string;
  type?: string;
  difficulty?: string;
  prompt?: string;
  keyPoints?: string[];
  modelAnswer?: string;
}

const TYPES: DrillType[] = ['judgment', 'scenario', 'recall'];
const DIFFS: DrillDifficulty[] = ['core', 'stretch', 'mastery'];

function coerceType(t?: string): DrillType {
  return TYPES.includes(t as DrillType) ? (t as DrillType) : 'judgment';
}
function coerceDiff(d?: string): DrillDifficulty {
  return DIFFS.includes(d as DrillDifficulty) ? (d as DrillDifficulty) : 'core';
}

/** Whether the live AI authoring path produced these drafts (vs. fallback). */
export interface AuthoringResult {
  drafts: DrillDraft[];
  aiGenerated: boolean;
}

export async function generateDrills(
  transcript: string,
  count = 4,
): Promise<AuthoringResult> {
  try {
    // ~700-900 tokens per drill (prompt + rubric + reference answer). Give the
    // model real headroom so the JSON isn't truncated mid-object → parse fail.
    const maxTokens = Math.min(4096, 700 + count * 700);
    const raw = await callClaude(
      buildSystemPrompt(count),
      `CREATOR CONTENT:\n\n${transcript.trim()}\n\nDraft ${count} drills. Return only the JSON.`,
      maxTokens,
    );
    const text = parseActionResponse(raw).trim();
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json) as { drills?: RawDraft[] };
    const drafts = (parsed.drills ?? [])
      .filter(d => d.prompt && d.title)
      .map<DrillDraft>(d => ({
        title: d.title!.trim(),
        type: coerceType(d.type),
        difficulty: coerceDiff(d.difficulty),
        prompt: d.prompt!.trim(),
        keyPoints: (d.keyPoints ?? []).map(p => p.trim()).filter(Boolean).slice(0, 6),
        modelAnswer: (d.modelAnswer ?? '').trim(),
      }));
    if (drafts.length === 0) throw new Error('empty');
    return { drafts, aiGenerated: true };
  } catch (err) {
    console.warn('[Drilloop] AI drill authoring failed — using offline template.', err);
    return { drafts: templateDrafts(transcript, count), aiGenerated: false };
  }
}

// ── Develop-from-notes: the full lifecycle starting point ──
// A creator pastes ROUGH notes. We return (a) a recommended, publish-ready post
// developed from those notes, (b) draft drills built from it, and (c) research
// suggestions — concrete things to add to go deeper and unlock harder drills.
// This is what lets a creator manage content creation, not just drill creation.

export interface NotesDevelopment {
  /** A short hook/title for the recommended post. */
  postTitle: string;
  /** The recommended, publish-ready post developed from the rough notes. */
  post: string;
  /** Draft drills derived from the developed post. */
  drills: DrillDraft[];
  /** What to research / add next to deepen the post and enable harder drills. */
  research: string[];
  aiGenerated: boolean;
}

function buildDevelopSystemPrompt(count: number): string {
  return [
    'You are the content + drill development assistant for "Drilloop", where an expert turns rough notes into publishable content and repeatable practice.',
    'Given a creator\'s ROUGH NOTES, do three things:',
    '1. Develop a polished, publish-ready post (4-8 short paragraphs, the creator\'s confident expert voice, LinkedIn/Substack-ready). Give it a punchy title/hook.',
    `2. Draft ${count} judgment drills from that post (force defensible calls, not recall). Each: title, type ("judgment"|"scenario"|"recall"), difficulty ("core"|"stretch"|"mastery"), prompt, 3-5 key-point rubric, and a 3-5 sentence reference model answer.`,
    '3. Suggest 3-5 concrete research directions — specific things to add (data, examples, counter-arguments, frameworks) that would deepen the post and unlock harder (stretch/mastery) drills.',
    'Return ONLY minified JSON, no markdown, with this exact shape:',
    '{"postTitle":"","post":"","drills":[{"title":"","type":"judgment","difficulty":"core","prompt":"","keyPoints":["",""],"modelAnswer":""}],"research":["",""]}',
  ].join('\n');
}

interface RawDevelopment {
  postTitle?: string;
  post?: string;
  drills?: RawDraft[];
  research?: string[];
}

export async function developFromNotes(
  notes: string,
  count = 3,
): Promise<NotesDevelopment> {
  try {
    // A full post + N drills (with rubrics + reference answers) + research is a
    // large JSON payload; without enough headroom it truncates and parse fails,
    // silently dropping to the offline template. 4096 keeps it whole.
    const raw = await callClaude(
      buildDevelopSystemPrompt(count),
      `CREATOR ROUGH NOTES:\n\n${notes.trim()}\n\nDevelop the post, draft ${count} drills, and suggest research. Return only the JSON.`,
      4096,
    );
    const text = parseActionResponse(raw).trim();
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json) as RawDevelopment;
    const drills = (parsed.drills ?? [])
      .filter(d => d.prompt && d.title)
      .map<DrillDraft>(d => ({
        title: d.title!.trim(),
        type: coerceType(d.type),
        difficulty: coerceDiff(d.difficulty),
        prompt: d.prompt!.trim(),
        keyPoints: (d.keyPoints ?? []).map(p => p.trim()).filter(Boolean).slice(0, 6),
        modelAnswer: (d.modelAnswer ?? '').trim(),
      }));
    const post = (parsed.post ?? '').trim();
    if (!post || drills.length === 0) throw new Error('empty');
    return {
      postTitle: (parsed.postTitle ?? 'Recommended post').trim(),
      post,
      drills,
      research: (parsed.research ?? []).map(r => r.trim()).filter(Boolean).slice(0, 6),
      aiGenerated: true,
    };
  } catch (err) {
    console.warn('[Drilloop] AI post development failed — using offline template.', err);
    return developFallback(notes, count);
  }
}

// ── Research + enhance: act on the research suggestions ──
// The creator clicks "research this"; we take the current post + the research
// directions and have the model DO that research from its expert knowledge —
// weaving in concrete examples, data points, counter-arguments, and frameworks —
// then return the fuller, deeper post. The creator can re-run to go deeper still.

export interface PostEnhancement {
  /** The full enhanced post, with the research woven in. */
  post: string;
  /** Short phrases describing what was added (for UI feedback). */
  additions: string[];
  aiGenerated: boolean;
}

function buildResearchSystemPrompt(): string {
  return [
    'You are the research + editing assistant for "Drilloop". A creator has a post and a list of research directions meant to deepen it.',
    'DO that research using your expert knowledge: for each direction, weave concrete substance into the post — specific real examples, named frameworks, credible counter-arguments, and quantitative evidence.',
    'Be intellectually honest: do NOT fabricate precise statistics or fake citations. If you are not confident in an exact figure, describe the evidence qualitatively or attribute it as a general pattern.',
    "Strengthen and expand the post while preserving the creator's voice and overall structure. Return the FULL enhanced post (longer, deeper), not a diff or a summary.",
    'Return ONLY minified JSON, no markdown, with this exact shape:',
    '{"post":"<full enhanced post>","additions":["<short phrase of what you added>"]}',
  ].join('\n');
}

export async function researchAndEnhancePost(
  post: string,
  research: string[],
): Promise<PostEnhancement> {
  try {
    const raw = await callClaude(
      buildResearchSystemPrompt(),
      [
        `CURRENT POST:\n\n${post.trim()}`,
        '',
        `RESEARCH DIRECTIONS TO ACT ON:\n${research.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
        '',
        'Do the research, weave it into the post, and return the enhanced post. Return only the JSON.',
      ].join('\n'),
      4096,
    );
    const text = parseActionResponse(raw).trim();
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json) as { post?: string; additions?: string[] };
    const enhanced = (parsed.post ?? '').trim();
    if (!enhanced) throw new Error('empty');
    return {
      post: enhanced,
      additions: (parsed.additions ?? []).map(a => a.trim()).filter(Boolean).slice(0, 8),
      aiGenerated: true,
    };
  } catch (err) {
    console.warn('[Drilloop] AI research enhancement failed — appending directions as an appendix.', err);
    const appendix = ['', '', '— Going deeper (research to add) —', ...research.map(r => `• ${r}`)].join('\n');
    return { post: `${post.trim()}\n${appendix}`, additions: [], aiGenerated: false };
  }
}

// ── Iterate: revise the post on the creator's own instruction ──
// The creator types what they want changed — formatting ("add bullets",
// "punchier hook", "shorten") or content ("add a section on X", "soften the
// tone", "add a CTA") — and the model returns the full revised post. Re-runnable.

export interface PostIteration {
  post: string;
  aiGenerated: boolean;
}

function buildIterateSystemPrompt(): string {
  return [
    'You are the editing assistant for "Drilloop". Revise the creator\'s post according to their instruction.',
    'The instruction may be about FORMATTING (shorten, lengthen, add bullet points, punchier hook, add section headers, add emojis, tighten) or CONTENT (add/remove a point, change the angle, adjust the tone, add a call-to-action).',
    "Apply it faithfully while preserving the post's core substance and the creator's voice, unless the instruction explicitly asks to change those.",
    'Return ONLY minified JSON, no markdown, with this exact shape:',
    '{"post":"<full revised post>"}',
  ].join('\n');
}

export async function iteratePost(post: string, instruction: string): Promise<PostIteration> {
  try {
    const raw = await callClaude(
      buildIterateSystemPrompt(),
      [
        `CURRENT POST:\n\n${post.trim()}`,
        '',
        `CREATOR'S INSTRUCTION:\n${instruction.trim()}`,
        '',
        'Apply the instruction and return the full revised post. Return only the JSON.',
      ].join('\n'),
      4096,
    );
    const text = parseActionResponse(raw).trim();
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json) as { post?: string };
    const revised = (parsed.post ?? '').trim();
    if (!revised) throw new Error('empty');
    return { post: revised, aiGenerated: true };
  } catch (err) {
    console.warn('[Drilloop] AI post iteration failed — post left unchanged.', err);
    return { post, aiGenerated: false };
  }
}

// ── Multiple-choice experience: turn a drill into an MCQ (member side) ──
// The learner opts into a multiple-choice version of a drill: the model writes
// ONE correct option (capturing the reference answer) and THREE plausible-but-
// flawed distractors, each with a rationale. The wrong-option rationales are the
// "reasoning guidance" — how to think about that choice vs. the correct one.

export interface DrillMCQOption {
  text: string;
  correct: boolean;
  /** Why this option is right, or its flaw + how to think about it vs. the correct answer. */
  rationale: string;
}

export interface DrillMCQ {
  options: DrillMCQOption[]; // exactly 4, exactly one correct, shuffled
  aiGenerated: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildMcqSystemPrompt(): string {
  return [
    'You convert a "Drilloop" judgment drill into a multiple-choice question for an experienced learner.',
    'Given the drill question, its rubric (key points a strong answer hits), and the reference answer, write EXACTLY FOUR answer options:',
    '- exactly ONE correct option that captures the reference answer\'s judgment;',
    '- THREE plausible-but-flawed distractors: a common oversimplification, a partially-right-but-misapplied take, and a confident-but-wrong call.',
    'Keep all four options parallel in length and tone so the correct one is not obvious.',
    'For EVERY option include a 1-2 sentence "rationale". For the correct option: why it is right. For each wrong option: the specific flaw AND how to think about it relative to the correct answer — the reasoning guidance the learner needs.',
    'Return ONLY minified JSON, no markdown, with this exact shape:',
    '{"options":[{"text":"","correct":true,"rationale":""},{"text":"","correct":false,"rationale":""},{"text":"","correct":false,"rationale":""},{"text":"","correct":false,"rationale":""}]}',
  ].join('\n');
}

export async function generateDrillMCQ(drill: Drill): Promise<DrillMCQ> {
  try {
    const raw = await callClaude(
      buildMcqSystemPrompt(),
      [
        `DRILL: ${drill.title}`,
        `QUESTION: ${drill.prompt}`,
        '',
        'RUBRIC (key points a strong answer hits):',
        ...drill.keyPoints.map((p, i) => `${i + 1}. ${p}`),
        '',
        'REFERENCE ANSWER:',
        drill.modelAnswer,
        '',
        'Write the 4 options. Return only the JSON.',
      ].join('\n'),
      1600,
    );
    const text = parseActionResponse(raw).trim();
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json) as { options?: Array<{ text?: string; correct?: boolean; rationale?: string }> };
    const opts = (parsed.options ?? [])
      .filter(o => o.text && o.rationale)
      .map<DrillMCQOption>(o => ({ text: o.text!.trim(), correct: !!o.correct, rationale: o.rationale!.trim() }));
    const correct = opts.find(o => o.correct);
    const wrongs = opts.filter(o => !o.correct).slice(0, 3);
    if (!correct || wrongs.length < 3) throw new Error('bad shape');
    return { options: shuffle([correct, ...wrongs]), aiGenerated: true };
  } catch (err) {
    console.warn('[Drilloop] AI MCQ generation failed — using heuristic options.', err);
    return mcqFallback(drill);
  }
}

function mcqFallback(drill: Drill): DrillMCQ {
  const ref = drill.modelAnswer.split(/(?<=[.!?])\s+/)[0]?.trim() || 'The judgment that weighs the trade-offs the rubric rewards.';
  const k = drill.keyPoints;
  const options: DrillMCQOption[] = [
    { text: ref, correct: true, rationale: 'This matches the reference answer — it makes the defensible call the rubric rewards.' },
    { text: 'The simplest, most absolute answer that ignores the trade-offs.', correct: false, rationale: `Too absolute. The drill rewards judgment — the correct answer accounts for “${k[0] ?? 'the trade-offs'}”, which this skips.` },
    { text: 'A partially-right take that misses a key condition.', correct: false, rationale: `On the right track but incomplete — it overlooks “${k[k.length - 1] ?? 'a key rubric point'}” that the correct answer addresses.` },
    { text: 'A confident answer that applies the wrong principle entirely.', correct: false, rationale: 'Confident but misapplied — it answers a different question. Re-read the prompt against the correct option.' },
  ];
  return { options: shuffle(options), aiGenerated: false };
}

function developFallback(notes: string, count: number): NotesDevelopment {
  const clean = notes.replace(/\s+/g, ' ').trim();
  const sentences = clean.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const hook = sentences[0] ?? 'Your idea, developed';
  const post = [
    `${hook}`,
    '',
    clean,
    '',
    "Here's why it matters: the call isn't obvious, and most people get it wrong by defaulting to the easy answer. The judgment is in knowing when the rule breaks.",
  ].join('\n');
  return {
    postTitle: hook.slice(0, 70),
    post,
    drills: templateDrafts(clean, count),
    research: [
      'Add one concrete real-world example that proves the point.',
      'Find a credible counter-argument and address it directly.',
      'Cite a number, study, or benchmark to make the claim defensible.',
      'Name the specific situation where your advice would NOT apply.',
    ],
    aiGenerated: false,
  };
}

// ── Offline fallback ──
// Splits the content into its strongest sentences and scaffolds editable drills
// the creator can flesh out. Not as good as AI, but keeps authoring unblocked.

function templateDrafts(transcript: string, count: number): DrillDraft[] {
  const sentences = transcript
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.split(' ').length >= 6);

  const picks = sentences.slice(0, count);
  if (picks.length === 0) {
    return [
      {
        title: 'Draft drill (edit me)',
        type: 'judgment',
        difficulty: 'core',
        prompt:
          'Add your content above and regenerate, or write a judgment question here that forces the learner to make a defensible call.',
        keyPoints: ['Key point 1', 'Key point 2', 'Key point 3'],
        modelAnswer: 'Write the reference answer your strongest learner would give.',
      },
    ];
  }

  return picks.map((s, i) => ({
    title: `Drill ${i + 1} (edit me)`,
    type: 'judgment' as DrillType,
    difficulty: 'core' as DrillDifficulty,
    prompt: `Your content says: "${s}" — in your own words, when would this NOT hold, and what would you do instead?`,
    keyPoints: [
      'Restates the core claim accurately',
      'Names a concrete exception / edge case',
      'Proposes a defensible alternative',
    ],
    modelAnswer: `(Offline template — no AI key configured.) A strong answer engages with "${s}", names where it breaks, and offers a justified alternative. Edit this before publishing.`,
  }));
}
