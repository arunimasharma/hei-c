/**
 * FrictionCaseExercise
 * "Real Friction Cases" — PM insight simulator + validator
 *
 * Flow: browse → analyze (root issue MCQ → fix MCQ) → reveal → done
 *   browse:  filter by theme, pick a case card
 *   analyze: 2-step MCQ (root issue → fix recommendation)
 *   reveal:  accuracy score + real-data insight explanation
 *   done:    save score to InsightStore → feeds /influence credibility
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, Target, Zap, CheckCircle2, XCircle,
  ArrowRight, RefreshCw, TrendingUp, Filter, FlaskConical,
} from 'lucide-react';
import { FRICTION_CASES, THEME_LABELS, type FrictionCase, type FrictionTheme } from '../../data/frictionCases';
import { InsightStore } from '../../lib/InsightStore';

const GRAD = 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)';
const PRIMARY = '#7C3AED';

const TRIGGER_LABEL: Record<string, string> = {
  exit_intent:  '🚪 Exit intent',
  time_stall:   '⏱ Time stall',
  scroll_stall: '📜 Scroll stall',
  no_action:    '💤 No action',
};

type Phase = 'browse' | 'root_issue' | 'fix' | 'reveal' | 'done';

interface Props {
  onBack: () => void;
  onStartTaste?: () => void;
}

export default function FrictionCaseExercise({ onBack, onStartTaste }: Props) {
  const [phase, setPhase] = useState<Phase>('browse');
  const [themeFilter, setThemeFilter] = useState<FrictionTheme | 'all'>('all');
  const [activeCase, setActiveCase] = useState<FrictionCase | null>(null);
  const [rootAnswer, setRootAnswer] = useState<number | null>(null);
  const [fixAnswer, setFixAnswer] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const filteredCases = useMemo(() =>
    themeFilter === 'all'
      ? FRICTION_CASES
      : FRICTION_CASES.filter(c => c.theme === themeFilter),
  [themeFilter]);

  const score = useMemo(() => {
    if (rootAnswer === null || fixAnswer === null || !activeCase) return 0;
    const root = rootAnswer === activeCase.correctRootIssueIndex ? 0.5 : 0;
    const fix  = fixAnswer  === activeCase.correctFixIndex        ? 0.5 : 0;
    return root + fix;
  }, [rootAnswer, fixAnswer, activeCase]);

  const handleSelectCase = (c: FrictionCase) => {
    setActiveCase(c);
    setRootAnswer(null);
    setFixAnswer(null);
    setSavedId(null);
    setPhase('root_issue');
  };

  const handleConfirmRoot = () => {
    if (rootAnswer === null) return;
    setPhase('fix');
  };

  const handleConfirmFix = () => {
    if (fixAnswer === null) return;
    setPhase('reveal');
  };

  const handleSave = () => {
    if (!activeCase || rootAnswer === null || fixAnswer === null) return;
    const submission = InsightStore.submit({
      caseId: activeCase.id,
      theme: activeCase.theme,
      rootIssueCorrect: rootAnswer === activeCase.correctRootIssueIndex,
      fixCorrect: fixAnswer === activeCase.correctFixIndex,
      score,
    });
    setSavedId(submission.id);
    setPhase('done');
  };

  const handleNext = () => {
    setActiveCase(null);
    setPhase('browse');
  };

  const topBarSubtitle = {
    browse:     'Pick a case to analyse',
    root_issue: activeCase ? `${THEME_LABELS[activeCase.theme].emoji} ${THEME_LABELS[activeCase.theme].label}` : '',
    fix:        'Recommend a fix',
    reveal:     'Real-data insight',
    done:       'Score saved',
  }[phase];

  // ── SCORE DISPLAY ─────────────────────────────────────────────────────────────
  const scoreLabel = score === 1 ? 'Perfect read' : score === 0.5 ? 'Half right' : 'Learning moment';
  const scoreColor = score === 1 ? '#16A34A' : score === 0.5 ? '#D97706' : '#DC2626';
  const scoreBg    = score === 1 ? '#F0FDF4'  : score === 0.5 ? '#FFFBEB'  : '#FEF2F2';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8F9FE', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ background: GRAD, padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={phase === 'browse' ? onBack : () => setPhase('browse')}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <ChevronLeft size={18} color="white" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: 'white' }}>Real Friction Cases</p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)' }}>{topBarSubtitle}</p>
        </div>
        {phase === 'browse' && (
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', padding: '0.25rem 0.625rem', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.15)' }}>
            {filteredCases.length} case{filteredCases.length !== 1 ? 's' : ''}
          </span>
        )}
        {phase !== 'browse' && activeCase && (
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', padding: '0.25rem 0.625rem', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.15)' }}>
            {TRIGGER_LABEL[activeCase.trigger]}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', maxWidth: '640px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <AnimatePresence mode="wait">

          {/* ── BROWSE ──────────────────────────────────────────────────────── */}
          {phase === 'browse' && (
            <motion.div key="browse" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

              {/* Theme filter chips */}
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
                <Filter size={13} color="#9CA3AF" />
                {(['all', 'pricing', 'ux', 'onboarding', 'value', 'trust'] as const).map(t => {
                  const active = themeFilter === t;
                  const meta = t !== 'all' ? THEME_LABELS[t] : null;
                  return (
                    <button
                      key={t}
                      onClick={() => setThemeFilter(t)}
                      style={{ padding: '0.3rem 0.75rem', borderRadius: '999px', border: 'none', fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s', backgroundColor: active ? (meta?.color ?? PRIMARY) : '#F3F4F6', color: active ? 'white' : '#6B7280' }}
                    >
                      {meta ? `${meta.emoji} ${meta.label}` : 'All'}
                    </button>
                  );
                })}
              </div>

              {/* Case cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredCases.map(c => {
                  const meta = THEME_LABELS[c.theme];
                  const profile = InsightStore.getProfile();
                  const already = profile.domainAccuracy[c.theme];
                  const done = InsightStore.getAll().some(s => s.caseId === c.id);
                  return (
                    <motion.button
                      key={c.id}
                      whileHover={{ y: -1 }}
                      onClick={() => handleSelectCase(c)}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', padding: '1rem 1.125rem', borderRadius: '14px', border: `1px solid ${done ? '#D1FAE5' : '#E5E7EB'}`, backgroundColor: done ? '#F0FDF4' : 'white', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'all 0.15s' }}
                    >
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem' }}>
                        {meta.emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{meta.label}</span>
                          <span style={{ fontSize: '0.7rem', color: '#9CA3AF', fontWeight: 500 }}>{TRIGGER_LABEL[c.trigger]}</span>
                          {done && <span style={{ fontSize: '0.7rem', color: '#16A34A', fontWeight: 600 }}>✓ Done</span>}
                        </div>
                        <p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>{c.context}</p>
                        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.5 }}>"{c.rawResponse}"</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF' }}>{c.signalStrength}% agree</span>
                        <ArrowRight size={14} color="#9CA3AF" />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── ROOT ISSUE MCQ ───────────────────────────────────────────────── */}
          {phase === 'root_issue' && activeCase && (
            <motion.div key="root" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Case summary */}
              <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #E5E7EB', padding: '1rem 1.125rem', marginBottom: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <p style={{ margin: '0 0 0.375rem', fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>The friction signal</p>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', lineHeight: 1.5 }}>{activeCase.context}</p>
                <div style={{ padding: '0.625rem 0.875rem', borderRadius: '10px', backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>What the user said</p>
                  <p style={{ margin: 0, fontSize: '0.9375rem', color: '#374151', fontStyle: 'italic' }}>"{activeCase.rawResponse}"</p>
                </div>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.5 }}>{activeCase.narrative}</p>
              </div>

              <p style={{ margin: '0 0 0.75rem', fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>
                What's the root issue here?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {activeCase.rootIssueOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setRootAnswer(i)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderRadius: '12px', border: 'none', outline: rootAnswer === i ? `2px solid ${PRIMARY}` : '2px solid transparent', backgroundColor: rootAnswer === i ? '#F5F3FF' : 'white', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', transition: 'all 0.15s' }}
                  >
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${rootAnswer === i ? PRIMARY : '#D1D5DB'}`, backgroundColor: rootAnswer === i ? PRIMARY : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                      {rootAnswer === i && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'white' }} />}
                    </div>
                    <span style={{ fontSize: '0.875rem', color: rootAnswer === i ? '#1F2937' : '#374151', lineHeight: 1.5, fontWeight: rootAnswer === i ? 500 : 400 }}>{opt}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={handleConfirmRoot}
                disabled={rootAnswer === null}
                style={{ width: '100%', padding: '0.875rem', borderRadius: '14px', border: 'none', background: rootAnswer === null ? '#E5E7EB' : GRAD, color: rootAnswer === null ? '#9CA3AF' : 'white', fontSize: '0.9375rem', fontWeight: 700, cursor: rootAnswer === null ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                Next: Recommend a fix <ArrowRight size={17} />
              </button>
            </motion.div>
          )}

          {/* ── FIX MCQ ─────────────────────────────────────────────────────── */}
          {phase === 'fix' && activeCase && (
            <motion.div key="fix" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div style={{ backgroundColor: '#F5F3FF', borderRadius: '12px', padding: '0.875rem 1rem', marginBottom: '1.25rem', border: '1px solid #EDE9FE' }}>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.7rem', fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Your root issue</p>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>{rootAnswer !== null ? activeCase.rootIssueOptions[rootAnswer] : '—'}</p>
              </div>

              <p style={{ margin: '0 0 0.75rem', fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>
                What would you fix first?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {activeCase.fixOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setFixAnswer(i)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderRadius: '12px', border: 'none', outline: fixAnswer === i ? `2px solid ${PRIMARY}` : '2px solid transparent', backgroundColor: fixAnswer === i ? '#F5F3FF' : 'white', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', transition: 'all 0.15s' }}
                  >
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${fixAnswer === i ? PRIMARY : '#D1D5DB'}`, backgroundColor: fixAnswer === i ? PRIMARY : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                      {fixAnswer === i && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'white' }} />}
                    </div>
                    <span style={{ fontSize: '0.875rem', color: fixAnswer === i ? '#1F2937' : '#374151', lineHeight: 1.5, fontWeight: fixAnswer === i ? 500 : 400 }}>{opt}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={handleConfirmFix}
                disabled={fixAnswer === null}
                style={{ width: '100%', padding: '0.875rem', borderRadius: '14px', border: 'none', background: fixAnswer === null ? '#E5E7EB' : GRAD, color: fixAnswer === null ? '#9CA3AF' : 'white', fontSize: '0.9375rem', fontWeight: 700, cursor: fixAnswer === null ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                See what real data shows <Zap size={17} />
              </button>
            </motion.div>
          )}

          {/* ── REVEAL ──────────────────────────────────────────────────────── */}
          {phase === 'reveal' && activeCase && rootAnswer !== null && fixAnswer !== null && (
            <motion.div key="reveal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Accuracy score */}
              <div style={{ backgroundColor: scoreBg, border: `1px solid ${scoreColor}33`, borderRadius: '14px', padding: '1rem 1.125rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: scoreColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>{Math.round(score * 100)}%</span>
                </div>
                <div>
                  <p style={{ margin: '0 0 0.125rem', fontWeight: 700, fontSize: '0.9375rem', color: scoreColor }}>{scoreLabel}</p>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6B7280' }}>
                    {rootAnswer === activeCase.correctRootIssueIndex ? '✓ Root issue' : '✗ Root issue'} &nbsp;·&nbsp;
                    {fixAnswer === activeCase.correctFixIndex ? '✓ Fix' : '✗ Fix'}
                  </p>
                </div>
              </div>

              {/* Answer breakdown */}
              <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: '1.25rem' }}>
                {/* Root issue */}
                <div style={{ padding: '0.875rem 1.125rem', borderBottom: '1px solid #F3F4F6' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Root Issue</p>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: rootAnswer !== activeCase.correctRootIssueIndex ? '0.5rem' : 0 }}>
                    {rootAnswer === activeCase.correctRootIssueIndex
                      ? <CheckCircle2 size={16} color="#16A34A" style={{ flexShrink: 0, marginTop: '1px' }} />
                      : <XCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: '1px' }} />}
                    <span style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>{activeCase.rootIssueOptions[rootAnswer]}</span>
                  </div>
                  {rootAnswer !== activeCase.correctRootIssueIndex && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', paddingLeft: '0.25rem' }}>
                      <CheckCircle2 size={16} color="#16A34A" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ fontSize: '0.875rem', color: '#16A34A', fontWeight: 500, lineHeight: 1.5 }}>{activeCase.rootIssueOptions[activeCase.correctRootIssueIndex]}</span>
                    </div>
                  )}
                </div>

                {/* Fix */}
                <div style={{ padding: '0.875rem 1.125rem' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fix Recommendation</p>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: fixAnswer !== activeCase.correctFixIndex ? '0.5rem' : 0 }}>
                    {fixAnswer === activeCase.correctFixIndex
                      ? <CheckCircle2 size={16} color="#16A34A" style={{ flexShrink: 0, marginTop: '1px' }} />
                      : <XCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: '1px' }} />}
                    <span style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>{activeCase.fixOptions[fixAnswer]}</span>
                  </div>
                  {fixAnswer !== activeCase.correctFixIndex && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <CheckCircle2 size={16} color="#16A34A" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ fontSize: '0.875rem', color: '#16A34A', fontWeight: 500, lineHeight: 1.5 }}>{activeCase.fixOptions[activeCase.correctFixIndex]}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Real data insight */}
              <div style={{ backgroundColor: '#F5F3FF', borderRadius: '14px', border: '1px solid #EDE9FE', padding: '1rem 1.125rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <TrendingUp size={14} color={PRIMARY} />
                  <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>What real data shows</p>
                </div>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#374151', lineHeight: 1.65 }}>{activeCase.realDataInsight}</p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', padding: '0.2rem 0.625rem', borderRadius: '999px', backgroundColor: 'white', border: '1px solid #E5E7EB' }}>
                    {activeCase.signalStrength}% of users signalled this
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', padding: '0.2rem 0.625rem', borderRadius: '999px', backgroundColor: 'white', border: '1px solid #E5E7EB' }}>
                    {activeCase.pmAgreementRate}% of PMs got this right
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.625rem' }}>
                {savedId === null ? (
                  <button
                    onClick={handleSave}
                    style={{ flex: 1, padding: '0.875rem', borderRadius: '14px', border: 'none', background: GRAD, color: 'white', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <Target size={17} /> Save to Influence Score
                  </button>
                ) : (
                  <div style={{ flex: 1, padding: '0.875rem', borderRadius: '14px', backgroundColor: '#F0FDF4', color: '#16A34A', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={15} /> Saved to your influence profile
                  </div>
                )}
                <button
                  onClick={handleNext}
                  style={{ padding: '0.875rem 1rem', borderRadius: '14px', border: '1.5px solid #EDE9FE', backgroundColor: 'white', color: PRIMARY, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                >
                  <RefreshCw size={15} /> Next case
                </button>
              </div>
            </motion.div>
          )}

          {/* ── DONE (after save) ────────────────────────────────────────────── */}
          {phase === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ textAlign: 'center', paddingTop: '2rem' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', boxShadow: '0 8px 24px rgba(124,58,237,0.25)' }}>
                <Zap size={32} color="white" />
              </div>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#111827', margin: '0 0 0.5rem' }}>Insight scored!</h2>
              <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.6, margin: '0 auto 1.5rem', maxWidth: '360px' }}>
                Your score has been added to your credibility profile on the Influence page.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', maxWidth: '320px', margin: '0 auto' }}>
                <button
                  onClick={handleNext}
                  style={{ padding: '0.875rem', borderRadius: '14px', border: 'none', background: GRAD, color: 'white', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <RefreshCw size={17} /> Try another case
                </button>
                {onStartTaste && (
                  <button
                    onClick={onStartTaste}
                    style={{ padding: '0.875rem', borderRadius: '14px', border: '1.5px solid #EDE9FE', backgroundColor: 'white', color: PRIMARY, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <FlaskConical size={17} /> Analyse a product next
                  </button>
                )}
                <button
                  onClick={onBack}
                  style={{ padding: '0.875rem', borderRadius: '14px', border: '1px solid #F3F4F6', backgroundColor: 'transparent', color: '#9CA3AF', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Back to exercises
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
