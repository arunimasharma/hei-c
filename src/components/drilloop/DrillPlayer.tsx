import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Loader2, ExternalLink, Sparkles, ListChecks, PenLine } from 'lucide-react';
import type { Drill, DrillGrade, SelfRating, FeedbackTag } from '../../types/drilloop';
import { gradeAnswer } from '../../services/drilloopGrading';
import { generateDrillMCQ, type DrillMCQ, type DrillMCQOption } from '../../services/drilloopAuthoring';
import Button from '../common/Button';
import Mirror from './Mirror';
import { DRILLOOP, DRILLOOP_DARK, DRILLOOP_SOFT, Pill, ProgressBar, TYPE_META, DIFFICULTY_META } from './shared';

interface DrillPlayerProps {
  drill: Drill;
  /** Called once the member has answered, been graded, and self-rated. */
  onComplete: (result: { answer: string; grade: DrillGrade; selfRating: SelfRating }) => void;
  onFeedback: (tag: FeedbackTag, note: string) => void;
  onNext: () => void;
  /** Label for the advance button, e.g. "Next drill" or "Back to today". */
  nextLabel: string;
}

type Stage = 'answering' | 'grading' | 'reviewing';

const FEEDBACK_OPTIONS: { tag: FeedbackTag; label: string; emoji: string }[] = [
  { tag: 'useful', label: 'Useful', emoji: '👍' },
  { tag: 'confusing', label: 'Confusing', emoji: '🤔' },
  { tag: 'too-easy', label: 'Too easy', emoji: '😴' },
  { tag: 'too-hard', label: 'Too hard', emoji: '🥵' },
];

