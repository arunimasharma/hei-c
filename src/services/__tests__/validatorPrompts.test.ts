import { describe, it, expect } from 'vitest';
import {
  buildChatSystemPrompt,
  buildGenerationPrompt,
  evaluateReadiness,
  parseAreasTag,
  stripAreasTag,
  deriveSessionTitle,
} from '../validatorPrompts';

const PRODUCT_CLUB_URL = 'https://www.linkedin.com/company/theproductgrowthclub';

// ── Anti-examples from the v1 user test — never present, in any prompt ────────
//
// The spec's literal prompt text uses the bare word "PM" in a negation
// ("has PM training") — that's intentional, the model is being told NOT to
// assume PM context. So we don't ban the bare token; we ban the actual
// v1 framing fragments (positive PM-identity phrases and PM-channel pushes).

const V1_ANTI_EXAMPLE_FRAGMENTS = [
  'aspiring PM',
  'working PM',
  'APM applicant',
  'r/ProductManagement',
  'Reforge',
  'Mind the Product',
  "Lenny's",
  'Ardent PM Club',
];

describe('buildChatSystemPrompt', () => {
  it('contains no v1 PM-framing anti-examples in either mode', () => {
    for (const mode of ['quick_prototype', 'strategic_bet'] as const) {
      const prompt = buildChatSystemPrompt(mode);
      for (const frag of V1_ANTI_EXAMPLE_FRAGMENTS) {
        expect(prompt).not.toContain(frag);
      }
    }
  });

  it('includes the hard rules block in both modes', () => {
    for (const mode of ['quick_prototype', 'strategic_bet'] as const) {
      const prompt = buildChatSystemPrompt(mode);
      expect(prompt).toContain('Hard rules');
      expect(prompt).toContain("Never tell the user they are wrong");
      expect(prompt).toContain('Never refuse to proceed');
      expect(prompt).toContain('Never stack multiple questions in one turn');
      expect(prompt).toContain('Never lecture');
    }
  });

  it('always requires Product .Club as a validation channel option', () => {
    for (const mode of ['quick_prototype', 'strategic_bet'] as const) {
      const prompt = buildChatSystemPrompt(mode);
      expect(prompt).toContain('Product .Club');
      expect(prompt).toContain(PRODUCT_CLUB_URL);
      expect(prompt).toMatch(/never push it as the only option/i);
    }
  });

  it('lists exactly the four extraction targets', () => {
    for (const mode of ['quick_prototype', 'strategic_bet'] as const) {
      const prompt = buildChatSystemPrompt(mode);
      expect(prompt).toContain('Pain point + who feels it');
      expect(prompt).toContain('Current workaround + why it falls short');
      expect(prompt).toContain('Proposed solution sketch');
      expect(prompt).toContain('Who they could test with');
    }
  });

  it('substitutes a different mode block for quick_prototype vs strategic_bet', () => {
    const quick = buildChatSystemPrompt('quick_prototype');
    const strat = buildChatSystemPrompt('strategic_bet');
    expect(quick).not.toBe(strat);
    expect(quick).toContain('smallest possible testable thing');
    expect(strat).toContain('real product investment');
  });

  it('asks the model to emit the hidden AREAS_COVERED status tag', () => {
    const prompt = buildChatSystemPrompt('quick_prototype');
    expect(prompt).toContain('<<<AREAS_COVERED:');
    expect(prompt).toContain('pain_and_user');
    expect(prompt).toContain('workaround_and_gap');
    expect(prompt).toContain('solution_sketch');
    expect(prompt).toContain('validation_channel');
  });
});

describe('parseAreasTag', () => {
  it('parses the canonical tag', () => {
    const msg = "Sounds great. \n<<<AREAS_COVERED:pain_and_user,solution_sketch>>>";
    expect(parseAreasTag(msg)).toEqual(['pain_and_user', 'solution_sketch']);
  });

  it('handles an empty tag', () => {
    expect(parseAreasTag('Hi.\n<<<AREAS_COVERED:>>>')).toEqual([]);
  });

  it('returns empty when the tag is missing', () => {
    expect(parseAreasTag('Just a regular message.')).toEqual([]);
  });

  it('drops unknown area names and dedupes', () => {
    const msg = '<<<AREAS_COVERED:pain_and_user, totally_made_up , pain_and_user>>>';
    expect(parseAreasTag(msg)).toEqual(['pain_and_user']);
  });

  it('is tolerant of whitespace inside the list', () => {
    const msg = '<<<AREAS_COVERED:pain_and_user , workaround_and_gap >>>';
    expect(parseAreasTag(msg)).toEqual(['pain_and_user', 'workaround_and_gap']);
  });
});

describe('stripAreasTag', () => {
  it('removes the tag and trims trailing whitespace', () => {
    const out = stripAreasTag('Hello there.\n<<<AREAS_COVERED:pain_and_user>>>');
    expect(out).toBe('Hello there.');
  });
  it('is a no-op when the tag is absent', () => {
    expect(stripAreasTag('Hello there.')).toBe('Hello there.');
  });
});

