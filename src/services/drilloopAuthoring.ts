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
    'Each option\'s "text" MUST be succinct and crisp — ONE short sentence, TWO at most. Keep all four parallel in length and tone so the correct one is not obvious. Put all detail and nuance in "rationale", never in the option text.',
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

// ── Explain it simply (member side) ──
// Explains the core concept a drill tests in very plain language — without giving
// away the specific answer — so a member who's stuck can still learn.

export interface SimpleExplanation {
  text: string;
  aiGenerated: boolean;
}

function buildExplainSystemPrompt(): string {
  return [
    'You explain the concept behind a "Drilloop" judgment drill in very simple, plain language — like to a smart beginner, with no jargon.',
    'The member has already answered, so explain the FULL concept clearly — including the key insight behind the best answer and why it holds.',
    'Use one short everyday analogy if it helps. Keep it to 3-5 short sentences.',
    'Return plain text only — no JSON, no markdown headers.',
  ].join('\n');
}

export async function explainSimply(drill: Drill): Promise<SimpleExplanation> {
  try {
    const raw = await callClaude(
      buildExplainSystemPrompt(),
      [
        `DRILL TITLE: ${drill.title}`,
        `QUESTION: ${drill.prompt}`,
        drill.keyPoints.length ? `KEY IDEAS IT TESTS:\n${drill.keyPoints.map(k => `- ${k}`).join('\n')}` : '',
        '',
        'Explain the core concept simply. Plain text only.',
      ].filter(Boolean).join('\n'),
      400,
    );
    const text = parseActionResponse(raw).trim();
    if (!text) throw new Error('empty');
    return { text, aiGenerated: true };
  } catch (err) {
    console.warn('[Drilloop] AI explain-simply failed — using fallback.', err);
    const k = drill.keyPoints[0];
    return {
      text: k
        ? `In simple terms, this drill is about: ${k}. Focus on that idea — think about when it would hold, and when it wouldn't.`
        : 'In simple terms: read the question slowly, decide what the best judgment call is, and be ready to justify it.',
      aiGenerated: false,
    };
  }
}

