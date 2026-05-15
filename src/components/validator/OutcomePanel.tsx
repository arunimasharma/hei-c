/**
 * OutcomePanel — Feature 3 "What happened?" logger.
 *
 * Entirely client-side; persists into localStorage via validatorClient.saveOutcome.
 * Two states:
 *   1. No outcome logged → CTA inviting the builder to log one.
 *   2. Outcome logged    → readable summary with an edit affordance.
 */

import { useState, useEffect, type FormEvent } from 'react';
import { PenLine, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import Card                  from '../common/Card';
import Button                from '../common/Button';
import Select                from '../common/Select';
import TextArea              from '../common/TextArea';
import { saveOutcome }       from '../../services/validatorClient';
import {
  trackOutcomeLogged,
  trackOutcomePromptShown,
}                            from '../../services/validatorAnalytics';
import type {
  OutcomeDidTest,
  OutcomeHypothesis,
  ValidatorOutcome,
  ValidatorSession,
}                            from '../../types/validator';

interface OutcomePanelProps {
  session:  ValidatorSession;
  onChange: (next: ValidatorSession) => void;
}

const DID_TEST_LABELS: Record<OutcomeDidTest, string> = {
  yes:         'Yes — I tested it',
  in_progress: 'In progress',
  no:          'No — I haven\'t tested',
};

const HYPOTHESIS_LABELS: Record<OutcomeHypothesis, string> = {
  held:         'Hypothesis held',
  partly:       'Partly held',
  broke:        'Broke — wrong assumption',
  inconclusive: 'Inconclusive',
};

export default function OutcomePanel({ session, onChange }: OutcomePanelProps) {
  const [editing, setEditing] = useState(false);
  const outcome = session.outcome;
  const hasDoc = session.generatedDoc !== null;

  // Fire the prompt-shown event once whenever this is the empty-state on a doc.
  useEffect(() => {
    if (hasDoc && !outcome) {
      trackOutcomePromptShown({ surface: 'session_page', sessionCount: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  if (!hasDoc) return null;

  if (!outcome || editing) {
    return (
      <OutcomeEditor
        existing={outcome}
        onCancel={outcome ? () => setEditing(false) : undefined}
        onSaved={next => {
          onChange({ ...session, outcome: next });
          setEditing(false);
        }}
        sessionId={session.id}
      />
    );
  }

  return <OutcomeSummary outcome={outcome} onEdit={() => setEditing(true)} />;
}

// ── Read state ────────────────────────────────────────────────────────────────

function OutcomeSummary({ outcome, onEdit }: { outcome: ValidatorOutcome; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <CheckCircle2 size={16} color="#059669" />
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1F2937' }}>How it went</h2>
        <span style={{
          marginLeft: 'auto',
          padding: '0.125rem 0.5rem', borderRadius: '999px',
          backgroundColor: '#ECFDF5', color: '#059669',
          fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          Logged
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <SummaryPill label={DID_TEST_LABELS[outcome.didTest]} />
        <SummaryPill label={HYPOTHESIS_LABELS[outcome.hypothesisHeld]} tone={hypothesisTone(outcome.hypothesisHeld)} />
      </div>

      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
          fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280',
          width: 'fit-content',
        }}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {open ? 'Hide notes' : 'Show notes'}
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <Field label="What I learned" body={outcome.whatLearned} />
          {outcome.nextStep && <Field label="Next step" body={outcome.nextStep} />}
        </div>
      )}

      <div>
        <Button onClick={onEdit} variant="ghost" size="sm">
          <PenLine size={14} /> Update outcome
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
        {label}
      </div>
      <p style={{ margin: 0, fontSize: '0.875rem', color: '#1F2937', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{body}</p>
    </div>
  );
}

function SummaryPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const palette = {
    neutral: { bg: '#F3F4F6', fg: '#374151' },
    good:    { bg: '#ECFDF5', fg: '#059669' },
    warn:    { bg: '#FFFBEB', fg: '#B45309' },
    bad:     { bg: '#FEF2F2', fg: '#B91C1C' },
  }[tone];
  return (
    <span style={{
      padding: '0.25rem 0.625rem', borderRadius: '999px',
      backgroundColor: palette.bg, color: palette.fg,
      fontSize: '0.75rem', fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

function hypothesisTone(h: OutcomeHypothesis): 'good' | 'warn' | 'bad' | 'neutral' {
  if (h === 'held')         return 'good';
  if (h === 'partly')       return 'warn';
  if (h === 'broke')        return 'bad';
  return 'neutral';
}

// ── Editor ────────────────────────────────────────────────────────────────────

function OutcomeEditor({
  existing, onSaved, onCancel, sessionId,
}: {
  existing?:  ValidatorOutcome | null;
  onSaved:    (next: ValidatorOutcome) => void;
  onCancel?:  () => void;
  sessionId:  string;
}) {
  const [didTest, setDidTest]            = useState<OutcomeDidTest | ''>(existing?.didTest ?? '');
  const [whatLearned, setWhatLearned]    = useState(existing?.whatLearned ?? '');
  const [hypothesis, setHypothesis]      = useState<OutcomeHypothesis | ''>(existing?.hypothesisHeld ?? '');
  const [nextStep, setNextStep]          = useState(existing?.nextStep ?? '');
  const [busy, setBusy]                  = useState(false);
  const [error, setError]                = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!didTest)                                          { setError('Pick whether you tested it.'); return; }
    if (!hypothesis)                                       { setError('Pick whether the hypothesis held.'); return; }
    if (!whatLearned.trim())                               { setError('Write at least a line about what you learned.'); return; }

    setBusy(true);
    try {
      const saved = await saveOutcome(sessionId, {
        didTest,
        whatLearned:    whatLearned.trim(),
        hypothesisHeld: hypothesis,
        nextStep:       nextStep.trim() || undefined,
      });
      trackOutcomeLogged({ sessionId, didTest, hypothesisHeld: hypothesis });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setBusy(false);
    }
  };

  const isEditing = Boolean(existing);

  return (
    <Card style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <PenLine size={16} color="#4A5FC1" />
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1F2937' }}>
          {isEditing ? 'Update outcome' : 'How did it go?'}
        </h2>
      </header>
      <p style={{ margin: 0, fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.55 }}>
        Future-you will thank present-you for closing the loop. Two clicks plus a line are enough.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Select
          label="Did you test it?"
          value={didTest}
          onChange={e => setDidTest(e.target.value as OutcomeDidTest | '')}
          placeholder="Pick one…"
          options={(Object.keys(DID_TEST_LABELS) as OutcomeDidTest[]).map(v => ({ value: v, label: DID_TEST_LABELS[v] }))}
        />
        <Select
          label="Did the hypothesis hold?"
          value={hypothesis}
          onChange={e => setHypothesis(e.target.value as OutcomeHypothesis | '')}
          placeholder="Pick one…"
          options={(Object.keys(HYPOTHESIS_LABELS) as OutcomeHypothesis[]).map(v => ({ value: v, label: HYPOTHESIS_LABELS[v] }))}
        />
        <TextArea
          label="What did you learn?"
          placeholder="One or two lines — the thing you wouldn't have known without trying."
          value={whatLearned}
          onChange={e => setWhatLearned(e.target.value)}
          maxLength={2000}
          rows={3}
        />
        <TextArea
          label="Next step (optional)"
          placeholder="Park, double down, pivot — whatever's next."
          value={nextStep}
          onChange={e => setNextStep(e.target.value)}
          maxLength={500}
          rows={2}
        />

        {error && (
          <div style={{
            padding: '0.5rem 0.75rem', borderRadius: '10px',
            backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5',
            color: '#B91C1C', fontSize: '0.8125rem',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button type="submit" disabled={busy} size="sm">
            {busy ? 'Saving…' : 'Save outcome'}
          </Button>
          {onCancel && (
            <Button type="button" onClick={onCancel} variant="ghost" size="sm">
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
