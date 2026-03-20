import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FlaskConical, Sparkles, Send, Star, CheckCircle2,
  ArrowRight, Target, TrendingUp, BarChart3, Brain,
  Users, Globe, RefreshCw, ChevronLeft, Check, Mic2, Zap,
} from 'lucide-react';
import Header from '../components/layout/Header';
import InfoTooltip from '../components/common/InfoTooltip';
import { useApp } from '../context/AppContext';
import PmInterviewExercise from '../components/product/PmInterviewExercise';
import FrictionCaseExercise from '../components/product/FrictionCaseExercise';
import { callEvaluateTaste, EvaluatorNotConfiguredError } from '../services/productTasteEvaluatorApi';
import { callClaudeMessages, parseActionResponse } from '../services/claudeApi';
import {
  TASTE_QUESTIONS,
  TASTE_ANALYSIS_SYSTEM_PROMPT,
  buildTasteAnalysisMessage,
  parseTasteAnalysisResponse,
  type TasteAnalysisResult,
} from '../services/tasteExercisePromptBuilder';
import type { TasteExercise, TasteExerciseAnswer, TasteEvaluatorResult } from '../types';

type PageView = 'landing' | 'exercise' | 'interview' | 'friction';
type ExercisePhase = 'naming' | 'questioning' | 'analyzing' | 'done';
type ChatMessage = { role: 'user' | 'assistant'; content: string };

const GRAD = 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)';
const PRIMARY = '#7C3AED';
const BG = '#F8F9FE';

const QUESTION_META = [
  { title: 'Your Honest Take', short: "What's your overall take on this product? Do you like it or not, and why?", skill: 'Share your genuine perspective', icon: Target },
  { title: 'Build Better', short: 'If you were on the team, what would you build better?', skill: 'Explore improvement ideas', icon: TrendingUp },
  { title: 'Different Users', short: 'What would you do differently, and for which specific user segment?', skill: 'Think about different people', icon: Users },
  { title: 'Team Perspective', short: 'Why do you think the current team made the decisions they did?', skill: 'Understand the team\'s context', icon: Brain },
  { title: 'The Bigger Picture', short: 'What market patterns or data signals shaped those decisions?', skill: 'Notice what\'s happening in the world', icon: Globe },
  { title: 'Make the Case', short: 'Give a 60-second pitch for your proposed improvement.', skill: 'Communicate your idea clearly', icon: BarChart3 },
];

const VERDICT_SCALE = [
  { range: '0–1', label: 'Just Starting', bg: '#DC2626' },
  { range: '1–2', label: 'Developing', bg: '#EA580C' },
  { range: '2–3', label: 'Growing', bg: '#CA8A04' },
  { range: '3–4', label: 'Confident', bg: '#16A34A' },
  { range: '4–5', label: 'Thriving', bg: '#15803D' },
];

const VERDICT_DISPLAY: Record<string, string> = {
  'Very Weak': 'Just Starting',
  'Emerging': 'Developing',
  'Functional': 'Growing',
  'Strong': 'Confident',
  'Exceptional': 'Thriving',
};

