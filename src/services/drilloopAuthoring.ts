import type { DrillDraft, DrillType, DrillDifficulty } from '../types/drilloop';
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
    const raw = await callClaude(
      buildSystemPrompt(count),
      `CREATOR CONTENT:\n\n${transcript.trim()}\n\nDraft ${count} drills. Return only the JSON.`,
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
  } catch {
    return { drafts: templateDrafts(transcript, count), aiGenerated: false };
  }
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