describe('evaluateReadiness', () => {
  it('returns ready=true when all four areas are tagged', () => {
    const r = evaluateReadiness(
      'Looks good!\n<<<AREAS_COVERED:pain_and_user,workaround_and_gap,solution_sketch,validation_channel>>>',
    );
    expect(r.ready).toBe(true);
    expect(r.covered).toEqual([
      'pain_and_user', 'workaround_and_gap', 'solution_sketch', 'validation_channel',
    ]);
    expect(r.missing).toEqual([]);
  });

  it('flags every area as missing when nothing has been gathered', () => {
    const r = evaluateReadiness('Tell me more.\n<<<AREAS_COVERED:>>>');
    expect(r.ready).toBe(false);
    expect(r.covered).toEqual([]);
    expect(r.missing).toEqual([
      'pain_and_user', 'workaround_and_gap', 'solution_sketch', 'validation_channel',
    ]);
  });

  it('falls back to the labelled summary block when the tag is missing', () => {
    const summary = `
Hypothesis: If we ship it, parents will use it.
Target user: New parents on shared accounts.
Current workaround: Spreadsheets and Venmo memos.
Why it falls short: Bookkeeping is reactive, not real-time.
Proposed test: Single page with two seeded households.
Validation channel: Product .Club + a parents Discord I run.
`;
    const r = evaluateReadiness(summary);
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('unions the tag and label sources (label fills gaps the tag misses)', () => {
    const message = `
Proposed test: A single-page demo seeded with mock data.
<<<AREAS_COVERED:pain_and_user>>>
`;
    const r = evaluateReadiness(message);
    expect(r.covered).toEqual(['pain_and_user', 'solution_sketch']);
  });

  it('treats labelled-but-empty fields as not covered', () => {
    const message = `
Hypothesis:
Target user:
<<<AREAS_COVERED:>>>
`;
    expect(evaluateReadiness(message).covered).toEqual([]);
  });
});

describe('buildGenerationPrompt', () => {
  const chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'assistant', content: "What's the rough idea?" },
    { role: 'user', content: 'A budgeting app for new parents on shared accounts.' },
    { role: 'assistant', content: `Hypothesis: If we ship it, parents will use it.
Target user: New parents on shared accounts.
Current workaround: Spreadsheets and Venmo memos.
Why it falls short: Reactive, not real-time.
Proposed test: A single-page demo with two seeded households.
Validation channel: Product .Club + a parents Discord.
<<<AREAS_COVERED:pain_and_user,workaround_and_gap,solution_sketch,validation_channel>>>` },
  ];

  it('includes the build-prompt template and the horizontal rule separator', () => {
    const prompt = buildGenerationPrompt({ mode: 'quick_prototype', chatHistory });
    expect(prompt).toContain('# Claude Code Build Prompt');
    expect(prompt).toContain('Copy everything below this line into Claude Code');
    expect(prompt).toContain('\n---\n');
  });

  it('always asks the validation plan to include the literal Product .Club URL', () => {
    for (const mode of ['quick_prototype', 'strategic_bet'] as const) {
      const prompt = buildGenerationPrompt({ mode, chatHistory });
      expect(prompt).toContain('Product .Club');
      expect(prompt).toContain(PRODUCT_CLUB_URL);
    }
  });

  it('uses the mode-specific stack default', () => {
    const quick = buildGenerationPrompt({ mode: 'quick_prototype', chatHistory });
    const strat = buildGenerationPrompt({ mode: 'strategic_bet',   chatHistory });
    expect(quick).toContain('No auth. No database');
    expect(strat).toContain('Clerk or NextAuth');
  });

  it('strips hidden AREAS_COVERED tags from the inlined chat history', () => {
    const prompt = buildGenerationPrompt({ mode: 'quick_prototype', chatHistory });
    expect(prompt).not.toContain('<<<AREAS_COVERED:');
  });

  it('adds an early-generation note + assumption-flag instruction when generateAnyway=true', () => {
    const prompt = buildGenerationPrompt({
      mode: 'quick_prototype',
      chatHistory,
      generateAnyway: true,
    });
    expect(prompt).toMatch(/clicked Generate before the interview was complete/i);
    expect(prompt).toContain('"Assumption:"');
  });

  it('omits the assumption-flag note in the normal (ready) generation path', () => {
    const prompt = buildGenerationPrompt({ mode: 'quick_prototype', chatHistory });
    expect(prompt).not.toMatch(/clicked Generate before the interview was complete/i);
  });

  it('contains no v1 PM-framing anti-examples', () => {
    const prompt = buildGenerationPrompt({ mode: 'strategic_bet', chatHistory });
    for (const frag of V1_ANTI_EXAMPLE_FRAGMENTS) {
      expect(prompt).not.toContain(frag);
    }
  });
});

describe('deriveSessionTitle', () => {
  it('returns the input as-is when short', () => {
    expect(deriveSessionTitle('Budgeting app for parents')).toBe('Budgeting app for parents');
  });
  it('truncates long inputs with an ellipsis', () => {
    const long = 'A budgeting app for new parents on shared accounts that nudges them when overdrafts loom and is a bit slick';
    const title = deriveSessionTitle(long);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith('…')).toBe(true);
  });
  it('collapses internal whitespace', () => {
    expect(deriveSessionTitle('  hello   world  ')).toBe('hello world');
  });
});
