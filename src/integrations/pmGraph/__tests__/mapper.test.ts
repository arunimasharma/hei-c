/**
 * mapper.test.ts
 *
 * Unit tests for mapFrictionCaseToPMGraphRequest.
 *
 * Coverage:
 *  1. exercise_type is always 'friction_case'
 *  2. theme → surface mapping for all five themes
 *  3. answers encoding: root_issue + fix_recommendation keys
 *  4. reflection included only when non-empty
 *  5. productName / productContext forwarded only when present
 *  6. submissionId: passed through when given, auto-generated when absent
 *  7. scenario_text composed from context + narrative + rawResponse
 *  8. defaults: difficulty = 'intermediate', seniority = 'mid'
 *  9. option label fallback when index is out of range
 */

import { describe, it, expect } from 'vitest';
import {
  mapFrictionCaseToPMGraphRequest,
  type HEQFrictionCaseSubmission,
} from '../mapper';

// ── Fixture ───────────────────────────────────────────────────────────────────

const BASE_SUBMISSION: HEQFrictionCaseSubmission = {
  caseId:           'fc_001',
  submissionId:     'is_1234_abcd',
  theme:            'pricing',
  context:          'Pricing page — cursor moved toward browser chrome',
  narrative:        'User landed on pricing after clicking "Upgrade".',
  rawResponse:      'Too expensive',
  rootIssueOptions: [
    'Price is objectively above market',
    'Value before paywall is unclear',
    'No free-trial option',
    'Pricing page layout confusing',
  ],
  rootAnswerIndex:  1,
  fixOptions: [
    'Cut price by 25%',
    'Add social proof above pricing tiers',
    'Add 7-day free trial',
    'Redesign pricing table',
  ],
  fixAnswerIndex:  1,
};

function make(overrides: Partial<HEQFrictionCaseSubmission> = {}): HEQFrictionCaseSubmission {
  return { ...BASE_SUBMISSION, ...overrides };
}

// ── 1. exercise_type ──────────────────────────────────────────────────────────

describe('exercise_type', () => {
  it('is always friction_case', () => {
    const result = mapFrictionCaseToPMGraphRequest(make());
    expect(result.exercise_type).toBe('friction_case');
  });
});

// ── 2. Theme → surface mapping ────────────────────────────────────────────────

describe('theme → surface mapping', () => {
  const cases: Array<[HEQFrictionCaseSubmission['theme'], string]> = [
    ['pricing',    'pricing_page'],
    ['ux',         'product_ux'],
    ['onboarding', 'onboarding_flow'],
    ['value',      'value_proposition'],
    ['trust',      'trust_and_safety'],
  ];

  for (const [theme, expectedSurface] of cases) {
    it(`maps theme '${theme}' to surface '${expectedSurface}'`, () => {
      const result = mapFrictionCaseToPMGraphRequest(make({ theme }));
      expect(result.surface).toBe(expectedSurface);
    });
  }
});

// ── 3. Answers encoding ───────────────────────────────────────────────────────

describe('answers encoding', () => {
  it('uses root_issue key for the selected root issue option label', () => {
    const result = mapFrictionCaseToPMGraphRequest(make({ rootAnswerIndex: 1 }));
    expect(result.answers).toMatchObject({
      root_issue: 'Value before paywall is unclear',
    });
  });

  it('uses fix_recommendation key for the selected fix option label', () => {
    const result = mapFrictionCaseToPMGraphRequest(make({ fixAnswerIndex: 2 }));
    expect(result.answers).toMatchObject({
      fix_recommendation: 'Add 7-day free trial',
    });
  });

  it('sets answers (not answer_text) — multi-part form', () => {
    const result = mapFrictionCaseToPMGraphRequest(make());
    expect(result.answers).toBeDefined();
    expect(result.answer_text).toBeUndefined();
  });
});

// ── 4. Reflection ─────────────────────────────────────────────────────────────

