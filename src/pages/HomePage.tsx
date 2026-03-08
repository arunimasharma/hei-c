import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Send, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, Edit3, ArrowRight, BookOpen,
  Zap, Clock, SkipForward, RefreshCw, TrendingUp,
  FlaskConical, Star, ChevronRight,
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/common/Button';
import { useApp } from '../context/AppContext';
import { useJournalAnalysis } from '../hooks/useJournalAnalysis';
import { useTasteExercise } from '../hooks/useTasteExercise';
import { callClaudeMessages, parseActionResponse } from '../services/claudeApi';
import { EMOTIONS, getEmotionColor, getEmotionIcon } from '../utils/emotionHelpers';
import type { EmotionType, EventType, JournalReflection, TasteExercise } from '../types';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const INITIAL_CHAT_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: "Hey! I'm here to listen. What's been on your mind at work lately? Share anything — big or small, and we'll make sense of it together.",
};

const CHAT_FOLLOWUP_SYSTEM_PROMPT = `You are Hello-EQ, an empathetic AI journaling coach helping someone reflect on their work emotions and career experiences.

Based on what the user has shared so far in this journaling session, ask ONE thoughtful follow-up question that:
- Helps them go deeper into their emotional experience at work
- Is specific and personal to what they've shared (not generic)
- Is empathetic, curious, and non-judgmental
- Opens up a new dimension of reflection they haven't yet explored
- Is concise (1–2 sentences max)

Respond with ONLY the question text. No preamble, no sign-off, no explanation.`;

const EVENT_TYPES: EventType[] = [
  'Meeting', 'Project', 'Review', 'Interview', 'Promotion',
  'Feedback', 'Presentation', 'Deadline', 'Conflict', 'Achievement', 'Learning', 'Other',
];

const COMPANION_QUESTIONS = [
  "What's been on your mind at work?",
  "How did things go today?",
  "What's been draining your energy lately?",
  "Anything you're proud of recently?",
  "What's making you feel uncertain right now?",
  "How are you really feeling about your work?",
];

const STARTER_PROMPTS = [
  { label: 'Tough meeting', text: 'I had a tough meeting today — ', icon: '📅' },
  { label: 'Feeling proud', text: "I'm feeling proud because ", icon: '🌟' },
  { label: 'Anxious about', text: "I've been anxious about ", icon: '😟' },
  { label: 'Got feedback', text: 'I received feedback today that ', icon: '💬' },
  { label: 'Low energy', text: 'My energy has been low because ', icon: '🔋' },
  { label: 'Big win', text: 'Something went really well — ', icon: '🎉' },
  { label: 'Deadline stress', text: "There's a deadline coming up and ", icon: '⏰' },
  { label: 'Team tension', text: "There's tension with someone at work — ", icon: '🤝' },
];


const CATEGORY_COLORS: Record<string, string> = {
  'Stress Relief': '#34D399',
  'Confidence Building': '#8B5CF6',
  'Energy Boost': '#F59E0B',
  'Reflection': '#3B82F6',
  'Grounding': '#6EE7B7',
  'Gratitude': '#84CC16',
  'Self-Care': '#EC4899',
};

type Phase = 'writing' | 'analyzing' | 'review' | 'success';