// Renders bold (**text**) inside strings
function RichText({ text, style }: { text: string; style?: React.CSSProperties }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span style={style}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

export default function ProductTastePage() {
  const { state, addTasteExercise, checkAndUseAi } = useApp();
  const [view, setView] = useState<PageView>('landing');

  // Exercise state
  const [phase, setPhase] = useState<ExercisePhase>('naming');
  const [productName, setProductName] = useState('');
  const [answers, setAnswers] = useState<TasteExerciseAnswer[]>([]);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [evalResult, setEvalResult] = useState<TasteEvaluatorResult | null>(null);
  const [legacyResult, setLegacyResult] = useState<TasteAnalysisResult | null>(null);
  const [productRecs, setProductRecs] = useState<string[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startExercise = () => {
    setView('exercise');
    setPhase('naming');
    setProductName('');
    setAnswers([]);
    setQuestionIdx(0);
    setMessages([{ role: 'assistant', content: "Which product would you like to explore together? Type a name below, or tap **Suggest** for some ideas." }]);
    setEvalResult(null);
    setLegacyResult(null);
    setProductRecs([]);
    setSaved(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleGetRecs = async () => {
    if (!checkAndUseAi()) return;
    setRecsLoading(true);
    try {
      const sys = `You are a product career advisor. Suggest 6 well-known products for someone to analyze to build product taste. Return ONLY a JSON array of 6 product name strings. Example: ["Figma","Linear","Notion","Vercel","Spotify","Airbnb"]`;
      const past = state.tasteExercises.slice(0, 5).map(e => e.productName).join(', ') || 'None yet';
      const resp = await callClaudeMessages(sys, [{ role: 'user', content: `Past: ${past}. Suggest fresh picks.` }], 150);
      const match = parseActionResponse(resp).match(/\[[\s\S]*\]/);
      if (match) setProductRecs(JSON.parse(match[0]));
    } catch { /* ignore */ } finally {
      setRecsLoading(false);
    }
  };

  const selectProduct = (name: string) => {
    setProductName(name);
    setQuestionIdx(0);
    setAnswers([]);
    setPhase('questioning');
    setMessages(prev => [
      ...prev,
      { role: 'user', content: name },
      { role: 'assistant', content: `Great choice! Let's explore **${name}** together. Share as much or as little as feels right — you can wrap up whenever you're ready.` },
      { role: 'assistant', content: `Q1 / 6: ${TASTE_QUESTIONS[0]}` },
    ]);
  };

  const doAnalyze = async (toAnalyze: TasteExerciseAnswer[], currentName: string) => {
    if (!checkAndUseAi()) return;
    setPhase('analyzing');
    setMessages(prev => [...prev, { role: 'assistant', content: `Taking a thoughtful look at what you shared about ${currentName}… just a moment.` }]);
    const obj = {
      q1: toAnalyze[0]?.answer ?? '',
      q2: toAnalyze[1]?.answer ?? '',
      q3: toAnalyze[2]?.answer ?? '',
      q4: toAnalyze[3]?.answer ?? '',
      q5: toAnalyze[4]?.answer ?? '',
      q6: toAnalyze[5]?.answer ?? '',
    };
    try {
      const result = await callEvaluateTaste({ productName: currentName, answers: obj });
      setEvalResult(result);
      setPhase('done');
      setMessages(prev => [...prev, { role: 'assistant', content: `Here's what I noticed in your thinking about **${currentName}**. Overall: ${result.overall_score}/5 — ${VERDICT_DISPLAY[result.verdict] ?? result.verdict}.` }]);
    } catch (err) {
      if (err instanceof EvaluatorNotConfiguredError) {
        try {
          const userMsg = buildTasteAnalysisMessage(currentName, toAnalyze);
          const resp = await callClaudeMessages(TASTE_ANALYSIS_SYSTEM_PROMPT, [{ role: 'user', content: userMsg }], 600);
          const legacy = parseTasteAnalysisResponse(parseActionResponse(resp));
          setLegacyResult(legacy);
          setPhase('done');
          setMessages(prev => [...prev, { role: 'assistant', content: `Here's what I noticed in your thinking about **${currentName}** — score: ${legacy.score}/5.` }]);
        } catch {
          setPhase('questioning');
          setMessages(prev => [...prev, { role: 'assistant', content: 'Analysis failed — please try again.' }]);
        }
      } else {
        setPhase('questioning');
        const msg = err instanceof Error ? err.message : 'Analysis failed — please try again.';
        setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
      }
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!checkAndUseAi()) return;
    setInput('');
    setLoading(true);
    try {
      if (phase === 'naming') {
        selectProduct(text);
      } else if (phase === 'questioning') {
        const newAnswer: TasteExerciseAnswer = { question: TASTE_QUESTIONS[questionIdx], answer: text };
        const newAnswers = [...answers, newAnswer];
        setAnswers(newAnswers);
        setMessages(prev => [...prev, { role: 'user', content: text }]);
        const nextIdx = questionIdx + 1;
        if (nextIdx < TASTE_QUESTIONS.length) {
          setQuestionIdx(nextIdx);
          setMessages(prev => [...prev, { role: 'assistant', content: `Q${nextIdx + 1} / 6: ${TASTE_QUESTIONS[nextIdx]}` }]);
        } else {
          await doAnalyze(newAnswers, productName);
        }
      }
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSave = () => {
    if (!evalResult && !legacyResult) return;
    const exercise: TasteExercise = {
      id: `te_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: state.user?.id || 'anonymous',
      productName,
      answers,
      summary: evalResult?.detailed_reasoning ?? legacyResult?.summary ?? '',
      score: evalResult?.overall_score ?? legacyResult?.score ?? 0,
      scoreComment: evalResult?.verdict ?? legacyResult?.scoreComment ?? '',
      evaluation: evalResult ?? undefined,
      timestamp: new Date().toISOString(),
      status: 'completed',
    };
    addTasteExercise(exercise);
    setSaved(true);
    setMessages(prev => [...prev, { role: 'assistant', content: `Saved! Your **${productName}** analysis has been added to your profile.` }]);
  };

  // ─── EXERCISE VIEW ───────────────────────────────────────────────────────────
  if (view === 'exercise') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: BG, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={{ background: GRAD, padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setView('landing')}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <ChevronLeft size={18} color="white" />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: 'white' }}>Product Taste Exercise</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)' }}>
              {phase === 'naming' && 'Pick a product to explore'}
              {phase === 'questioning' && `Question ${questionIdx + 1} of 6 · ${productName}`}
              {phase === 'analyzing' && `Reflecting on ${productName}…`}
              {phase === 'done' && `Your insights · ${productName}`}
            </p>
          </div>
          {phase === 'questioning' && (
            <div style={{ display: 'flex', gap: '3px' }}>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} style={{ width: '6px', height: '6px', borderRadius: '999px', backgroundColor: i < answers.length ? 'white' : 'rgba(255,255,255,0.3)' }} />
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '640px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
              >
                {msg.role === 'assistant' ? (
                  <div style={{ maxWidth: '82%', backgroundColor: 'white', borderRadius: '0 14px 14px 14px', padding: '0.75rem 1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #EDE9FE' }}>
                    <RichText text={msg.content} style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.65 }} />
                  </div>
                ) : (
                  <div style={{ maxWidth: '82%', background: GRAD, borderRadius: '14px 14px 0 14px', padding: '0.75rem 1rem', boxShadow: '0 1px 4px rgba(124,58,237,0.2)' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'white', lineHeight: 1.65 }}>{msg.content}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* What we evaluate chip */}
          {phase === 'questioning' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ backgroundColor: '#F5F3FF', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}
            >
              <Sparkles size={13} color={PRIMARY} style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <p style={{ margin: '0 0 0.125rem', fontSize: '0.6875rem', fontWeight: 600, color: PRIMARY }}>What you'll explore:</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#6B7280' }}>Your instincts · Creative ideas · Different users · Team context · The bigger picture</p>
              </div>
            </motion.div>
          )}

          {/* Product recs when naming */}
          {phase === 'naming' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {productRecs.length === 0 ? (
                <button
                  onClick={handleGetRecs}
                  disabled={recsLoading}
                  style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.375rem', border: '1.5px dashed #DDD6FE', backgroundColor: 'transparent', color: PRIMARY, fontSize: '0.8125rem', fontWeight: 500, padding: '0.5rem 0.875rem', borderRadius: '10px', cursor: recsLoading ? 'default' : 'pointer', fontFamily: 'inherit', opacity: recsLoading ? 0.6 : 1 }}
                >
                  <Sparkles size={13} />
                  {recsLoading ? 'Finding suggestions…' : 'Suggest products to analyze'}
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 500 }}>Pick one or type your own:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {productRecs.map((rec, i) => (
                      <button
                        key={i}
                        onClick={() => selectProduct(rec)}
                        style={{ padding: '0.375rem 0.75rem', borderRadius: '999px', border: '1.5px solid #DDD6FE', backgroundColor: 'white', color: PRIMARY, fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F5F3FF'; e.currentTarget.style.borderColor = PRIMARY; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#DDD6FE'; }}
                      >
                        {rec}
                      </button>
                    ))}
                    <button onClick={() => setProductRecs([])} style={{ padding: '0.375rem 0.625rem', borderRadius: '999px', border: '1px solid #E5E7EB', backgroundColor: 'transparent', color: '#9CA3AF', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <RefreshCw size={11} /> refresh
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Finish & Analyze button */}
          {phase === 'questioning' && answers.length > 0 && (
            <button
              onClick={() => doAnalyze(answers, productName)}
              disabled={loading}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', borderRadius: '10px', border: 'none', background: GRAD, color: 'white', fontSize: '0.8125rem', fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}
            >
              <Sparkles size={14} /> Get My Insights
            </button>
          )}

          {/* Loading indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', paddingLeft: '0.5rem' }}>
              {[0, 1, 2].map(i => (
                <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: PRIMARY }} />
              ))}
            </div>
          )}

          {/* V1 Rich results card */}
          {phase === 'done' && evalResult && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ borderRadius: '16px', border: '1px solid #EDE9FE', overflow: 'hidden', backgroundColor: 'white', boxShadow: '0 4px 20px rgba(124,58,237,0.1)' }}>
              {/* Score header */}
              <div style={{ padding: '1rem 1.25rem', background: 'linear-gradient(135deg, rgba(124,58,237,0.07) 0%, rgba(236,72,153,0.07) 100%)', borderBottom: '1px solid #EDE9FE', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '14px', flexShrink: 0, background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>{evalResult.overall_score}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={14} fill={i < evalResult.overall_score ? PRIMARY : 'none'} color={i < evalResult.overall_score ? PRIMARY : '#E5E7EB'} />
                    ))}
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.625rem', borderRadius: '999px', background: 'rgba(124,58,237,0.1)', color: PRIMARY, marginLeft: '0.125rem' }}>
                      {VERDICT_DISPLAY[evalResult.verdict] ?? evalResult.verdict}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 500 }}>{productName}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {(['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const).map(q => {
                      const s = evalResult.per_question_scores[q];
                      const bg = s >= 4 ? '#F0FDF4' : s >= 2 ? '#FFFBEB' : '#FEF2F2';
                      const color = s >= 4 ? '#16A34A' : s >= 2 ? '#D97706' : '#DC2626';
                      return (
                        <span key={q} style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '6px', background: bg, color }}>
                          {q.toUpperCase()} {s}/5
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Reasoning */}
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #F5F3FF' }}>
                <p style={{ fontSize: '0.8125rem', color: '#374151', lineHeight: 1.7, margin: 0 }}>{evalResult.detailed_reasoning}</p>
              </div>

              {/* Strengths + Weaknesses */}
              {(evalResult.strengths.length > 0 || evalResult.weaknesses.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: evalResult.strengths.length > 0 && evalResult.weaknesses.length > 0 ? '1fr 1fr' : '1fr', borderBottom: '1px solid #F5F3FF' }}>
                  {evalResult.strengths.length > 0 && (
                    <div style={{ padding: '0.875rem 1.25rem', borderRight: evalResult.weaknesses.length > 0 ? '1px solid #F5F3FF' : 'none' }}>
                      <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>What's working well</p>
                      <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {evalResult.strengths.map((s, i) => <li key={i} style={{ fontSize: '0.75rem', color: '#374151', lineHeight: 1.5 }}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {evalResult.weaknesses.length > 0 && (
                    <div style={{ padding: '0.875rem 1.25rem' }}>
                      <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>Room to grow</p>
                      <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {evalResult.weaknesses.map((w, i) => <li key={i} style={{ fontSize: '0.75rem', color: '#374151', lineHeight: 1.5 }}>{w}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Coaching */}
              {evalResult.coaching_to_improve.length > 0 && (
                <div style={{ padding: '0.875rem 1.25rem' }}>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>Ideas to explore next</p>
                  <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {evalResult.coaching_to_improve.map((c, i) => <li key={i} style={{ fontSize: '0.75rem', color: '#374151', lineHeight: 1.5 }}>{c}</li>)}
                  </ul>
                </div>
              )}
            </motion.div>
          )}

          {/* Legacy fallback result card */}
          {phase === 'done' && !evalResult && legacyResult && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ borderRadius: '16px', border: '1px solid #EDE9FE', overflow: 'hidden', backgroundColor: 'white', boxShadow: '0 4px 20px rgba(124,58,237,0.1)' }}>
              <div style={{ padding: '1rem 1.25rem', background: 'linear-gradient(135deg, rgba(124,58,237,0.07) 0%, rgba(236,72,153,0.07) 100%)', borderBottom: '1px solid #EDE9FE', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0, background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>{legacyResult.score}</span>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                    {Array.from({ length: 5 }, (_, i) => <Star key={i} size={13} fill={i < legacyResult.score ? PRIMARY : 'none'} color={i < legacyResult.score ? PRIMARY : '#E5E7EB'} />)}
                    <span style={{ fontSize: '0.75rem', color: PRIMARY, fontWeight: 600, marginLeft: '0.25rem' }}>{productName}</span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0 }}>{legacyResult.scoreComment}</p>
                </div>
              </div>
              <div style={{ padding: '1rem 1.25rem' }}>
                <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>{legacyResult.summary}</p>
              </div>
            </motion.div>
          )}

          {/* Save / Try Again buttons after done */}
          {phase === 'done' && (evalResult || legacyResult) && (
            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
              {!saved ? (
                <button
                  onClick={handleSave}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5625rem 1.125rem', borderRadius: '10px', border: 'none', background: GRAD, color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <CheckCircle2 size={15} /> Save to Profile
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5625rem 1.125rem', borderRadius: '10px', backgroundColor: '#F0FDF4', color: '#16A34A', fontSize: '0.875rem', fontWeight: 600 }}>
                  <Check size={15} /> Saved!
                </div>
              )}
              <button
                onClick={startExercise}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5625rem 1.125rem', borderRadius: '10px', border: '1.5px solid #EDE9FE', backgroundColor: 'white', color: PRIMARY, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <RefreshCw size={14} /> Analyze another
              </button>
            </div>
          )}

          {/* Step 2 bridge — nudge toward Friction Cases after taste analysis */}
          {phase === 'done' && (evalResult || legacyResult) && (
            <div style={{ padding: '0.875rem 1rem', borderRadius: '14px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: '0 0 0.125rem', fontSize: '0.8125rem', fontWeight: 700, color: '#92400E' }}>Step 2: Test your instincts</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#B45309', lineHeight: 1.4 }}>Diagnose real friction signals scored against actual user data.</p>
              </div>
              <button
                onClick={() => setView('friction')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '10px', border: 'none', backgroundColor: '#D97706', color: 'white', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
              >
                <Zap size={14} /> Friction Cases
              </button>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input bar */}
        {phase !== 'done' && phase !== 'analyzing' && (
          <div style={{ borderTop: '1px solid #E5E7EB', backgroundColor: 'white', padding: '0.75rem 1rem' }}>
            <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={phase === 'naming' ? 'e.g. Figma, Linear, Notion…' : 'Type your answer…'}
                disabled={loading}
                style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '12px', border: '1.5px solid #E5E7EB', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none', backgroundColor: loading ? '#F9FAFB' : 'white', transition: 'border-color 0.15s', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.borderColor = PRIMARY; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                style={{ width: '44px', height: '44px', borderRadius: '12px', border: 'none', background: !input.trim() || loading ? '#F3F4F6' : GRAD, color: !input.trim() || loading ? '#9CA3AF' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: !input.trim() || loading ? 'default' : 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
              >
                <Send size={17} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── INTERVIEW VIEW ──────────────────────────────────────────────────────────
  if (view === 'interview') {
    return <PmInterviewExercise onBack={() => setView('landing')} />;
  }

  // ─── FRICTION CASE VIEW ───────────────────────────────────────────────────────
  if (view === 'friction') {
    return <FrictionCaseExercise onBack={() => setView('landing')} onStartTaste={startExercise} />;
  }

  // ─── LANDING VIEW ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, fontFamily: 'inherit' }}>

      <Header />

      {/* ── Hero ── */}
      <section style={{ padding: '5rem 1.5rem 3rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.875rem', borderRadius: '999px', border: '1px solid rgba(124,58,237,0.2)', backgroundColor: 'rgba(124,58,237,0.05)', marginBottom: '1.5rem' }}>
            <Sparkles size={13} color={PRIMARY} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: PRIMARY }}>Product Intelligence Studio</span>
          </motion.div>

          {/* Headline */}
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', fontWeight: 900, lineHeight: 1.15, margin: '0 0 1.25rem', color: '#111827' }}>
            Develop Your{' '}
            <span style={{ backgroundImage: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Product Intelligence
            </span>
            <br />One Product at a Time
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} style={{ fontSize: '1.0625rem', color: '#6B7280', lineHeight: 1.7, margin: '0 auto 2rem', maxWidth: '520px' }}>
            Two exercises that work together: explore how you see products through an AI conversation, then test your analytical accuracy on real friction cases scored against actual user data.
          </motion.p>

          {/* ── Exercise picker — unified two-step layout ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '740px', margin: '0 auto 1.25rem' }}>

            {/* Step 1 + Step 2 as a connected pair */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>

              {/* Step 1 — Product Taste Analysis */}
              <button
                onClick={startExercise}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem', padding: '1.375rem', borderRadius: '20px', border: 'none', background: GRAD, color: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(124,58,237,0.3)', textAlign: 'left', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(124,58,237,0.38)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(124,58,237,0.3)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FlaskConical size={20} color="white" />
                  </div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.2rem 0.625rem', borderRadius: '999px', letterSpacing: '0.04em' }}>STEP 1 · ARTICULATE</span>
                </div>
                <div>
                  <p style={{ margin: '0 0 0.25rem', fontWeight: 700, fontSize: '1rem', color: 'white' }}>Product Taste Analysis</p>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.55 }}>Pick any product. Answer 6 questions with an AI companion. Discover and articulate your real product instincts.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginTop: '0.125rem' }}>
                  Start Exploring <ArrowRight size={14} />
                </div>
              </button>

              {/* Step 2 — Real Friction Cases */}
              <button
                onClick={() => setView('friction')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem', padding: '1.375rem', borderRadius: '20px', border: '2px solid #FDE68A', backgroundColor: 'white', color: '#1F2937', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 12px rgba(217,119,6,0.1)', textAlign: 'left', transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(217,119,6,0.18)'; (e.currentTarget as HTMLElement).style.borderColor = '#D97706'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(217,119,6,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = '#FDE68A'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #D97706, #F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap size={20} color="white" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#D97706', backgroundColor: '#FFFBEB', padding: '0.2rem 0.625rem', borderRadius: '999px', letterSpacing: '0.04em', border: '1px solid #FDE68A' }}>STEP 2 · DIAGNOSE</span>
                    <span style={{ padding: '0.2rem 0.45rem', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, backgroundColor: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                      ⚡ feeds Influence
                      <InfoTooltip
                        side="top"
                        width={230}
                        text="Your score on each case is recorded and builds your Insight Credibility score on the Influence page. Expert tags unlock when you get ≥60% accuracy in a theme."
                        iconSize={11}
                        iconColor="#D97706"
                      />
                    </span>
                  </div>
                </div>
                <div>
                  <p style={{ margin: '0 0 0.25rem', fontWeight: 700, fontSize: '1rem', color: '#111827' }}>Real Friction Cases</p>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.55 }}>Analyse anonymised friction signals from real products. Diagnose the root issue and recommend the fix — scored against actual outcomes.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, color: '#D97706', marginTop: '0.125rem' }}>
                  Diagnose Cases <ArrowRight size={14} />
                </div>
              </button>
            </div>

            {/* Connection label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', justifyContent: 'center' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB', maxWidth: '100px' }} />
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 500, padding: '0.2rem 0.75rem', borderRadius: '999px', backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                Articulate your perspective → then validate it with real data
              </span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB', maxWidth: '100px' }} />
            </div>

            {/* PM Interview — secondary card */}
            <button
              onClick={() => setView('interview')}
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', borderRadius: '16px', border: '1.5px solid #EDE9FE', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: '0 1px 4px rgba(124,58,237,0.06)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = PRIMARY; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(124,58,237,0.12)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#EDE9FE'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(124,58,237,0.06)'; }}
            >
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Mic2 size={18} color="white" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 0.125rem', fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>PM Interview Practice</p>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6B7280' }}>150 real PM questions across Product Sense, Analytical Thinking & Behavioral.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', fontWeight: 600, color: PRIMARY, flexShrink: 0 }}>
                Practice <ArrowRight size={13} />
              </div>
            </button>
          </motion.div>
        </div>

        {/* Chat preview card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{ maxWidth: '680px', margin: '3.5rem auto 0', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 24px 60px rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.15)' }}
        >
          {/* Card header */}
          <div style={{ background: GRAD, padding: '1rem 1.375rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FlaskConical size={18} color="white" />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: 'white' }}>Product Taste Exercise</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)' }}>Your Product Growth Companion</p>
            </div>
          </div>
          {/* Card body */}
          <div style={{ backgroundColor: 'white', padding: '1.25rem' }}>
            <div style={{ display: 'inline-flex', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '0.625rem 1rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#374151' }}><strong>Question 1 of 6:</strong> What's your overall take on this product? Do you like it or not, and why?</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <div style={{ background: GRAD, borderRadius: '14px 14px 0 14px', padding: '0.75rem 1rem', maxWidth: '82%', boxShadow: '0 2px 8px rgba(124,58,237,0.2)' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'white', lineHeight: 1.6 }}>I really like the collaborative features in Figma. The real-time multiplayer feels like magic…</p>
              </div>
            </div>
            <div style={{ backgroundColor: '#F5F3FF', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <Sparkles size={13} color={PRIMARY} style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <p style={{ margin: '0 0 0.125rem', fontSize: '0.6875rem', fontWeight: 600, color: PRIMARY }}>What you'll explore:</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#6B7280' }}>Your instincts · Creative ideas · Different users · Team context · The bigger picture</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── How It Works ── */}
      <section id="how" style={{ padding: '5rem 1.5rem', backgroundColor: '#1F2937' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 800, color: 'white', margin: '0 0 0.75rem' }}>How It Works</h2>
          <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)', margin: '0 0 3rem' }}>Two exercises that build on each other — articulate your perspective, then test your analytical accuracy</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            {[
              { num: 1, icon: FlaskConical, title: 'Pick a Product', desc: 'Choose any product you\'ve used and want to think through — Notion, Figma, Spotify, or anything you\'re curious about.' },
              { num: 2, icon: Sparkles, title: 'Share Your Thoughts', desc: 'Answer six open questions at your own pace. There are no wrong answers — just your honest perspective.' },
              { num: 3, icon: TrendingUp, title: 'Get Personal Insights', desc: 'Your AI companion reflects back what it noticed in your thinking, with specific encouragement and ideas to explore.' },
            ].map(step => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (step.num - 1) * 0.1 }}
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: '18px', padding: '1.75rem 1.375rem', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}
              >
                <div style={{ width: '56px', height: '56px', borderRadius: '15px', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.125rem' }}>
                  <step.icon size={24} color="white" />
                </div>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: 'white', margin: '0 0 0.5rem' }}>{step.num}. {step.title}</p>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The 6 Questions ── */}
      <section id="questions" style={{ padding: '5rem 1.5rem', backgroundColor: 'white' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 800, color: '#111827', margin: '0 0 0.75rem' }}>The 6 Questions</h2>
            <p style={{ fontSize: '1rem', color: '#6B7280', margin: 0 }}>Six open prompts to help you explore your natural product instincts — no preparation needed</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {QUESTION_META.map((q, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', backgroundColor: '#FAFAFA', border: '1.5px solid #F3F4F6', borderRadius: '16px', padding: '1.125rem 1.375rem', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD6FE'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(124,58,237,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#F3F4F6'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'white' }}>{i + 1}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem' }}>Q{i + 1}: {q.title}</p>
                  <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 0.5rem', lineHeight: 1.55 }}>{q.short}</p>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.625rem', borderRadius: '999px', border: '1px solid #EDE9FE', backgroundColor: '#F5F3FF', fontSize: '0.75rem', fontWeight: 500, color: PRIMARY }}>
                    <Check size={11} /> {q.skill}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What Gets Rewarded ── */}
      <section style={{ padding: '5rem 1.5rem', backgroundColor: BG }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 800, color: '#111827', margin: '0 0 0.75rem' }}>How Your AI Companion Thinks</h2>
            <p style={{ fontSize: '1rem', color: '#6B7280', margin: 0 }}>Your companion looks for depth and honesty — not perfect answers</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '3rem' }}>
            {/* Rewarded */}
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ backgroundColor: 'white', border: '1.5px solid #D1FAE5', borderRadius: '18px', padding: '1.5rem', boxShadow: '0 4px 16px rgba(22,163,74,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.125rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={20} color="white" />
                </div>
                <span style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#111827' }}>Your thinking shines when you…</span>
              </div>
              {['Share specific observations, not just opinions', 'Acknowledge tradeoffs and competing needs', 'Think about who a product is really for', 'Try to understand why the team made their choices', 'Connect decisions to market or user behaviour', 'Communicate your idea in a clear, structured way'].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.625rem' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                    <Check size={11} color="white" />
                  </div>
                  <span style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </motion.div>

            {/* Penalized */}
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} style={{ backgroundColor: 'white', border: '1.5px solid #FDE68A', borderRadius: '18px', padding: '1.5rem', boxShadow: '0 4px 16px rgba(217,119,6,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.125rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={20} color="white" />
                </div>
                <span style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#111827' }}>Easy habits to grow past</span>
              </div>
              {['"Make it cleaner" without explaining why', 'Confident conclusions with no reasoning behind them', 'Treating every user as if they\'re the same', 'Describing the product without forming a real opinion', 'Skipping the question of who this change is for', 'A pitch that\'s vague about the problem it solves'].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.625rem' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                    <ArrowRight size={11} color="white" />
                  </div>
                  <span style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Verdict scale */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: '0 0 1.125rem' }}>Your Growth Stage</p>
            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {VERDICT_SCALE.map(v => (
                <motion.div
                  key={v.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  style={{ backgroundColor: v.bg, borderRadius: '14px', padding: '0.875rem 1.125rem', minWidth: '90px', textAlign: 'center' }}
                >
                  <Star size={16} fill="white" color="white" style={{ display: 'block', margin: '0 auto 0.375rem' }} />
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{v.range}</p>
                  <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: 'white' }}>{v.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{ padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ background: GRAD, borderRadius: '24px', padding: '3.5rem 2rem', textAlign: 'center', boxShadow: '0 20px 60px rgba(124,58,237,0.28)' }}
          >
            <Brain size={44} color="white" style={{ display: 'block', margin: '0 auto 1.25rem' }} />
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, color: 'white', margin: '0 0 0.875rem', lineHeight: 1.25 }}>
              Ready to sharpen your product skills?
            </h2>
            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.8)', margin: '0 auto 2rem', maxWidth: '440px', lineHeight: 1.65 }}>
              Articulate your product perspective, diagnose real friction, and practise PM interviews — each builds your product intelligence.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={startExercise} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.375rem', borderRadius: '12px', border: 'none', backgroundColor: 'white', color: PRIMARY, fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                <FlaskConical size={16} /> Product Taste
              </button>
              <button onClick={() => setView('interview')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.375rem', borderRadius: '12px', border: '2px solid rgba(255,255,255,0.4)', backgroundColor: 'transparent', color: 'white', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Mic2 size={16} /> Interview Prep
              </button>
              <button onClick={() => setView('friction')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.375rem', borderRadius: '12px', border: '2px solid rgba(255,255,255,0.4)', backgroundColor: 'transparent', color: 'white', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Zap size={16} /> Friction Cases
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '1.5rem', textAlign: 'center', borderTop: '1px solid #E5E7EB', backgroundColor: 'white' }}>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9CA3AF' }}>
          Sharpen your product, EQ, and tech skills with HelloEQ
        </p>
      </footer>
    </div>
  );
}