describe('reflectionText', () => {
  it('is included in answers.reflection when non-empty', () => {
    const result = mapFrictionCaseToPMGraphRequest(
      make({ reflectionText: 'I focused on UX clarity.' }),
    );
    expect((result.answers as Record<string, string>).reflection).toBe(
      'I focused on UX clarity.',
    );
  });

  it('is omitted from answers when absent', () => {
    const result = mapFrictionCaseToPMGraphRequest(make({ reflectionText: undefined }));
    expect((result.answers as Record<string, string>).reflection).toBeUndefined();
  });

  it('is omitted from answers when blank/whitespace', () => {
    const result = mapFrictionCaseToPMGraphRequest(make({ reflectionText: '   ' }));
    expect((result.answers as Record<string, string>).reflection).toBeUndefined();
  });
});

// ── 5. Product fields ─────────────────────────────────────────────────────────

describe('product fields', () => {
  it('includes product_name when provided', () => {
    const result = mapFrictionCaseToPMGraphRequest(make({ productName: 'Acme SaaS' }));
    expect(result.product_name).toBe('Acme SaaS');
  });

  it('includes product_context when provided', () => {
    const result = mapFrictionCaseToPMGraphRequest(
      make({ productContext: 'B2B analytics tool' }),
    );
    expect(result.product_context).toBe('B2B analytics tool');
  });

  it('omits product_name when not provided', () => {
    const result = mapFrictionCaseToPMGraphRequest(make({ productName: undefined }));
    expect(result.product_name).toBeUndefined();
  });

  it('omits product_context when not provided', () => {
    const result = mapFrictionCaseToPMGraphRequest(make({ productContext: undefined }));
    expect(result.product_context).toBeUndefined();
  });
});

// ── 6. Submission ID ──────────────────────────────────────────────────────────

describe('hello_eq_submission_id', () => {
  it('passes through submissionId when provided', () => {
    const result = mapFrictionCaseToPMGraphRequest(make({ submissionId: 'is_999_xyz' }));
    expect(result.hello_eq_submission_id).toBe('is_999_xyz');
  });

  it('auto-generates an ID when submissionId is absent', () => {
    const result = mapFrictionCaseToPMGraphRequest(make({ submissionId: undefined }));
    expect(result.hello_eq_submission_id).toMatch(/^auto_fc_001_\d+$/);
  });
});

// ── 7. scenario_text ──────────────────────────────────────────────────────────

describe('scenario_text', () => {
  it('contains context, rawResponse, and narrative', () => {
    const result = mapFrictionCaseToPMGraphRequest(make());
    expect(result.scenario_text).toContain('Pricing page — cursor moved toward browser chrome');
    expect(result.scenario_text).toContain('"Too expensive"');
    expect(result.scenario_text).toContain('User landed on pricing after clicking "Upgrade".');
  });
});

// ── 8. Defaults ───────────────────────────────────────────────────────────────

describe('defaults', () => {
  it('sets difficulty to intermediate', () => {
    expect(mapFrictionCaseToPMGraphRequest(make()).difficulty).toBe('intermediate');
  });

  it('sets seniority to mid', () => {
    expect(mapFrictionCaseToPMGraphRequest(make()).seniority).toBe('mid');
  });

  it('sets hello_eq_exercise_id to caseId', () => {
    expect(mapFrictionCaseToPMGraphRequest(make()).hello_eq_exercise_id).toBe('fc_001');
  });
});

// ── 9. Out-of-range option label fallback ─────────────────────────────────────

describe('option label fallback', () => {
  it('falls back to positional label when rootAnswerIndex is out of range', () => {
    const result = mapFrictionCaseToPMGraphRequest(
      make({ rootIssueOptions: ['Only option'], rootAnswerIndex: 5 }),
    );
    expect((result.answers as Record<string, string>).root_issue).toBe('Option 6');
  });

  it('falls back to positional label when fixAnswerIndex is out of range', () => {
    const result = mapFrictionCaseToPMGraphRequest(
      make({ fixOptions: ['Only option'], fixAnswerIndex: 3 }),
    );
    expect((result.answers as Record<string, string>).fix_recommendation).toBe('Option 4');
  });
});
