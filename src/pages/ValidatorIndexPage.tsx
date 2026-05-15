import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Sparkles, Trash2, FileText, MessageSquare, CheckCircle2, HelpCircle, X } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  listSessions,
  softDeleteSession,
  listOutcomePromptCandidates,
  OUTCOME_PROMPT_AGE_DAYS,
} from '../services/validatorClient';
import { trackOutcomePromptShown } from '../services/validatorAnalytics';
import type { ValidatorSession, OutcomeHypothesis } from '../types/validator';

const NUDGE_DISMISS_KEY = 'hei.validator.outcomeNudgeDismissedAt.v1';
/** How long the index nudge stays hidden after the user dismisses it. */
const NUDGE_HIDE_MS = 24 * 60 * 60 * 1000;

export default function ValidatorIndexPage() {
  return (
    <DashboardLayout>
      <ValidatorIndexInner />
    </DashboardLayout>
  );
}

function ValidatorIndexInner() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ValidatorSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcomeCandidates, setOutcomeCandidates] = useState<ValidatorSession[]>([]);
  const [nudgeDismissed, setNudgeDismissed] = useState<boolean>(() => isNudgeDismissed());

  useEffect(() => {
    let cancelled = false;
    Promise.all([listSessions(), listOutcomePromptCandidates()])
      .then(([all, candidates]) => {
        if (cancelled) return;
        setSessions(all);
        setOutcomeCandidates(candidates);
        if (candidates.length > 0 && !isNudgeDismissed()) {
          trackOutcomePromptShown({ surface: 'index', sessionCount: candidates.length });
        }
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load sessions.'); });
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    try {
      await softDeleteSession(id);
      setSessions(prev => (prev ?? []).filter(s => s.id !== id));
      setOutcomeCandidates(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete.');
    }
  };

  const dismissNudge = () => {
    try { localStorage.setItem(NUDGE_DISMISS_KEY, new Date().toISOString()); } catch { /* ignore */ }
    setNudgeDismissed(true);
  };

  const showNudge = !nudgeDismissed && outcomeCandidates.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.01em' }}>
          Idea Validator
        </h1>
        <p style={{ fontSize: '0.9375rem', color: '#6B7280', margin: 0, lineHeight: 1.6, maxWidth: '46rem' }}>
          Turn a rough idea into a hypothesis and a paste-ready build prompt for a coding agent.
          Pick <strong>Quick prototype</strong> if you want the smallest testable thing fast, or <strong>Strategic bet</strong> if
          stakeholders or budget are on the line.
        </p>
      </header>

      <Card style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Sparkles size={20} color="#4A5FC1" />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>
            Start a new validation
          </h2>
        </div>
        <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
          One question at a time. After 5–7 messages you can generate a hypothesis summary plus a
          paste-ready Claude Code build prompt for the smallest version that would test it.
        </p>
        <div>
          <Button onClick={() => navigate('/validator/new')}>
            Start interview
          </Button>
        </div>
      </Card>

      {showNudge && (
        <WhatHappenedSection candidates={outcomeCandidates} onDismiss={dismissNudge} />
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#374151', margin: 0 }}>
          Recent sessions
        </h2>

        {error && (
          <Card style={{ padding: '1rem', borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }}>
            <p style={{ margin: 0, color: '#B91C1C', fontSize: '0.875rem' }}>{error}</p>
          </Card>
        )}

        {sessions === null && !error && <LoadingSpinner />}

        {sessions !== null && sessions.length === 0 && (
          <Card style={{ padding: '1.25rem' }}>
            <p style={{ margin: 0, color: '#6B7280', fontSize: '0.875rem' }}>
              No sessions yet. Start one above.
            </p>
          </Card>
        )}

        {sessions !== null && sessions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {sessions.map(s => (
              <SessionRow key={s.id} session={s} onDelete={() => handleDelete(s.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface SessionRowProps {
  session: ValidatorSession;
  onDelete: () => void;
}

function SessionRow({ session, onDelete }: SessionRowProps) {
  const date = new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const hasDoc = session.generatedDoc !== null;

  return (
    <Card style={{ padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            to={`/validator/${session.id}`}
            style={{
              display: 'block', textDecoration: 'none', color: '#1F2937',
              fontWeight: 600, fontSize: '0.9375rem',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {session.title || 'Untitled idea'}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginTop: '0.25rem', fontSize: '0.75rem', color: '#9CA3AF', flexWrap: 'wrap' }}>
            <span style={{
              padding: '0.125rem 0.5rem', borderRadius: '999px',
              backgroundColor: session.mode === 'quick_prototype' ? '#EDE9FE' : '#DBEAFE',
              color:           session.mode === 'quick_prototype' ? '#6D28D9' : '#1D4ED8',
              fontWeight: 600,
            }}>
              {session.mode === 'quick_prototype' ? 'Quick prototype' : 'Strategic bet'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {hasDoc ? <FileText size={12} /> : <MessageSquare size={12} />}
              {hasDoc ? 'Doc generated' : 'In progress'}
            </span>
            {session.outcome && <OutcomeBadge hypothesis={session.outcome.hypothesisHeld} />}
            <span>{date}</span>
          </div>
        </div>
        <button
          onClick={onDelete}
          aria-label="Delete session"
          style={{
            padding: '0.5rem', borderRadius: '8px', border: 'none',
            backgroundColor: 'transparent', cursor: 'pointer', color: '#9CA3AF',
            display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.backgroundColor = '#FEF2F2'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </Card>
  );
}

function OutcomeBadge({ hypothesis }: { hypothesis: OutcomeHypothesis }) {
  const palette: Record<OutcomeHypothesis, { bg: string; fg: string; label: string }> = {
    held:         { bg: '#ECFDF5', fg: '#059669', label: 'Tested · hypothesis held' },
    partly:       { bg: '#FFFBEB', fg: '#B45309', label: 'Tested · partly held' },
    broke:        { bg: '#FEF2F2', fg: '#B91C1C', label: 'Tested · broke' },
    inconclusive: { bg: '#F3F4F6', fg: '#374151', label: 'Tested · inconclusive' },
  };
  const c = palette[hypothesis];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.125rem 0.5rem', borderRadius: '999px',
      backgroundColor: c.bg, color: c.fg, fontWeight: 600,
    }}>
      <CheckCircle2 size={10} /> {c.label}
    </span>
  );
}

// ── "What happened?" nudge ────────────────────────────────────────────────────

function WhatHappenedSection({ candidates, onDismiss }: { candidates: ValidatorSession[]; onDismiss: () => void }) {
  // Show up to 5 to avoid overwhelming the page; if more exist, surface the count.
  const visible = useMemo(() => candidates.slice(0, 5), [candidates]);
  const moreCount = candidates.length - visible.length;
  return (
    <Card style={{
      padding: '1.25rem 1.5rem',
      backgroundColor: '#FFFBEB',
      border: '1px solid #FCD34D',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <HelpCircle size={20} color="#B45309" style={{ marginTop: '0.125rem', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#92400E' }}>
              What happened?
            </h3>
            <button
              onClick={onDismiss}
              aria-label="Dismiss for today"
              style={{
                marginLeft: 'auto', border: 'none', background: 'transparent',
                cursor: 'pointer', color: '#9CA3AF', padding: '0.25rem',
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
          <p style={{ margin: '0.25rem 0 0.875rem', fontSize: '0.875rem', color: '#78350F', lineHeight: 1.55 }}>
            These briefs were generated more than {OUTCOME_PROMPT_AGE_DAYS} days ago. Take 30 seconds to log the outcome —
            future-you (and your taste) will thank you.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {visible.map(s => <NudgeRow key={s.id} session={s} />)}
            {moreCount > 0 && (
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#92400E' }}>
                …and {moreCount} more older session{moreCount === 1 ? '' : 's'}.
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function NudgeRow({ session }: { session: ValidatorSession }) {
  const when = session.docGeneratedAt
    ? new Date(session.docGeneratedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  return (
    <Link
      to={`/validator/${session.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.5rem 0.75rem', borderRadius: '10px',
        backgroundColor: 'rgba(255,255,255,0.6)',
        textDecoration: 'none', color: '#1F2937', fontSize: '0.875rem', fontWeight: 500,
      }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {session.title || 'Untitled idea'}
      </span>
      <span style={{ fontSize: '0.6875rem', color: '#92400E', fontWeight: 600 }}>{when}</span>
    </Link>
  );
}

function isNudgeDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const raw = localStorage.getItem(NUDGE_DISMISS_KEY);
    if (!raw) return false;
    const when = Date.parse(raw);
    if (!isFinite(when)) return false;
    return Date.now() - when < NUDGE_HIDE_MS;
  } catch {
    return false;
  }
}
