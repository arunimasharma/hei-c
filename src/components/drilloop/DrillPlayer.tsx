import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Loader2, ExternalLink, Sparkles } from 'lucide-react';
import type { Drill, DrillGrade, SelfRating, FeedbackTag } from '../../types/drilloop';
import { gradeAnswer } from '../../services/drilloopGrading';
import Button from '../common/Button';
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

  const tm = TYPE_META[drill.type];
  const dm = DIFFICULTY_META[drill.difficulty];

  const submit = async () => {
    setStage('grading');
    const g = await gradeAnswer(drill, answer);
    setGrade(g);
    setStage('reviewing');
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

      <div style={{ backgroundColor: DRILLOOP_SOFT, borderRadius: 14, padding: '1rem 1.125rem', margin: '0.5rem 0 1.25rem', fontSize: '0.95rem', lineHeight: 1.55, color: '#1F2937' }}>
        {drill.prompt}
      </div>

      {/* Answer box */}
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

      {stage === 'answering' && (
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

                <Button fullWidth onClick={onNext}
                  style={{ backgroundColor: DRILLOOP, boxShadow: '0 2px 8px rgba(13,148,136,0.3)' }}>
                  {nextLabel}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* progress hint under everything while answering */}
      {stage === 'answering' && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#9CA3AF', marginBottom: '0.3rem' }}>Rubric: {drill.keyPoints.length} points the grader looks for</div>
          <ProgressBar value={0} />
        </div>
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