export default function DrillPlayer({ drill, onComplete, onFeedback, onNext, nextLabel }: DrillPlayerProps) {
  const [stage, setStage] = useState<Stage>('answering');
  const [answer, setAnswer] = useState('');
  const [grade, setGrade] = useState<DrillGrade | null>(null);
  const [selfRating, setSelfRating] = useState<SelfRating | null>(null);
  const [committed, setCommitted] = useState(false);
  const [fbTag, setFbTag] = useState<FeedbackTag | null>(null);
  const [fbNote, setFbNote] = useState('');
  const [fbSent, setFbSent] = useState(false);
  const [mode, setMode] = useState<'write' | 'mcq'>('write');
  const [mcqAnswered, setMcqAnswered] = useState(false);

  const tm = TYPE_META[drill.type];
  const dm = DIFFICULTY_META[drill.difficulty];

  const submit = async () => {
    setStage('grading');
    const g = await gradeAnswer(drill, answer);
    setGrade(g);
    setStage('reviewing');
  };

  // Record an MCQ selection as a completed attempt so it counts toward progress.
  const handleMcqAnswered = (opt: DrillMCQOption, mcq: DrillMCQ) => {
    const correct = mcq.options.find(o => o.correct) ?? opt;
    const g: DrillGrade = {
      score: opt.correct ? 100 : 35,
      feedback: opt.correct
        ? `Correct — ${opt.rationale}`
        : `You chose: ${opt.rationale} · The strongest answer is “${correct.text}” — ${correct.rationale}`,
      strengths: opt.correct ? [correct.text] : [],
      gaps: opt.correct ? [] : [correct.text],
      aiGraded: mcq.aiGenerated,
    };
    onComplete({ answer: `[Multiple choice] ${opt.text}`, grade: g, selfRating: opt.correct ? 'nailed' : 'missed' });
    setMcqAnswered(true);
  };

  const commit = (rating: SelfRating) => {
    setSelfRating(rating);
    if (grade) onComplete({ answer, grade, selfRating: rating });
    setCommitted(true);
  };

  const sendFeedback = (tag: FeedbackTag) => {
    setFbTag(tag);
    onFeedback(tag, fbNote);
    setFbSent(true);
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
      {/* Drill header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <Pill>{tm.emoji} {tm.label}</Pill>
        <Pill color={dm.color}>{dm.label}</Pill>
        <Pill color="#6B7280">{drill.phaseTitle}</Pill>
      </div>

      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1F2937', margin: '0 0 0.5rem' }}>{drill.title}</h2>

      {drill.sourceUrl && (
        <a href={drill.sourceUrl} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: DRILLOOP, textDecoration: 'none', marginBottom: '0.75rem' }}>
          <ExternalLink size={12} /> {drill.sourceLabel ?? 'From the creator’s content'}
        </a>
      )}

      <div style={{ backgroundColor: DRILLOOP_SOFT, borderRadius: 14, padding: '1rem 1.125rem', margin: '0.5rem 0 1rem', fontSize: '0.95rem', lineHeight: 1.55, color: '#1F2937' }}>
        {drill.prompt}
      </div>

      {/* Answer-mode toggle — write your own, or try it as multiple choice */}
      {stage === 'answering' && !mcqAnswered && (
        <div style={{ display: 'inline-flex', gap: '0.25rem', backgroundColor: '#F3F4F6', borderRadius: 10, padding: '0.2rem', marginBottom: '1rem' }}>
          {([['write', 'Write answer', PenLine], ['mcq', 'Multiple choice', ListChecks]] as ['write' | 'mcq', string, typeof PenLine][]).map(([m, label, Icon]) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700, backgroundColor: mode === m ? 'white' : 'transparent', color: mode === m ? DRILLOOP : '#6B7280', boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Multiple-choice mode ── */}
      {mode === 'mcq' && (
        <MultipleChoice drill={drill} onAnswered={handleMcqAnswered} onNext={onNext} nextLabel={nextLabel} />
      )}

      {/* ── Write mode ── */}
      {mode === 'write' && (
        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          disabled={stage !== 'answering'}
          placeholder="Answer in your own words — a few sentences. The grader rewards judgment, not jargon."
          rows={6}
          style={{
            width: '100%', borderRadius: 14, border: '1.5px solid #E5E7EB', padding: '0.875rem 1rem',
            fontSize: '0.9rem', lineHeight: 1.55, fontFamily: 'inherit', resize: 'vertical',
            color: '#1F2937', outline: 'none', backgroundColor: stage === 'answering' ? 'white' : '#FAFAFA',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = DRILLOOP)}
          onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
        />
      )}

      {stage === 'answering' && mode === 'write' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
            {answer.trim().split(/\s+/).filter(Boolean).length} words
          </span>
          <Button onClick={submit} disabled={answer.trim().length < 10}
            style={{ backgroundColor: DRILLOOP, boxShadow: '0 2px 8px rgba(13,148,136,0.3)' }}>
            <Sparkles size={15} /> Submit for grading
          </Button>
        </div>
      )}

      {stage === 'grading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '1rem', color: DRILLOOP, fontSize: '0.875rem', fontWeight: 600 }}>
          <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
          Grading your answer against the rubric…
        </div>
      )}

      <AnimatePresence>
        {stage === 'reviewing' && grade && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={{ marginTop: '1.25rem' }}>
            {/* Score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.875rem' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${DRILLOOP}, ${DRILLOOP_DARK})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1 }}>{grade.score}</span>
                <span style={{ fontSize: '0.55rem', opacity: 0.85 }}>/ 100</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8125rem', color: '#374151', lineHeight: 1.5 }}>{grade.feedback}</div>
                <div style={{ marginTop: '0.4rem' }}>
                  <Pill color={grade.aiGraded ? DRILLOOP : '#9CA3AF'}>
                    {grade.aiGraded ? '✦ AI-graded' : 'Offline scoring'}
                  </Pill>
                </div>
              </div>
            </div>

            {/* Strengths / gaps */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <RubricList title="What you nailed" items={grade.strengths} color="#10B981" icon={<Check size={13} />} empty="Nothing detected — see the reference below." />
              <RubricList title="What to sharpen" items={grade.gaps} color="#F97316" icon={<X size={13} />} empty="Full coverage — strong answer." />
            </div>

            {/* Model answer */}
            <details open style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 700, color: DRILLOOP, marginBottom: '0.4rem' }}>
                Creator’s reference answer
              </summary>
              <div style={{ fontSize: '0.85rem', lineHeight: 1.6, color: '#374151', backgroundColor: '#F9FAFB', borderRadius: 12, padding: '0.875rem 1rem', borderLeft: `3px solid ${DRILLOOP}` }}>
                {drill.modelAnswer}
              </div>
            </details>

            {/* Self-rating — the retention/honesty signal */}
            {!committed ? (
              <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.6rem' }}>
                  Compared to the reference — how did you really do?
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <RateBtn label="✅ Nailed it" onClick={() => commit('nailed')} color="#10B981" />
                  <RateBtn label="🟡 Partial" onClick={() => commit('partial')} color="#D97706" />
                  <RateBtn label="🔴 Missed it" onClick={() => commit('missed')} color="#DC2626" />
                </div>
              </div>
            ) : (
              <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10B981', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.875rem' }}>
                  <Check size={15} /> Logged{selfRating ? ` — you rated yourself “${selfRating}”.` : '.'}
                </div>

                {/* Feedback capture */}
                {!fbSent ? (
                  <div style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: '0.875rem 1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                      Quick signal for the creator — how was this drill?
                    </div>
                    <input
                      value={fbNote}
                      onChange={e => setFbNote(e.target.value)}
                      placeholder="Optional: what was confusing or great? (sent to the creator)"
                      style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.55rem 0.75rem', fontSize: '0.8125rem', fontFamily: 'inherit', outline: 'none', marginBottom: '0.55rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {FEEDBACK_OPTIONS.map(o => (
                        <button key={o.tag} onClick={() => sendFeedback(o.tag)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.7rem', borderRadius: 999, border: '1px solid #E5E7EB', backgroundColor: 'white', fontSize: '0.75rem', fontWeight: 600, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>
                          {o.emoji} {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginBottom: '1rem' }}>
                    Thanks — “{fbTag}” feedback sent to the creator. 🙌
                  </div>
                )}

                {/* Mirror — unlocked only after committing, so answers can't be copied */}
                <div style={{ marginBottom: '1rem' }}>
                  <Mirror drill={drill} />
                </div>

                <Button fullWidth onClick={onNext}
                  style={{ backgroundColor: DRILLOOP, boxShadow: '0 2px 8px rgba(13,148,136,0.3)' }}>
                  {nextLabel}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* progress hint under everything while answering (write mode only) */}
      {stage === 'answering' && mode === 'write' && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#9CA3AF', marginBottom: '0.3rem' }}>Rubric: {drill.keyPoints.length} points the grader looks for</div>
          <ProgressBar value={0} />
        </div>
      )}
    </div>
  );
}

// ── Multiple-choice experience ──
// AI builds 1 correct + 3 distractor options for the drill. The learner picks
// one and gets reasoning guidance: why their pick was right, or its flaw and how
// to think about it versus the correct answer.
function MultipleChoice({ drill, onAnswered, onNext, nextLabel }: {
  drill: Drill;
  onAnswered: (opt: DrillMCQOption, mcq: DrillMCQ) => void;
  onNext: () => void;
  nextLabel: string;
}) {
  const [mcq, setMcq] = useState<DrillMCQ | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setSelected(null); setMcq(null);
    generateDrillMCQ(drill).then(m => { if (active) { setMcq(m); setLoading(false); } });
    return () => { active = false; };
  }, [drill]);

  if (loading || !mcq) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '1.5rem', color: DRILLOOP, fontSize: '0.875rem', fontWeight: 600 }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Building your multiple-choice question…
      </div>
    );
  }

  const correct = mcq.options.find(o => o.correct)!;
  const chosen = selected !== null ? mcq.options[selected] : null;
  const revealed = selected !== null;
  const letters = ['A', 'B', 'C', 'D'];

  const choose = (i: number) => {
    if (revealed) return;
    setSelected(i);
    onAnswered(mcq.options[i], mcq);
  };

  return (
    <div>
      <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginBottom: '0.75rem' }}>
        Pick the strongest answer. You’ll get reasoning guidance once you choose.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {mcq.options.map((o, i) => {
          const isChosen = selected === i;
          // After reveal: correct = green, chosen-but-wrong = red, others = dim.
          const border = revealed
            ? (o.correct ? '#10B981' : isChosen ? '#DC2626' : '#E5E7EB')
            : '#E5E7EB';
          const bg = revealed
            ? (o.correct ? '#10B98110' : isChosen ? '#FEF2F2' : '#FAFAFA')
            : 'white';
          return (
            <button key={i} onClick={() => choose(i)} disabled={revealed}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', width: '100%', textAlign: 'left', padding: '0.8rem 0.95rem', borderRadius: 12, border: `1.5px solid ${border}`, backgroundColor: bg, cursor: revealed ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', opacity: revealed && !o.correct && !isChosen ? 0.6 : 1 }}
              onMouseEnter={e => { if (!revealed) e.currentTarget.style.borderColor = DRILLOOP; }}
              onMouseLeave={e => { if (!revealed) e.currentTarget.style.borderColor = '#E5E7EB'; }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, backgroundColor: revealed && o.correct ? '#10B981' : revealed && isChosen ? '#DC2626' : DRILLOOP_SOFT, color: revealed && (o.correct || isChosen) ? 'white' : DRILLOOP }}>
                {revealed && o.correct ? <Check size={14} /> : revealed && isChosen ? <X size={14} /> : letters[i]}
              </span>
              <span style={{ flex: 1, fontSize: '0.86rem', lineHeight: 1.5, color: '#1F2937', fontWeight: revealed && o.correct ? 600 : 400 }}>{o.text}</span>
            </button>
          );
        })}
      </div>

      {/* Reasoning guidance */}
      {chosen && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem', fontWeight: 800, color: chosen.correct ? '#10B981' : '#DC2626', marginBottom: '0.6rem' }}>
            {chosen.correct ? <><Check size={18} /> Nailed it.</> : <><X size={18} /> Not quite.</>}
          </div>

          <div style={{ backgroundColor: '#FAFAFA', borderRadius: 12, padding: '0.875rem 1rem', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>Your choice</div>
            <div style={{ fontSize: '0.85rem', lineHeight: 1.55, color: '#374151' }}>{chosen.rationale}</div>
          </div>

          {!chosen.correct && (
            <div style={{ backgroundColor: '#10B98110', borderRadius: 12, padding: '0.875rem 1rem', borderLeft: '3px solid #10B981', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>How to think about it — the strongest answer</div>
              <div style={{ fontSize: '0.85rem', lineHeight: 1.55, color: '#374151' }}>
                <strong>“{correct.text}”</strong> — {correct.rationale}
              </div>
            </div>
          )}

          <details style={{ marginBottom: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: DRILLOOP }}>Creator’s reference answer</summary>
            <div style={{ fontSize: '0.84rem', lineHeight: 1.6, color: '#374151', backgroundColor: '#F9FAFB', borderRadius: 12, padding: '0.875rem 1rem', borderLeft: `3px solid ${DRILLOOP}`, marginTop: '0.4rem' }}>
              {drill.modelAnswer}
            </div>
          </details>

          {!mcq.aiGenerated && (
            <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginBottom: '0.75rem' }}>Offline options (no AI key reachable) — reasoning is heuristic.</div>
          )}

          <Button fullWidth onClick={onNext} style={{ backgroundColor: DRILLOOP, boxShadow: '0 2px 8px rgba(13,148,136,0.3)' }}>
            {nextLabel}
          </Button>
        </motion.div>
      )}
    </div>
  );
}

function RubricList({ title, items, color, icon, empty }: { title: string; items: string[]; color: string; icon: React.ReactNode; empty: string }) {
  return (
    <div style={{ backgroundColor: '#FAFAFA', borderRadius: 12, padding: '0.75rem 0.875rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{empty}</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {items.map((it, i) => (
            <li key={i} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.78rem', color: '#374151', lineHeight: 1.4 }}>
              <span style={{ color, flexShrink: 0, marginTop: 1 }}>{icon}</span> {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RateBtn({ label, onClick, color }: { label: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick}
      style={{ flex: '1 1 auto', padding: '0.6rem 0.75rem', borderRadius: 12, border: `1.5px solid ${color}33`, backgroundColor: `${color}0D`, color, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${color}1A`)}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = `${color}0D`)}>
      {label}
    </button>
  );
}
