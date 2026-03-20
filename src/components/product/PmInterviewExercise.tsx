/**
 * PmInterviewExercise
 * PM Interview Practice Booth — sourced from APMCPracticeBooth (github.com/arunimasharma/APMCPracticeBooth)
 *
 * Flow: setup → selecting → practicing → done
 *   setup:      pick interview type + optional context
 *   selecting:  5 random questions shown, pick one (with search + refresh)
 *   practicing: question front-and-centre, optional 3-min timer, notes area
 *   done:       encouragement + try again
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, RefreshCw, Clock, CheckCircle2,
  ArrowRight, Mic2, BarChart3, Heart,
} from 'lucide-react';
import { PM_QUESTIONS, type PmQuestion } from '../../data/pmInterviewQuestions';

const GRAD = 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)';
const PRIMARY = '#7C3AED';

type Phase = 'setup' | 'selecting' | 'practicing' | 'done';
type Category = 'Product Sense' | 'Analytical Thinking' | 'Behavioral';

const CATEGORY_META: Record<Category, { emoji: string; desc: string; color: string; bg: string }> = {
  'Product Sense': {
    emoji: '🧪',
    desc: 'Design, improve, and prioritise product features',
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  'Analytical Thinking': {
    emoji: '📊',
    desc: 'Metrics, estimation, and data-driven decisions',
    color: '#0369A1',
    bg: '#F0F9FF',
  },
  'Behavioral': {
    emoji: '🤝',
    desc: 'Leadership, collaboration, and growth stories',
    color: '#059669',
    bg: '#ECFDF5',
  },
};

const TIMER_SECONDS = 3 * 60; // 3-minute default

function fmt(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface Props {
  onBack: () => void;
}

export default function PmInterviewExercise({ onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [category, setCategory] = useState<Category | null>(null);
  const [companyContext, setCompanyContext] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [questions, setQuestions] = useState<PmQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<PmQuestion | null>(null);
  const [notes, setNotes] = useState('');
  const [timerActive, setTimerActive] = useState(false);
  const [timerSecs, setTimerSecs] = useState(TIMER_SECONDS);
  const [timerDone, setTimerDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer effect
  useEffect(() => {
    if (timerActive && timerSecs > 0) {
      timerRef.current = setInterval(() => setTimerSecs(s => s - 1), 1000);
    } else if (timerSecs === 0) {
      setTimerActive(false);
      setTimerDone(true);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive, timerSecs]);

  const pickQuestions = (cat: Category, keyword: string) => {
    const pool = PM_QUESTIONS.filter(q => {
      if (q.category !== cat) return false;
      if (keyword.trim()) return q.question.toLowerCase().includes(keyword.trim().toLowerCase());
      return true;
    });
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
    setQuestions(shuffled);
    setSelectedQuestion(null);
  };

  const handleGetQuestions = () => {
    if (!category) return;
    pickQuestions(category, searchTerm);
    setPhase('selecting');
  };

  const handleRefresh = () => {
    if (!category) return;
    pickQuestions(category, searchTerm);
  };

  const handleStartPractice = () => {
    if (!selectedQuestion) return;
    setNotes('');
    setTimerSecs(TIMER_SECONDS);
    setTimerActive(false);
    setTimerDone(false);
    setPhase('practicing');
  };

  const handleFinish = () => {
    setTimerActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('done');
  };

  const handleTryAnother = () => {
    if (category) pickQuestions(category, '');
    setSearchTerm('');
    setPhase('selecting');
  };

  const handleReset = () => {
    setPhase('setup');
    setCategory(null);
    setCompanyContext('');
    setSearchTerm('');
    setQuestions([]);
    setSelectedQuestion(null);
    setNotes('');
  };

  // ── Top bar ──────────────────────────────────────────────────────────────────
  const topBarSubtitle = {
    setup: 'Choose your interview type',
    selecting: `Pick a ${category ?? ''} question`,
    practicing: selectedQuestion ? selectedQuestion.category : 'Practice',
    done: 'Session complete',
  }[phase];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8F9FE', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ background: GRAD, padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={phase === 'setup' ? onBack : handleReset}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <ChevronLeft size={18} color="white" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: 'white' }}>PM Interview Practice</p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)' }}>{topBarSubtitle}</p>
        </div>
        {phase === 'practicing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              fontVariantNumeric: 'tabular-nums',
              fontSize: '1rem', fontWeight: 700, color: timerDone ? '#FCA5A5' : timerSecs < 30 ? '#FDE68A' : 'white',
            }}>
              {fmt(timerSecs)}
            </span>
            <button
              onClick={() => setTimerActive(a => !a)}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '0.3rem 0.5rem', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit' }}
            >
              <Clock size={13} />
              {timerDone ? 'Restart' : timerActive ? 'Pause' : timerSecs === TIMER_SECONDS ? 'Start timer' : 'Resume'}
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.25rem', maxWidth: '640px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <AnimatePresence mode="wait">

          {/* ── SETUP ────────────────────────────────────────────────────────── */}
          {phase === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 1rem' }}>
                1 · Choose interview type
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.75rem' }}>
                {(Object.keys(CATEGORY_META) as Category[]).map(cat => {
                  const meta = CATEGORY_META[cat];
                  const active = category === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.875rem',
                        padding: '1rem 1.125rem', borderRadius: '14px', border: 'none',
                        backgroundColor: active ? meta.bg : 'white',
                        outline: active ? `2px solid ${meta.color}` : '2px solid transparent',
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{meta.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: '0 0 0.125rem', fontWeight: 700, fontSize: '0.9375rem', color: active ? meta.color : '#111827' }}>{cat}</p>
                        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.4 }}>{meta.desc}</p>
                      </div>
                      {active && <CheckCircle2 size={18} color={meta.color} style={{ flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>

              <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.625rem' }}>
                2 · Company context <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '0.75rem' }}>(optional)</span>
              </p>
              <input
                type="text"
                value={companyContext}
                onChange={e => setCompanyContext(e.target.value)}
                placeholder="e.g. Big Tech, Startup, Fintech…"
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1.5px solid #E5E7EB', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '1.5rem', transition: 'border-color 0.15s' }}
                onFocus={e => { e.currentTarget.style.borderColor = PRIMARY; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
              />

              <button
                onClick={handleGetQuestions}
                disabled={!category}
                style={{ width: '100%', padding: '0.875rem', borderRadius: '14px', border: 'none', background: !category ? '#E5E7EB' : GRAD, color: !category ? '#9CA3AF' : 'white', fontSize: '0.9375rem', fontWeight: 700, cursor: !category ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.15s' }}
              >
                Get Practice Questions <ArrowRight size={17} />
              </button>
            </motion.div>
          )}

          {/* ── SELECTING ────────────────────────────────────────────────────── */}
          {phase === 'selecting' && (
            <motion.div key="selecting" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

              {/* Search + refresh */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRefresh(); }}
                  placeholder="Filter by keyword…"
                  style={{ flex: 1, padding: '0.625rem 0.875rem', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s' }}
                  onFocus={e => { e.currentTarget.style.borderColor = PRIMARY; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
                />
                <button
                  onClick={handleRefresh}
                  style={{ padding: '0.625rem 0.875rem', borderRadius: '10px', border: '1.5px solid #E5E7EB', backgroundColor: 'white', color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                >
                  <RefreshCw size={14} /> Shuffle
                </button>
              </div>

              {/* Question list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {questions.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: '#9CA3AF', textAlign: 'center', padding: '2rem 0' }}>No questions match that keyword. Try clearing the filter.</p>
                ) : (
                  questions.map(q => {
                    const selected = selectedQuestion?.id === q.id;
                    return (
                      <button
                        key={q.id}
                        onClick={() => setSelectedQuestion(q)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem 1rem', borderRadius: '12px', border: 'none', outline: selected ? `2px solid ${PRIMARY}` : '2px solid transparent', backgroundColor: selected ? '#F5F3FF' : 'white', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', transition: 'all 0.15s' }}
                      >
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selected ? PRIMARY : '#D1D5DB'}`, backgroundColor: selected ? PRIMARY : 'transparent', flexShrink: 0, marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                          {selected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'white' }} />}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: selected ? '#1F2937' : '#374151', lineHeight: 1.6, fontWeight: selected ? 500 : 400 }}>{q.question}</p>
                      </button>
                    );
                  })
                )}
              </div>

              <button
                onClick={handleStartPractice}
                disabled={!selectedQuestion}
                style={{ width: '100%', padding: '0.875rem', borderRadius: '14px', border: 'none', background: !selectedQuestion ? '#E5E7EB' : GRAD, color: !selectedQuestion ? '#9CA3AF' : 'white', fontSize: '0.9375rem', fontWeight: 700, cursor: !selectedQuestion ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.15s' }}
              >
                <Mic2 size={17} /> Practice This Question
              </button>

              {companyContext && (
                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.75rem' }}>
                  Context: <strong style={{ color: '#6B7280' }}>{companyContext}</strong>
                </p>
              )}
            </motion.div>
          )}

          {/* ── PRACTICING ───────────────────────────────────────────────────── */}
          {phase === 'practicing' && selectedQuestion && (
            <motion.div key="practicing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Question card */}
              <div style={{ background: GRAD, borderRadius: '16px', padding: '1.375rem 1.25rem', marginBottom: '1.25rem', boxShadow: '0 4px 20px rgba(124,58,237,0.2)' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.6875rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {selectedQuestion.category}
                  {companyContext && ` · ${companyContext}`}
                </p>
                <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'white', lineHeight: 1.6 }}>
                  {selectedQuestion.question}
                </p>
              </div>

              {/* Timer done banner */}
              {timerDone && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{ padding: '0.75rem 1rem', borderRadius: '12px', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Clock size={15} color="#D97706" />
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400E', fontWeight: 500 }}>Time's up! Wrap up your answer and click Finish.</p>
                </motion.div>
              )}

              {/* Tips */}
              <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', backgroundColor: '#F5F3FF', border: '1px solid #EDE9FE', marginBottom: '1.25rem' }}>
                <p style={{ margin: '0 0 0.375rem', fontSize: '0.6875rem', fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Structure tips</p>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.5 }}>
                  {selectedQuestion.category === 'Product Sense' && 'Clarify scope → identify users → define goals → ideate solutions → prioritise → success metrics'}
                  {selectedQuestion.category === 'Analytical Thinking' && 'Clarify the question → break into components → estimate each piece → sanity-check → state assumptions'}
                  {selectedQuestion.category === 'Behavioral' && 'Situation → Task → Action → Result (STAR). Quantify impact where you can.'}
                </p>
              </div>

              {/* Notes */}
              <p style={{ margin: '0 0 0.375rem', fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Your notes</p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Jot down your key points here — this is just for you…"
                rows={7}
                style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1.5px solid #E5E7EB', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, transition: 'border-color 0.15s', marginBottom: '1.25rem' }}
                onFocus={e => { e.currentTarget.style.borderColor = PRIMARY; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
              />

              <button
                onClick={handleFinish}
                style={{ width: '100%', padding: '0.875rem', borderRadius: '14px', border: 'none', background: GRAD, color: 'white', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <CheckCircle2 size={17} /> Finish Practice
              </button>
            </motion.div>
          )}

          {/* ── DONE ─────────────────────────────────────────────────────────── */}
          {phase === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ textAlign: 'center', paddingTop: '2rem' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', boxShadow: '0 8px 24px rgba(124,58,237,0.25)' }}>
                <Heart size={32} color="white" />
              </div>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#111827', margin: '0 0 0.5rem' }}>Great practice!</h2>
              <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.6, margin: '0 auto 0.5rem', maxWidth: '380px' }}>
                Every repetition builds sharper instincts. PMs who practice answering out loud consistently outperform those who only read frameworks.
              </p>

              {selectedQuestion && (
                <div style={{ padding: '1rem 1.25rem', borderRadius: '14px', backgroundColor: '#F5F3FF', border: '1px solid #EDE9FE', margin: '1.5rem 0', textAlign: 'left' }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.6875rem', fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Question you practiced</p>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.55 }}>{selectedQuestion.question}</p>
                </div>
              )}

              {notes.trim() && (
                <div style={{ padding: '1rem 1.25rem', borderRadius: '14px', backgroundColor: 'white', border: '1px solid #E5E7EB', marginBottom: '1.5rem', textAlign: 'left' }}>
                  <p style={{ margin: '0 0 0.375rem', fontSize: '0.6875rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Your notes</p>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{notes}</p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <button
                  onClick={handleTryAnother}
                  style={{ padding: '0.875rem', borderRadius: '14px', border: 'none', background: GRAD, color: 'white', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <RefreshCw size={17} /> Try Another Question
                </button>
                <button
                  onClick={handleReset}
                  style={{ padding: '0.875rem', borderRadius: '14px', border: '1.5px solid #EDE9FE', backgroundColor: 'white', color: PRIMARY, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <BarChart3 size={17} /> Change Interview Type
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