export default function HomePage() {
  const { state, addEmotion, addEvent, addReflection, updateReflection, completeAction, skipAction, dismissAction, refreshActions, addTasteExercise, llmState, checkAndUseAi } = useApp();
  const { analysisState, analyzeJournal, resetAnalysis } = useJournalAnalysis();
  const te = useTasteExercise();

  const [phase, setPhase] = useState<Phase>('writing');
  const [journalText, setJournalText] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [skipConfirmId, setSkipConfirmId] = useState<string | null>(null);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [reflectionsExpanded, setReflectionsExpanded] = useState(false);

  // Taste Exercise local state
  const [teOpen, setTeOpen] = useState(false);
  const [teProductInput, setTeProductInput] = useState('');
  const [teCurrentAnswer, setTeCurrentAnswer] = useState('');

  // Chat journal state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([INITIAL_CHAT_MESSAGE]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const toggleReasoning = (id: string) => {
    setExpandedReasoning(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (journalText) return;
    const timer = setInterval(() => {
      setQuestionIdx(i => (i + 1) % COMPANION_QUESTIONS.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [journalText]);

  // Manual overrides
  const [manualEmotion, setManualEmotion] = useState<EmotionType | null>(null);
  const [manualEventType, setManualEventType] = useState<EventType | null>(null);
  const [manualCompany, setManualCompany] = useState('');

  // Review editable fields
  const [reviewEmotion, setReviewEmotion] = useState<EmotionType>('Stress');
  const [reviewIntensity, setReviewIntensity] = useState(5);
  const [reviewEventType, setReviewEventType] = useState<EventType | null>(null);
  const [reviewCompany, setReviewCompany] = useState('');
  const [reflectionId, setReflectionId] = useState('');

  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const handleAnalyze = async (textOverride?: string) => {
    const text = textOverride ?? journalText;
    if (!text.trim()) return;
    if (!checkAndUseAi()) return;
    if (textOverride) setJournalText(textOverride);
    setPhase('analyzing');

    const id = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setReflectionId(id);

    // Save draft reflection
    const draft: JournalReflection = {
      id,
      text,
      timestamp: new Date().toISOString(),
      status: 'draft',
    };
    addReflection(draft);

    const approvedReflections = state.reflections.filter(r => r.status === 'approved');
    const result = await analyzeJournal(text, state.user, approvedReflections);

    if (result) {
      // Use manual overrides if provided, otherwise use detected
      const emotion = (manualEmotion || result.emotion) as EmotionType;
      const eventType = manualEventType || (result.eventType as EventType | null);
      const company = manualCompany || result.companyName || '';

      setReviewEmotion(emotion);
      setReviewIntensity(result.intensity);
      setReviewEventType(eventType);
      setReviewCompany(company);

      updateReflection(id, {
        status: 'analyzed',
        detectedEmotion: result.emotion as EmotionType,
        detectedIntensity: result.intensity,
        detectedEventType: result.eventType as EventType | undefined,
        detectedCompanyName: result.companyName || undefined,
        detectedTriggers: result.triggers,
        detectedSummary: result.summary,
      });

      setPhase('review');
    } else {
      // Error occurred — go back to writing
      setPhase('writing');
    }
  };

  const handleApprove = () => {
    const emotionId = `emo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const userId = state.user?.id || 'anonymous';

    // Create EmotionEntry
    addEmotion({
      id: emotionId,
      userId,
      emotion: reviewEmotion,
      intensity: reviewIntensity,
      timestamp: new Date().toISOString(),
      notes: journalText,
      triggers: analysisState.result?.triggers,
    });

    let eventId: string | undefined;

    // Create CareerEvent if event type is present
    if (reviewEventType) {
      eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      addEvent({
        id: eventId,
        userId,
        title: reviewCompany
          ? `${reviewEventType} at ${reviewCompany}`
          : reviewEventType,
        type: reviewEventType,
        date: new Date().toISOString(),
        description: analysisState.result?.summary,
        emotionIds: [emotionId],
      });
    }

    // Update reflection as approved
    updateReflection(reflectionId, {
      status: 'approved',
      approvedEmotion: reviewEmotion,
      approvedIntensity: reviewIntensity,
      approvedEventType: reviewEventType || undefined,
      approvedCompanyName: reviewCompany || undefined,
      createdEmotionId: emotionId,
      createdEventId: eventId,
    });

    setPhase('success');
  };

  const handleWriteAnother = () => {
    setJournalText('');
    setManualEmotion(null);
    setManualEventType(null);
    setManualCompany('');
    setShowManual(false);
    setChatMessages([INITIAL_CHAT_MESSAGE]);
    setChatInput('');
    setChatLoading(false);
    resetAnalysis();
    setPhase('writing');
  };

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    if (!checkAndUseAi()) return;
    const updatedMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      const response = await callClaudeMessages(
        CHAT_FOLLOWUP_SYSTEM_PROMPT,
        updatedMessages.map(m => ({ role: m.role, content: m.content })),
        180,
      );
      const question = parseActionResponse(response).trim();
      setChatMessages(prev => [...prev, { role: 'assistant', content: question }]);
    } catch {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: "What else is on your mind about this?",
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleFinishEntry = () => {
    const allUserText = chatMessages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n\n');
    if (!allUserText.trim()) return;
    handleAnalyze(allUserText);
  };

  const handleTeStart = () => {
    if (!teProductInput.trim()) return;
    te.startExercise(teProductInput);
    setTeCurrentAnswer('');
  };

  const handleTeNext = () => {
    if (te.nextQuestion(teCurrentAnswer)) {
      setTeCurrentAnswer('');
    }
  };

  const handleTeFinish = async () => {
    const data = await te.finishEntry(teCurrentAnswer);
    if (data) setTeCurrentAnswer('');
  };

  const handleTeSave = () => {
    if (!te.result) return;
    const exercise: TasteExercise = {
      id: `te_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: state.user?.id || 'anonymous',
      productName: te.productName,
      answers: te.answers,
      summary: te.result.summary,
      score: te.result.score,
      scoreComment: te.result.scoreComment,
      timestamp: new Date().toISOString(),
      status: 'completed',
    };
    addTasteExercise(exercise);
    te.reset();
    setTeOpen(false);
    setTeProductInput('');
    setTeCurrentAnswer('');
  };

  const handleTeClose = () => {
    te.reset();
    setTeOpen(false);
    setTeProductInput('');
    setTeCurrentAnswer('');
  };

  const sentimentBadge = (sentiment: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      positive: { bg: '#F0FDF4', color: '#16A34A', label: 'Positive' },
      negative: { bg: '#FEF2F2', color: '#DC2626', label: 'Negative' },
      mixed: { bg: '#FFFBEB', color: '#D97706', label: 'Mixed' },
      neutral: { bg: '#F9FAFB', color: '#6B7280', label: 'Neutral' },
    };
    const s = map[sentiment] || map.neutral;
    return (
      <span style={{
        fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.75rem',
        borderRadius: '999px', backgroundColor: s.bg, color: s.color,
      }}>
        {s.label}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: '48rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* ── GREETING ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', fontWeight: 500, letterSpacing: '0.02em', marginBottom: '0.375rem' }}>
            {dateStr}
          </p>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1F2937', letterSpacing: '-0.025em', lineHeight: 1.2, margin: '0 0 0.875rem' }}>
            {greeting}, {state.user?.name || 'Friend'}
          </h1>
          {(state.reflections.filter(r => r.status === 'approved').length > 0 || state.actions.filter(a => a.completed).length > 0) && (
            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
              {state.reflections.filter(r => r.status === 'approved').length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.25rem 0.75rem', borderRadius: '999px',
                  backgroundColor: 'rgba(74,95,193,0.07)', border: '1px solid rgba(74,95,193,0.12)',
                }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#4A5FC1' }} />
                  <span style={{ fontSize: '0.75rem', color: '#4A5FC1', fontWeight: 500 }}>
                    {state.reflections.filter(r => r.status === 'approved').length} reflection{state.reflections.filter(r => r.status === 'approved').length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {state.actions.filter(a => a.completed).length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.25rem 0.75rem', borderRadius: '999px',
                  backgroundColor: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.12)',
                }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
                  <span style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 500 }}>
                    {state.actions.filter(a => a.completed).length} action{state.actions.filter(a => a.completed).length !== 1 ? 's' : ''} done
                  </span>
                </div>
              )}
            </div>
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ---- WRITING PHASE ---- */}
          {phase === 'writing' && (
            <motion.div
              key="writing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              {/* ── JOURNAL CARD (hero) ── */}
              <div style={{
                backgroundColor: 'white', borderRadius: '20px', border: '1px solid #E5E7EB',
                boxShadow: '0 4px 24px rgba(0,0,0,0.04)', overflow: 'hidden',
              }}>
                {/* Companion header */}
                <div style={{
                  padding: '1.375rem 1.5rem 1rem',
                  background: 'linear-gradient(135deg, rgba(74,95,193,0.04) 0%, rgba(139,126,200,0.07) 100%)',
                  borderBottom: '1px solid #F3F4F6',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                      background: 'linear-gradient(135deg, #4A5FC1 0%, #8B7EC8 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Sparkles size={15} color="white" />
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={questionIdx}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.3 }}
                        style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: 0 }}
                      >
                        {COMPANION_QUESTIONS[questionIdx]}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Starter prompt chips — shown only before first user message */}
                {!chatMessages.some(m => m.role === 'user') && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    style={{ padding: '0.875rem 1.25rem 0.375rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
                  >
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt.label}
                        onClick={() => setChatInput(chatInput ? chatInput : prompt.text)}
                        style={{
                          padding: '0.375rem 0.75rem', borderRadius: '999px',
                          border: '1.5px solid #E5E7EB', backgroundColor: 'white',
                          fontSize: '0.8125rem', color: '#6B7280', cursor: 'pointer',
                          fontFamily: 'inherit', transition: 'all 0.15s',
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = '#8B7EC8';
                          e.currentTarget.style.color = '#4A5FC1';
                          e.currentTarget.style.backgroundColor = 'rgba(74,95,193,0.04)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = '#E5E7EB';
                          e.currentTarget.style.color = '#6B7280';
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        <span>{prompt.icon}</span> {prompt.label}
                      </button>
                    ))}
                  </motion.div>
                )}

                {/* Chat messages area */}
                {chatMessages.length > 0 && (
                  <div style={{
                    maxHeight: '320px', overflowY: 'auto',
                    padding: '0.875rem 1.25rem',
                    display: 'flex', flexDirection: 'column', gap: '0.75rem',
                  }}>
                    <AnimatePresence initial={false}>
                      {chatMessages.map((msg, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{
                            display: 'flex',
                            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            alignItems: 'flex-end', gap: '0.5rem',
                          }}
                        >
                          {msg.role === 'assistant' && (
                            <div style={{
                              width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
                              background: 'linear-gradient(135deg, #4A5FC1 0%, #8B7EC8 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Sparkles size={13} color="white" />
                            </div>
                          )}
                          <div style={{
                            maxWidth: '78%',
                            padding: '0.625rem 0.875rem',
                            borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                            backgroundColor: msg.role === 'user' ? '#4A5FC1' : '#F3F4F6',
                            color: msg.role === 'user' ? 'white' : '#1F2937',
                            fontSize: '0.9rem', lineHeight: 1.55,
                          }}>
                            {msg.content}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {chatLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}
                      >
                        <div style={{
                          width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
                          background: 'linear-gradient(135deg, #4A5FC1 0%, #8B7EC8 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Sparkles size={13} color="white" />
                        </div>
                        <div style={{
                          padding: '0.625rem 0.875rem', borderRadius: '14px 14px 14px 4px',
                          backgroundColor: '#F3F4F6', display: 'flex', gap: '0.25rem', alignItems: 'center',
                        }}>
                          {[0, 1, 2].map(d => (
                            <motion.span
                              key={d}
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.2 }}
                              style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#9CA3AF', display: 'inline-block' }}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}

                {/* Chat input row */}
                <div style={{
                  padding: '0.625rem 1rem',
                  borderTop: chatMessages.length > 0 ? '1px solid #F3F4F6' : 'none',
                  display: 'flex', gap: '0.5rem', alignItems: 'flex-end',
                }}>
                  <textarea
                    ref={textareaRef}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSend();
                      }
                    }}
                    placeholder="Share what's on your mind… (Enter to send)"
                    rows={2}
                    style={{
                      flex: 1, border: '1px solid #E5E7EB', borderRadius: '12px',
                      padding: '0.625rem 0.875rem', fontSize: '0.9375rem', lineHeight: 1.6,
                      color: '#1F2937', resize: 'none', fontFamily: 'inherit',
                      outline: 'none', backgroundColor: 'white',
                    }}
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || chatLoading}
                    style={{
                      width: '40px', height: '40px', borderRadius: '12px', border: 'none',
                      background: chatInput.trim() && !chatLoading
                        ? 'linear-gradient(135deg, #4A5FC1 0%, #8B7EC8 100%)'
                        : '#E5E7EB',
                      cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
                    <Send size={16} color={chatInput.trim() && !chatLoading ? 'white' : '#9CA3AF'} />
                  </button>
                </div>

                {/* Finish Entry — shown after first message */}
                {chatMessages.some(m => m.role === 'user') && (
                  <div style={{ padding: '0.5rem 1rem 0.875rem', display: 'flex', gap: '0.625rem' }}>
                    <button
                      onClick={handleFinishEntry}
                      disabled={chatLoading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.375rem',
                        padding: '0.5rem 1rem', borderRadius: '10px', border: 'none',
                        background: 'linear-gradient(135deg, #4A5FC1 0%, #8B7EC8 100%)',
                        color: 'white', fontSize: '0.8125rem', fontWeight: 600,
                        cursor: chatLoading ? 'default' : 'pointer', fontFamily: 'inherit',
                        opacity: chatLoading ? 0.6 : 1,
                      }}
                    >
                      <CheckCircle2 size={14} /> Finish Entry
                    </button>
                  </div>
                )}
              </div>

              {/* Error banner */}
              {analysisState.error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.875rem 1.25rem', borderRadius: '14px',
                    backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
                  }}
                >
                  <AlertTriangle size={18} style={{ color: '#D97706', flexShrink: 0 }} />
                  <p style={{ fontSize: '0.875rem', color: '#92400E' }}>{analysisState.error}</p>
                </motion.div>
              )}

              {/* ── CUSTOMIZE DETECTION (collapsible) ── */}
              <div style={{
                backgroundColor: 'white', borderRadius: '16px', border: '1px solid #F3F4F6',
                overflow: 'hidden',
              }}>
                <button
                  onClick={() => setShowManual(!showManual)}
                  style={{
                    width: '100%', padding: '0.875rem 1.25rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#9CA3AF' }}>
                    Customize detection
                  </span>
                  {showManual ? <ChevronUp size={15} color="#D1D5DB" /> : <ChevronDown size={15} color="#D1D5DB" />}
                </button>

                {showManual && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
                  >
                    {/* Emotion picker */}
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.5rem', display: 'block' }}>
                        Emotion (override AI detection)
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                        {EMOTIONS.map(e => (
                          <button
                            key={e.type}
                            onClick={() => setManualEmotion(manualEmotion === e.type ? null : e.type)}
                            style={{
                              padding: '0.375rem 0.75rem', borderRadius: '999px', border: '2px solid',
                              borderColor: manualEmotion === e.type ? e.color : '#E5E7EB',
                              backgroundColor: manualEmotion === e.type ? `${e.color}15` : 'white',
                              cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit',
                              color: manualEmotion === e.type ? e.color : '#6B7280',
                              fontWeight: manualEmotion === e.type ? 600 : 400,
                              transition: 'all 0.2s',
                            }}
                          >
                            {e.icon} {e.type}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Event type */}
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.5rem', display: 'block' }}>
                        Career Event Type
                      </label>
                      <select
                        value={manualEventType || ''}
                        onChange={(e) => setManualEventType(e.target.value ? e.target.value as EventType : null)}
                        style={{
                          width: '100%', padding: '0.625rem 0.875rem', borderRadius: '10px',
                          border: '1px solid #E5E7EB', fontSize: '0.875rem', fontFamily: 'inherit',
                          color: '#1F2937', backgroundColor: 'white', outline: 'none',
                        }}
                      >
                        <option value="">Let AI detect</option>
                        {EVENT_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* Company */}
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.5rem', display: 'block' }}>
                        Company / Organization
                      </label>
                      <input
                        type="text"
                        value={manualCompany}
                        onChange={(e) => setManualCompany(e.target.value)}
                        placeholder="Let AI detect or type here"
                        style={{
                          width: '100%', padding: '0.625rem 0.875rem', borderRadius: '10px',
                          border: '1px solid #E5E7EB', fontSize: '0.875rem', fontFamily: 'inherit',
                          color: '#1F2937', outline: 'none',
                        }}
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* ── SUGGESTED ACTIONS (collapsible) ── */}
              {(() => {
                const activeActions = state.actions.filter(a => !a.completed && !a.skipped);
                const shown = activeActions.slice(0, 3);
                return (
                  <div style={{
                    backgroundColor: 'white', borderRadius: '16px', border: '1px solid #F3F4F6',
                    overflow: 'hidden',
                  }}>
                    <button
                      onClick={() => setActionsExpanded(!actionsExpanded)}
                      style={{
                        width: '100%', padding: '0.875rem 1.25rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Zap size={14} color="#F59E0B" />
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937' }}>Suggested Actions</span>
                        {llmState.isAiGenerated && (
                          <span style={{
                            fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.5rem',
                            borderRadius: '999px', backgroundColor: 'rgba(139,92,246,0.1)', color: '#7C3AED',
                          }}>AI</span>
                        )}
                        {shown.length > 0 && (
                          <span style={{
                            fontSize: '0.6875rem', fontWeight: 600, padding: '0.125rem 0.5rem',
                            borderRadius: '999px', backgroundColor: '#FEF3C7', color: '#D97706',
                          }}>{shown.length}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        {activeActions.length > 3 && actionsExpanded && (
                          <Link
                            to="/growth"
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: '0.75rem', color: '#4A5FC1', textDecoration: 'none', fontWeight: 500 }}
                          >
                            View all
                          </Link>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); refreshActions(); }}
                          disabled={llmState.isLoading}
                          style={{
                            padding: '0.25rem', borderRadius: '8px', border: 'none',
                            backgroundColor: 'transparent', cursor: llmState.isLoading ? 'default' : 'pointer',
                            color: '#9CA3AF', display: 'flex',
                          }}
                          title="Refresh actions"
                        >
                          <RefreshCw size={13} style={{ animation: llmState.isLoading ? 'spin 1s linear infinite' : 'none' }} />
                        </button>
                        {actionsExpanded ? <ChevronUp size={15} color="#D1D5DB" /> : <ChevronDown size={15} color="#D1D5DB" />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {actionsExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{ padding: '0 0.75rem 0.75rem' }}>
                            {llmState.isLoading && (
                              <div style={{
                                padding: '1.25rem', borderRadius: '12px', backgroundColor: '#F9FAFB',
                                textAlign: 'center',
                              }}>
                                <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>
                                  Generating personalized suggestions...
                                </p>
                              </div>
                            )}

                            {!llmState.isLoading && shown.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {shown.map(action => {
                                  const catColor = CATEGORY_COLORS[action.category] || '#6B7280';
                                  const isExpanded = expandedReasoning.has(action.id);
                                  return (
                                    <motion.div
                                      key={action.id}
                                      initial={{ opacity: 0, y: 6 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      style={{
                                        backgroundColor: '#FAFAFA', borderRadius: '12px',
                                        border: '1px solid #F3F4F6', overflow: 'hidden',
                                      }}
                                    >
                                      <div style={{ padding: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                        <div style={{
                                          width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                                          backgroundColor: `${catColor}18`,
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                          <Zap size={14} style={{ color: catColor }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', margin: '0 0 0.25rem' }}>
                                            {action.title}
                                          </p>
                                          {action.description && (
                                            <p style={{ fontSize: '0.8125rem', color: '#4B5563', lineHeight: 1.5, margin: '0 0 0.375rem' }}>
                                              {action.description}
                                            </p>
                                          )}
                                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <span style={{
                                              fontSize: '0.6875rem', fontWeight: 500, padding: '0.125rem 0.5rem',
                                              borderRadius: '999px', backgroundColor: `${catColor}15`, color: catColor,
                                            }}>
                                              {action.category}
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.6875rem', color: '#9CA3AF' }}>
                                              <Clock size={11} /> {action.estimatedMinutes} min
                                            </span>
                                            {action.reasoning && (
                                              <button
                                                onClick={() => toggleReasoning(action.id)}
                                                style={{
                                                  display: 'flex', alignItems: 'center', gap: '0.15rem',
                                                  fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 500,
                                                  background: 'none', border: 'none', cursor: 'pointer',
                                                  padding: 0, fontFamily: 'inherit',
                                                }}
                                              >
                                                {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                                Why this?
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                          <button
                                            onClick={() => completeAction(action.id)}
                                            style={{
                                              padding: '0.4rem', borderRadius: '8px', border: 'none',
                                              backgroundColor: '#F0FDF4', color: '#16A34A', cursor: 'pointer', display: 'flex',
                                            }}
                                            title="Mark done"
                                          >
                                            <CheckCircle2 size={15} />
                                          </button>
                                          <button
                                            onClick={() => setSkipConfirmId(action.id)}
                                            title="Skip"
                                            style={{
                                              padding: '0.4rem', borderRadius: '8px', border: 'none',
                                              backgroundColor: skipConfirmId === action.id ? '#FEF3C7' : '#F9FAFB',
                                              color: skipConfirmId === action.id ? '#D97706' : '#9CA3AF',
                                              cursor: 'pointer', display: 'flex',
                                            }}
                                          >
                                            <SkipForward size={15} />
                                          </button>
                                        </div>
                                      </div>
                                      {/* Skip confirmation panel */}
                                      <AnimatePresence>
                                        {skipConfirmId === action.id && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.18 }}
                                            style={{ overflow: 'hidden' }}
                                          >
                                            <div style={{
                                              padding: '0.625rem 1.125rem 0.75rem',
                                              borderTop: '1px solid #FDE68A',
                                              backgroundColor: '#FFFBEB',
                                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
                                            }}>
                                              <p style={{ fontSize: '0.8125rem', color: '#92400E', margin: 0 }}>
                                                Skip this action?
                                              </p>
                                              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                                <button
                                                  onClick={() => { dismissAction(action.id); setSkipConfirmId(null); }}
                                                  style={{
                                                    fontSize: '0.75rem', fontWeight: 500, padding: '0.3rem 0.625rem',
                                                    borderRadius: '6px', border: '1px solid #FCD34D',
                                                    backgroundColor: 'white', color: '#92400E', cursor: 'pointer', fontFamily: 'inherit',
                                                  }}
                                                >
                                                  Skip for now
                                                </button>
                                                <button
                                                  onClick={() => { skipAction(action.id); setSkipConfirmId(null); }}
                                                  style={{
                                                    fontSize: '0.75rem', fontWeight: 500, padding: '0.3rem 0.625rem',
                                                    borderRadius: '6px', border: 'none',
                                                    backgroundColor: '#F59E0B', color: 'white', cursor: 'pointer', fontFamily: 'inherit',
                                                  }}
                                                >
                                                  Skip forever
                                                </button>
                                                <button
                                                  onClick={() => setSkipConfirmId(null)}
                                                  style={{
                                                    fontSize: '0.75rem', color: '#9CA3AF', background: 'none',
                                                    border: 'none', cursor: 'pointer', padding: '0.3rem 0.25rem', fontFamily: 'inherit',
                                                  }}
                                                >
                                                  Cancel
                                                </button>
                                              </div>
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>

                                      {/* Reasoning panel */}
                                      <AnimatePresence>
                                        {isExpanded && action.reasoning && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            style={{ overflow: 'hidden' }}
                                          >
                                            <div style={{
                                              padding: '0.5rem 1rem 0.75rem',
                                              borderTop: `1px solid ${catColor}20`,
                                              backgroundColor: `${catColor}06`,
                                              display: 'flex', alignItems: 'flex-start', gap: '0.4rem',
                                            }}>
                                              <TrendingUp size={12} style={{ color: catColor, flexShrink: 0, marginTop: '0.15rem' }} />
                                              <p style={{ fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.5, margin: 0 }}>
                                                {action.reasoning}
                                              </p>
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </motion.div>
                                  );
                                })}
                              </div>
                            )}

                            {!llmState.isLoading && shown.length === 0 && (
                              <div style={{
                                padding: '1.25rem', borderRadius: '12px', backgroundColor: '#F9FAFB',
                                textAlign: 'center',
                              }}>
                                <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: '0 0 0.625rem' }}>
                                  Log a reflection to get personalized action suggestions.
                                </p>
                                <button
                                  onClick={refreshActions}
                                  style={{
                                    fontSize: '0.8125rem', color: '#4A5FC1', fontWeight: 500,
                                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                  }}
                                >
                                  Generate suggestions →
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })()}

              {/* ── RECENT REFLECTIONS (collapsible) ── */}
              {state.reflections.filter(r => r.status === 'approved').length > 0 && (
                <div style={{
                  backgroundColor: 'white', borderRadius: '16px', border: '1px solid #F3F4F6',
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={() => setReflectionsExpanded(!reflectionsExpanded)}
                    style={{
                      width: '100%', padding: '0.875rem 1.25rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <BookOpen size={14} color="#9CA3AF" />
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937' }}>Recent Reflections</span>
                      <span style={{
                        fontSize: '0.6875rem', fontWeight: 600, padding: '0.125rem 0.5rem',
                        borderRadius: '999px', backgroundColor: '#F3F4F6', color: '#6B7280',
                      }}>
                        {state.reflections.filter(r => r.status === 'approved').length}
                      </span>
                    </div>
                    {reflectionsExpanded ? <ChevronUp size={15} color="#D1D5DB" /> : <ChevronDown size={15} color="#D1D5DB" />}
                  </button>

                  <AnimatePresence>
                    {reflectionsExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ padding: '0 0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                          {state.reflections.filter(r => r.status === 'approved').slice(0, 3).map(r => (
                            <div key={r.id} style={{
                              backgroundColor: '#FAFAFA', borderRadius: '10px', border: '1px solid #F3F4F6',
                              padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                            }}>
                              <span style={{ fontSize: '1.125rem' }}>
                                {r.approvedEmotion ? getEmotionIcon(r.approvedEmotion) : '📝'}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                  fontSize: '0.8125rem', color: '#374151', overflow: 'hidden',
                                  textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0,
                                }}>
                                  {r.text}
                                </p>
                                <p style={{ fontSize: '0.6875rem', color: '#9CA3AF', margin: '0.125rem 0 0' }}>
                                  {new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  {r.approvedEmotion && ` · ${r.approvedEmotion}`}
                                </p>
                              </div>
                            </div>
                          ))}
                          {state.reflections.filter(r => r.status === 'approved').length > 3 && (
                            <Link
                              to="/insights?tab=reflections"
                              style={{
                                fontSize: '0.8125rem', color: '#4A5FC1', textDecoration: 'none',
                                fontWeight: 500, padding: '0.375rem 0.875rem',
                              }}
                            >
                              View all ({state.reflections.filter(r => r.status === 'approved').length}) →
                            </Link>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* ── PRODUCT TASTE EXERCISE (secondary, at bottom) ── */}
              <div style={{
                backgroundColor: 'white', borderRadius: '16px', border: '1px solid #F3F4F6',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '0.875rem 1.25rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FlaskConical size={14} color="#7C3AED" />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937' }}>
                      Product Taste Exercise
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {teOpen && te.tePhase !== 'analyzing' && (
                      <button
                        onClick={handleTeClose}
                        style={{ fontSize: '0.8125rem', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Close
                      </button>
                    )}
                    {!teOpen && (
                      <button
                        onClick={() => setTeOpen(true)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.375rem',
                          padding: '0.375rem 0.875rem', borderRadius: '8px', border: 'none',
                          background: 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)',
                          color: 'white', fontSize: '0.8125rem', fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Start <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {!teOpen && (
                  <div style={{ padding: '0 1.25rem 1rem' }}>
                    <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>
                      Pick any product, reflect on 6 key dimensions, and build the instincts that separate great product thinkers from the rest.
                    </p>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {/* Product select */}
                  {teOpen && te.tePhase === 'product-select' && (
                    <motion.div
                      key="te-product-select"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid #F3F4F6' }}
                    >
                      <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0.875rem 0' }}>
                        What product or service would you like to analyze?
                      </p>
                      <div style={{ display: 'flex', gap: '0.625rem' }}>
                        <input
                          type="text"
                          value={teProductInput}
                          onChange={e => setTeProductInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleTeStart(); }}
                          placeholder="e.g. Notion, Spotify, Apple Maps..."
                          autoFocus
                          style={{
                            flex: 1, padding: '0.625rem 0.875rem', borderRadius: '10px',
                            border: '1px solid #E5E7EB', fontSize: '0.875rem', fontFamily: 'inherit',
                            color: '#1F2937', outline: 'none',
                          }}
                        />
                        <button
                          onClick={handleTeStart}
                          disabled={!teProductInput.trim()}
                          style={{
                            padding: '0.625rem 1.125rem', borderRadius: '10px', border: 'none',
                            background: teProductInput.trim()
                              ? 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)'
                              : '#E5E7EB',
                            color: teProductInput.trim() ? 'white' : '#9CA3AF',
                            fontSize: '0.875rem', fontWeight: 600, cursor: teProductInput.trim() ? 'pointer' : 'default',
                            fontFamily: 'inherit',
                          }}
                        >
                          Start
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Questioning */}
                  {teOpen && te.tePhase === 'questioning' && (
                    <motion.div
                      key="te-questioning"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      style={{
                        backgroundColor: 'white', borderRadius: '16px',
                        border: '1px solid rgba(124,58,237,0.15)', overflow: 'hidden',
                      }}
                    >
                      {/* Progress header */}
                      <div style={{
                        padding: '0.875rem 1.25rem',
                        background: 'linear-gradient(135deg, rgba(124,58,237,0.05) 0%, rgba(139,126,200,0.08) 100%)',
                        borderBottom: '1px solid rgba(124,58,237,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <FlaskConical size={14} color="#7C3AED" />
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#7C3AED' }}>
                            {te.productName}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                          Q{te.questionIdx + 1} of {te.totalQuestions}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div style={{ height: '2px', backgroundColor: '#F3F4F6' }}>
                        <div style={{
                          height: '100%', backgroundColor: '#7C3AED',
                          width: `${((te.questionIdx) / te.totalQuestions) * 100}%`,
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                      {/* Question & answer */}
                      <div style={{ padding: '1.25rem' }}>
                        <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: '#1F2937', lineHeight: 1.5, margin: '0 0 0.875rem' }}>
                          {te.currentQuestion}
                        </p>
                        <textarea
                          value={teCurrentAnswer}
                          onChange={e => setTeCurrentAnswer(e.target.value)}
                          placeholder="Type your answer here..."
                          autoFocus
                          style={{
                            width: '100%', minHeight: '90px', border: '1px solid #E5E7EB',
                            borderRadius: '10px', padding: '0.75rem', fontSize: '0.875rem',
                            lineHeight: 1.6, color: '#1F2937', resize: 'none',
                            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                        {te.error && (
                          <p style={{ fontSize: '0.8125rem', color: '#DC2626', margin: '0.5rem 0 0' }}>
                            {te.error}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.875rem', justifyContent: 'flex-end' }}>
                          {!te.isLastQuestion && (
                            <button
                              onClick={handleTeNext}
                              disabled={!teCurrentAnswer.trim()}
                              style={{
                                padding: '0.5rem 1.125rem', borderRadius: '10px', border: 'none',
                                backgroundColor: teCurrentAnswer.trim() ? '#7C3AED' : '#E5E7EB',
                                color: teCurrentAnswer.trim() ? 'white' : '#9CA3AF',
                                fontSize: '0.875rem', fontWeight: 600,
                                cursor: teCurrentAnswer.trim() ? 'pointer' : 'default',
                                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.375rem',
                              }}
                            >
                              Next <ChevronRight size={14} />
                            </button>
                          )}
                          <button
                            onClick={handleTeFinish}
                            disabled={te.answers.length === 0 && !teCurrentAnswer.trim()}
                            style={{
                              padding: '0.5rem 1.125rem', borderRadius: '10px', border: 'none',
                              backgroundColor: (te.answers.length > 0 || teCurrentAnswer.trim())
                                ? 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)'
                                : '#E5E7EB',
                              background: (te.answers.length > 0 || teCurrentAnswer.trim())
                                ? 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)'
                                : '#E5E7EB',
                              color: (te.answers.length > 0 || teCurrentAnswer.trim()) ? 'white' : '#9CA3AF',
                              fontSize: '0.875rem', fontWeight: 600,
                              cursor: (te.answers.length > 0 || teCurrentAnswer.trim()) ? 'pointer' : 'default',
                              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.375rem',
                            }}
                          >
                            <Sparkles size={14} /> Analyze
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Analyzing */}
                  {teOpen && te.tePhase === 'analyzing' && (
                    <motion.div
                      key="te-analyzing"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      style={{
                        backgroundColor: 'white', borderRadius: '16px',
                        border: '1px solid rgba(124,58,237,0.15)', padding: '2rem 1.25rem',
                        textAlign: 'center',
                      }}
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                        style={{
                          width: '48px', height: '48px', borderRadius: '14px',
                          background: 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          margin: '0 auto 1rem',
                        }}
                      >
                        <FlaskConical size={22} color="white" />
                      </motion.div>
                      <p style={{ fontWeight: 600, color: '#1F2937', margin: '0 0 0.25rem' }}>
                        Analyzing your product take...
                      </p>
                      <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>
                        Evaluating depth, specificity, and product intuition
                      </p>
                    </motion.div>
                  )}

                  {/* Done */}
                  {teOpen && te.tePhase === 'done' && te.result && (
                    <motion.div
                      key="te-done"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      style={{
                        backgroundColor: 'white', borderRadius: '16px',
                        border: '1px solid rgba(124,58,237,0.2)', overflow: 'hidden',
                      }}
                    >
                      {/* Score header */}
                      <div style={{
                        padding: '1.25rem',
                        background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(139,126,200,0.1) 100%)',
                        borderBottom: '1px solid rgba(124,58,237,0.1)',
                        display: 'flex', alignItems: 'center', gap: '1rem',
                      }}>
                        <div style={{
                          width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
                          background: 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: '1.375rem', fontWeight: 800, color: 'white' }}>
                            {te.result.score}
                          </span>
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star
                                key={i}
                                size={14}
                                fill={i < te.result!.score ? '#7C3AED' : 'none'}
                                color={i < te.result!.score ? '#7C3AED' : '#E5E7EB'}
                              />
                            ))}
                          </div>
                          <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0 }}>
                            {te.result.scoreComment}
                          </p>
                        </div>
                      </div>
                      {/* Summary */}
                      <div style={{ padding: '1.25rem' }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#7C3AED', margin: '0 0 0.625rem' }}>
                          {te.productName} — Analysis
                        </p>
                        <p style={{
                          fontSize: '0.875rem', color: '#374151', lineHeight: 1.65,
                          margin: '0 0 1.125rem', whiteSpace: 'pre-wrap',
                        }}>
                          {te.result.summary}
                        </p>
                        <div style={{ display: 'flex', gap: '0.625rem', paddingTop: '0.875rem', borderTop: '1px solid #F3F4F6' }}>
                          <button
                            onClick={handleTeSave}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.375rem',
                              padding: '0.625rem 1.125rem', borderRadius: '10px', border: 'none',
                              background: 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)',
                              color: 'white', fontSize: '0.875rem', fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            <CheckCircle2 size={15} /> Save
                          </button>
                          <button
                            onClick={() => { te.reset(); setTeProductInput(''); setTeCurrentAnswer(''); }}
                            style={{
                              padding: '0.625rem 1.125rem', borderRadius: '10px',
                              border: '1px solid #E5E7EB', backgroundColor: 'white',
                              color: '#6B7280', fontSize: '0.875rem', fontWeight: 500,
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            Try Another
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </motion.div>
          )}

          {/* ---- ANALYZING PHASE ---- */}
          {phase === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '4rem 1rem', gap: '1.5rem',
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: '72px', height: '72px', borderRadius: '20px',
                  background: 'linear-gradient(135deg, #4A5FC1 0%, #7C3AED 50%, #8B7EC8 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(74,95,193,0.3)',
                }}
              >
                <Sparkles size={32} color="white" />
              </motion.div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 600, color: '#1F2937', fontSize: '1.125rem', marginBottom: '0.375rem' }}>
                  Analyzing your reflection...
                </p>
                <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                  Understanding emotions, events, and context
                </p>
              </div>
              {/* Show the journal text being analyzed */}
              <div style={{
                maxWidth: '100%', backgroundColor: 'white', borderRadius: '14px',
                border: '1px solid #F3F4F6', padding: '1rem 1.25rem', marginTop: '0.5rem',
              }}>
                <p style={{
                  fontSize: '0.875rem', color: '#6B7280', fontStyle: 'italic',
                  lineHeight: 1.6, maxHeight: '4.8em', overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  "{journalText.length > 200 ? journalText.slice(0, 200) + '...' : journalText}"
                </p>
              </div>
            </motion.div>
          )}

          {/* ---- REVIEW PHASE ---- */}
          {phase === 'review' && analysisState.result && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              {/* AI Summary Card */}
              <div style={{
                backgroundColor: 'white', borderRadius: '20px', border: '1px solid #E5E7EB',
                padding: '1.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
                  <Sparkles size={18} color="#7C3AED" />
                  <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937' }}>AI Analysis</h2>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {sentimentBadge(analysisState.result.sentiment)}
                    <span style={{
                      fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 500,
                    }}>
                      {Math.round(analysisState.result.confidence * 100)}% confident
                    </span>
                  </div>
                </div>

                {/* Empathetic summary */}
                <div style={{
                  padding: '1rem 1.25rem', borderRadius: '14px',
                  backgroundColor: 'rgba(139,126,200,0.06)', border: '1px solid rgba(139,126,200,0.12)',
                  marginBottom: '1.25rem',
                }}>
                  <p style={{ fontSize: '0.9375rem', color: '#4C1D95', lineHeight: 1.6, fontStyle: 'italic' }}>
                    "{analysisState.result.summary}"
                  </p>
                </div>

                {/* Detected Emotion */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.625rem', display: 'block' }}>
                    Detected Emotion
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {EMOTIONS.map(e => (
                      <button
                        key={e.type}
                        onClick={() => setReviewEmotion(e.type)}
                        style={{
                          padding: '0.5rem 0.875rem', borderRadius: '999px',
                          border: '2px solid',
                          borderColor: reviewEmotion === e.type ? e.color : '#E5E7EB',
                          backgroundColor: reviewEmotion === e.type ? `${e.color}15` : 'white',
                          cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit',
                          color: reviewEmotion === e.type ? e.color : '#6B7280',
                          fontWeight: reviewEmotion === e.type ? 600 : 400,
                          transition: 'all 0.15s',
                        }}
                      >
                        {e.icon} {e.type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Intensity */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.5rem', display: 'block' }}>
                    Intensity: {reviewIntensity}/10
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={reviewIntensity}
                    onChange={(e) => setReviewIntensity(Number(e.target.value))}
                    style={{
                      width: '100%', accentColor: getEmotionColor(reviewEmotion),
                    }}
                  />
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.25rem',
                  }}>
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>

                {/* Event Type */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.5rem', display: 'block' }}>
                    Career Event Type
                  </label>
                  <select
                    value={reviewEventType || ''}
                    onChange={(e) => setReviewEventType(e.target.value ? e.target.value as EventType : null)}
                    style={{
                      width: '100%', padding: '0.625rem 0.875rem', borderRadius: '10px',
                      border: '1px solid #E5E7EB', fontSize: '0.875rem', fontFamily: 'inherit',
                      color: '#1F2937', backgroundColor: 'white', outline: 'none',
                    }}
                  >
                    <option value="">No career event</option>
                    {EVENT_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Company */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.5rem', display: 'block' }}>
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    value={reviewCompany}
                    onChange={(e) => setReviewCompany(e.target.value)}
                    placeholder="None detected"
                    style={{
                      width: '100%', padding: '0.625rem 0.875rem', borderRadius: '10px',
                      border: '1px solid #E5E7EB', fontSize: '0.875rem', fontFamily: 'inherit',
                      color: '#1F2937', outline: 'none',
                    }}
                  />
                </div>

                {/* Triggers */}
                {analysisState.result.triggers.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.5rem', display: 'block' }}>
                      Triggers Identified
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                      {analysisState.result.triggers.map((trigger, i) => (
                        <span key={i} style={{
                          fontSize: '0.8125rem', padding: '0.375rem 0.75rem', borderRadius: '999px',
                          backgroundColor: '#F3F4F6', color: '#4B5563', fontWeight: 500,
                        }}>
                          {trigger}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{
                  display: 'flex', gap: '0.75rem', paddingTop: '0.75rem',
                  borderTop: '1px solid #F3F4F6',
                }}>
                  <Button onClick={handleApprove} size="md">
                    <CheckCircle2 size={16} /> Approve & Save
                  </Button>
                  <Button variant="outline" size="md" onClick={() => setPhase('writing')}>
                    <Edit3 size={16} /> Edit Entry
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ---- SUCCESS PHASE ---- */}
          {phase === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '4rem 1rem', gap: '1.5rem',
              }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                style={{
                  width: '80px', height: '80px', borderRadius: '50%',
                  backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '3px solid #86EFAC',
                }}
              >
                <CheckCircle2 size={40} color="#22C55E" />
              </motion.div>

              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.375rem' }}>
                  Reflection Saved
                </h2>
                <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.5 }}>
                  Your emotion and {reviewEventType ? 'career event have' : 'reflection has'} been recorded.
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
                <Button onClick={handleWriteAnother} size="md">
                  <BookOpen size={16} /> Write Another
                </Button>
                <Link to="/dashboard">
                  <Button variant="outline" size="md">
                    Dashboard <ArrowRight size={14} />
                  </Button>
                </Link>
                <Link to="/timeline">
                  <Button variant="ghost" size="md">
                    View Timeline <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