// Neutral, on-demand explanation of ONE answer option, shown BEFORE the learner
// chooses — so they can understand each option without being told which is right.
export async function explainMcqOption(drill: Drill, optionText: string): Promise<SimpleExplanation> {
  try {
    const raw = await callClaude(
      [
        'You help a learner understand ONE answer option in a "Drilloop" multiple-choice judgment drill, BEFORE they choose.',
        'In plain language, explain what this option is claiming and the reasoning someone might use to consider it — clarify the concept so the learner can evaluate it themselves.',
        'CRITICAL: do NOT say or hint whether this option is correct or incorrect, and do not reveal the answer. Stay strictly neutral.',
        'Keep it to 2-4 short sentences, plain language, no jargon. Return plain text only — no JSON, no markdown headers.',
      ].join('\n'),
      [
        `QUESTION: ${drill.prompt}`,
        `ANSWER OPTION: "${optionText}"`,
        drill.keyPoints.length ? `RELEVANT IDEAS THE DRILL TESTS: ${drill.keyPoints.join('; ')}` : '',
        '',
        'Explain this option neutrally and simply, without judging it. Plain text only.',
      ].filter(Boolean).join('\n'),
      400,
    );
    const text = parseActionResponse(raw).trim();
    if (!text) throw new Error('empty');
    return { text, aiGenerated: true };
  } catch (err) {
    console.warn('[Drilloop] AI explain-option failed — using fallback.', err);
    return {
      text: `This option claims: ${optionText} Think about whether that holds, given the question and the ideas this drill is testing.`,
      aiGenerated: false,
    };
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

// ── Iterate a single drill on the creator's instruction ──
// The creator types what to change — the question, difficulty, rubric, reference
// answer, type, or title — and the model returns the full revised drill.

export interface DrillRevision {
  title: string;
  type: DrillType;
  difficulty: DrillDifficulty;
  prompt: string;
  keyPoints: string[];
  modelAnswer: string;
  aiGenerated: boolean;
}

function buildDrillIterateSystemPrompt(): string {
  return [
    'You revise a single "Drilloop" judgment drill according to the creator\'s instruction.',
    'The instruction may target any part: the question/prompt, the difficulty, the type, the rubric (key points), the reference answer, or the title.',
    'Keep it a JUDGMENT drill — it must force a defensible call, not recall of definitions. Keep the rubric (3-5 key points) and the reference answer consistent with the revised prompt.',
    'Return ONLY minified JSON, no markdown, with this exact shape:',
    '{"title":"","type":"judgment","difficulty":"core","prompt":"","keyPoints":["",""],"modelAnswer":""}',
  ].join('\n');
}

export async function iterateDrill(
  current: { title: string; type: DrillType; difficulty: DrillDifficulty; prompt: string; keyPoints: string[]; modelAnswer: string },
  instruction: string,
): Promise<DrillRevision> {
  try {
    const raw = await callClaude(
      buildDrillIterateSystemPrompt(),
      [
        'CURRENT DRILL (JSON):',
        JSON.stringify(current),
        '',
        `CREATOR'S INSTRUCTION:\n${instruction.trim()}`,
        '',
        'Apply it and return the full revised drill. Return only the JSON.',
      ].join('\n'),
      1400,
    );
    const text = parseActionResponse(raw).trim();
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const d = JSON.parse(json) as RawDraft;
    if (!d.prompt || !d.title) throw new Error('empty');
    return {
      title: d.title.trim(),
      type: coerceType(d.type),
      difficulty: coerceDiff(d.difficulty),
      prompt: d.prompt.trim(),
      keyPoints: (d.keyPoints ?? []).map(p => p.trim()).filter(Boolean).slice(0, 6),
      modelAnswer: (d.modelAnswer ?? '').trim(),
      aiGenerated: true,
    };
  } catch (err) {
    console.warn('[Drilloop] AI drill iteration failed — drill left unchanged.', err);
    return { ...current, aiGenerated: false };
  }
}

// ── Generate next-post suggestion (content calendar) ──
// Synthesizes member feedback, drill-performance signals, explicit member
// requests, and the model's own market research into the single best next post —
// one that meets real demand, builds a cohesive thought-leadership brand, and is
// primed to perform on Drilloop and on social.

export interface NextPostContext {
  creatorName: string;
  topic: string;
  /** Optional — a specific topic the creator wants this post centered on. */
  focusTopic?: string;
  /** Titles of recent calendar posts — for a cohesive arc without repetition. */
  recentPostTitles: string[];
  /** Where the audience struggles, from drill performance. */
  struggles: { title: string; avgScore: number; struggleRate: number; commonGaps: string[] }[];
  feedback: { tag: string; note: string }[];
  requests: { topicTitle: string; text: string }[];
}

export interface NextPostSuggestion {
  title: string;
  hook: string;
  angle: string;
  /** Why this post now — references the signals it drew from. */
  rationale: string;
  outline: string[];
  drillIdeas: string[];
  /** The concrete signals (demand, struggle, trend) behind the pick. */
  signals: string[];
  /** How it builds a cohesive thought-leadership brand + social growth. */
  brandNote: string;
  aiGenerated: boolean;
}

function buildNextPostSystemPrompt(topic: string): string {
  return [
    `You are the content strategist for a Drilloop creator building a thought-leadership brand in "${topic}".`,
    'Synthesize four inputs to recommend the SINGLE best next post: (a) member feedback, (b) drill-performance signals (where the audience struggles), (c) explicit member requests (real demand), and (d) your own market research on what is timely, contrarian, or under-served in this space right now.',
    'The post must: address genuine audience demand, build a cohesive thought-leadership arc (extend prior posts without repeating them), spawn 2-4 strong judgment drills, and be primed to perform on social media (a sharp, defensible point of view — not a listicle).',
    'In "signals", cite the specific evidence you used (e.g. "3 members requested eval design", "drill X had 62% struggle rate", "market: everyone over-hypes multi-agent").',
    'Return ONLY minified JSON, no markdown, with this exact shape:',
    '{"title":"","hook":"","angle":"","rationale":"","outline":["",""],"drillIdeas":["",""],"signals":["",""],"brandNote":""}',
  ].join('\n');
}

function buildNextPostUserMessage(ctx: NextPostContext): string {
  const lines: string[] = [`CREATOR: ${ctx.creatorName} — topic: ${ctx.topic}`, ''];

  if (ctx.focusTopic) {
    lines.push(`FOCUS TOPIC: The creator wants this post centered on "${ctx.focusTopic}". Prioritize it — pick the sharpest angle within this topic that the signals and your market research support.`, '');
  }

  lines.push('RECENT POSTS (build on these, do not repeat):');
  lines.push(ctx.recentPostTitles.length ? ctx.recentPostTitles.map(t => `- ${t}`).join('\n') : '- (none yet — this sets the tone)');
  lines.push('');

  lines.push('WHERE MEMBERS STRUGGLE (drill performance):');
  lines.push(ctx.struggles.length
    ? ctx.struggles.map(s => `- ${s.title}: avg ${s.avgScore}/100, ${Math.round(s.struggleRate * 100)}% struggled${s.commonGaps.length ? `; gaps: ${s.commonGaps.join(', ')}` : ''}`).join('\n')
    : '- (no performance data yet)');
  lines.push('');

  lines.push('MEMBER FEEDBACK:');
  lines.push(ctx.feedback.length ? ctx.feedback.map(f => `- [${f.tag}] ${f.note || '(no note)'}`).join('\n') : '- (none yet)');
  lines.push('');

  lines.push('MEMBER REQUESTS (explicit demand):');
  lines.push(ctx.requests.length ? ctx.requests.map(r => `- on "${r.topicTitle}": ${r.text}`).join('\n') : '- (none yet)');
  lines.push('');

  lines.push(`Using these plus your market research on what is timely in ${ctx.topic}, recommend the single best next post. Return only the JSON.`);
  return lines.join('\n');
}

export async function suggestNextPost(ctx: NextPostContext): Promise<NextPostSuggestion> {
  try {
    const raw = await callClaude(buildNextPostSystemPrompt(ctx.topic), buildNextPostUserMessage(ctx), 1600);
    const text = parseActionResponse(raw).trim();
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const p = JSON.parse(json) as Partial<NextPostSuggestion>;
    if (!p.title || !p.angle) throw new Error('empty');
    const arr = (x: unknown): string[] => (Array.isArray(x) ? x.map(String).map(s => s.trim()).filter(Boolean) : []);
    return {
      title: String(p.title).trim(),
      hook: String(p.hook ?? '').trim(),
      angle: String(p.angle).trim(),
      rationale: String(p.rationale ?? '').trim(),
      outline: arr(p.outline).slice(0, 8),
      drillIdeas: arr(p.drillIdeas).slice(0, 6),
      signals: arr(p.signals).slice(0, 8),
      brandNote: String(p.brandNote ?? '').trim(),
      aiGenerated: true,
    };
  } catch (err) {
    console.warn('[Drilloop] AI next-post suggestion failed — using heuristic.', err);
    return nextPostFallback(ctx);
  }
}

function nextPostFallback(ctx: NextPostContext): NextPostSuggestion {
  const req = ctx.requests[0];
  const struggle = ctx.struggles[0];
  const focus = ctx.focusTopic || req?.topicTitle || struggle?.title || ctx.topic;
  const signals: string[] = [];
  if (req) signals.push(`Member request on “${req.topicTitle}”`);
  if (struggle) signals.push(`“${struggle.title}” drill — ${Math.round(struggle.struggleRate * 100)}% struggled`);
  signals.push(`Market: ${ctx.topic} is noisy — a defensible POV stands out`);
  return {
    title: `What everyone gets wrong about ${focus}`,
    hook: `Most takes on ${focus} are confident and shallow. Here's the judgment call that actually matters.`,
    angle: `Take the most-requested / hardest area for your audience (${focus}) and give the contrarian, defensible point of view they can't get from a model.`,
    rationale: `Offline suggestion: your audience is asking for and struggling with ${focus}, so a sharp post there meets real demand and reinforces your authority.`,
    outline: [`The common (wrong) belief about ${focus}`, 'Why it breaks in practice', 'The judgment call that separates experts', 'A concrete example', 'What to do instead'],
    drillIdeas: [`A judgment drill on the core trade-off in ${focus}`, `A scenario drill where the naive approach to ${focus} fails`],
    signals,
    brandNote: `Owning the hard, in-demand corners of ${ctx.topic} compounds into a recognizable thought-leadership brand — on Drilloop and on social.`,
    aiGenerated: false,
  };
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
