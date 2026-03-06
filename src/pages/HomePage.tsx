import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Send, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, Edit3, ArrowRight, BookOpen, Settings,
  Zap, Clock, SkipForward, RefreshCw,
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/common/Button';
import { useApp } from '../context/AppContext';
import { useJournalAnalysis } from '../hooks/useJournalAnalysis';
import { EMOTIONS, getEmotionColor, getEmotionIcon } from '../utils/emotionHelpers';
import type { EmotionType, EventType, JournalReflection } from '../types';

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

function getEncouragement(words: number): { text: string; color: string } {
  if (words === 0) return { text: '', color: '#9CA3AF' };
  if (words < 5) return { text: 'Just getting started...', color: '#9CA3AF' };
  if (words < 15) return { text: 'Nice, keep going', color: '#6B7280' };
  if (words < 30) return { text: "You're doing great", color: '#7C3AED' };
  if (words < 50) return { text: "That's a solid reflection", color: '#8B5CF6' };
  return { text: 'Ready when you are', color: '#10B981' };
}

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
  const { state, getApiKey, addEmotion, addEvent, addReflection, updateReflection, completeAction, skipAction, refreshActions, llmState } = useApp();
  const { analysisState, analyzeJournal, resetAnalysis } = useJournalAnalysis();

  const [phase, setPhase] = useState<Phase>('writing');
  const [journalText, setJournalText] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [questionIdx, setQuestionIdx] = useState(0);
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

  const apiKey = getApiKey();
  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const wordCount = journalText.trim() ? journalText.trim().split(/\s+/).length : 0;

  const handleAnalyze = async () => {
    setPhase('analyzing');

    const id = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setReflectionId(id);

    // Save draft reflection
    const draft: JournalReflection = {
      id,
      text: journalText,
      timestamp: new Date().toISOString(),
      status: 'draft',
    };
    addReflection(draft);

    const approvedReflections = state.reflections.filter(r => r.status === 'approved');
    const result = await analyzeJournal(journalText, apiKey, state.user, approvedReflections);

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
    resetAnalysis();
    setPhase('writing');
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
      <div style={{ maxWidth: '48rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937' }}>
            {greeting}, {state.user?.name || 'Friend'}
          </h1>
          <p style={{ color: '#6B7280', marginTop: '0.25rem', fontSize: '0.9375rem' }}>{dateStr}</p>
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
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              {/* Journal Card */}
              <div style={{
                backgroundColor: 'white', borderRadius: '20px', border: '1px solid #E5E7EB',
                boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                overflow: 'hidden',
              }}>
                {/* Companion header */}
                <div style={{
                  padding: '1.25rem 1.5rem 1rem',
                  background: 'linear-gradient(135deg, rgba(74,95,193,0.05) 0%, rgba(139,126,200,0.08) 100%)',
                  borderBottom: '1px solid #F3F4F6',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
                      background: 'linear-gradient(135deg, #4A5FC1 0%, #8B7EC8 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Sparkles size={15} color="white" />
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={questionIdx}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.3 }}
                        style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937' }}
                      >
                        {COMPANION_QUESTIONS[questionIdx]}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', paddingLeft: '2.625rem' }}>
                    A few words is all it takes — I'll handle the rest.
                  </p>
                </div>

                {/* Starter prompt chips */}
                {!journalText && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    style={{ padding: '0.875rem 1.25rem 0.375rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
                  >
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt.label}
                        onClick={() => {
                          setJournalText(prompt.text);
                          setTimeout(() => {
                            const ta = textareaRef.current;
                            if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
                          }, 0);
                        }}
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

                {/* Textarea */}
                <div style={{ padding: '0.75rem 1.5rem' }}>
                  <textarea
                    ref={textareaRef}
                    value={journalText}
                    onChange={(e) => setJournalText(e.target.value)}
                    placeholder="Or just start typing freely..."
                    style={{
                      width: '100%', minHeight: '110px', border: 'none', outline: 'none',
                      fontSize: '1rem', lineHeight: 1.7, color: '#1F2937',
                      resize: 'none', fontFamily: 'inherit',
                      backgroundColor: 'transparent',
                    }}
                  />
                </div>

                {/* Footer */}
                <div style={{
                  padding: '0.75rem 1.5rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFBFC',
                }}>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={getEncouragement(wordCount).text}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ fontSize: '0.8125rem', color: getEncouragement(wordCount).color }}
                    >
                      {getEncouragement(wordCount).text || `${wordCount} words`}
                    </motion.span>
                  </AnimatePresence>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {!apiKey && (
                      <Link to="/settings" style={{
                        fontSize: '0.8125rem', color: '#D97706', display: 'flex', alignItems: 'center', gap: '0.25rem',
                        textDecoration: 'none',
                      }}>
                        <Settings size={14} /> Add API Key
                      </Link>
                    )}
                    <Button
                      size="sm"
                      onClick={handleAnalyze}
                      disabled={!journalText.trim() || !apiKey}
                    >
                      <Sparkles size={14} /> Analyze
                      <Send size={14} />
                    </Button>
                  </div>
                </div>
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

              {/* Manual Attributes Collapsible */}
              <div style={{
                backgroundColor: 'white', borderRadius: '16px', border: '1px solid #F3F4F6',
                overflow: 'hidden',
              }}>
                <button
                  onClick={() => setShowManual(!showManual)}
                  style={{
                    width: '100%', padding: '1rem 1.25rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280' }}>
                    Optional: Provide attributes manually
                  </span>
                  {showManual ? <ChevronUp size={16} color="#9CA3AF" /> : <ChevronDown size={16} color="#9CA3AF" />}
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

              {/* Recent reflections */}
              {state.reflections.filter(r => r.status === 'approved').length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6B7280', marginBottom: '0.75rem' }}>
                    Recent Reflections
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {state.reflections.filter(r => r.status === 'approved').slice(0, 3).map(r => (
                      <div key={r.id} style={{
                        backgroundColor: 'white', borderRadius: '12px', border: '1px solid #F3F4F6',
                        padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                      }}>
                        <span style={{ fontSize: '1.25rem' }}>
                          {r.approvedEmotion ? getEmotionIcon(r.approvedEmotion) : '📝'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: '0.8125rem', color: '#1F2937', overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {r.text}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.125rem' }}>
                            {new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {r.approvedEmotion && ` — ${r.approvedEmotion}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ---- MICRO-ACTIONS ---- */}
              {(() => {
                const activeActions = state.actions.filter(a => !a.completed && !a.skipped);
                const shown = activeActions.slice(0, 3);
                return (
                  <div>
                    {/* Section header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Zap size={15} color="#F59E0B" />
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                          Suggested Actions
                        </h3>
                        {llmState.isAiGenerated && (
                          <span style={{
                            fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.5rem',
                            borderRadius: '999px', backgroundColor: 'rgba(139,92,246,0.1)', color: '#7C3AED',
                          }}>
                            AI
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {activeActions.length > 3 && (
                          <Link to="/growth" style={{ fontSize: '0.8125rem', color: '#4A5FC1', textDecoration: 'none', fontWeight: 500 }}>
                            View all ({activeActions.length})
                          </Link>
                        )}
                        <button
                          onClick={refreshActions}
                          disabled={llmState.isLoading}
                          style={{
                            padding: '0.25rem', borderRadius: '8px', border: 'none',
                            backgroundColor: 'transparent', cursor: llmState.isLoading ? 'default' : 'pointer',
                            color: '#9CA3AF', display: 'flex',
                          }}
                          title="Refresh actions"
                        >
                          <RefreshCw size={14} style={{ animation: llmState.isLoading ? 'spin 1s linear infinite' : 'none' }} />
                        </button>
                      </div>
                    </div>

                    {/* Loading state */}
                    {llmState.isLoading && (
                      <div style={{
                        padding: '1.25rem', borderRadius: '14px', backgroundColor: 'white',
                        border: '1px solid #F3F4F6', textAlign: 'center',
                      }}>
                        <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>
                          Generating personalized suggestions...
                        </p>
                      </div>
                    )}

                    {/* Action cards */}
                    {!llmState.isLoading && shown.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {shown.map(action => {
                          const catColor = CATEGORY_COLORS[action.category] || '#6B7280';
                          return (
                            <motion.div
                              key={action.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              style={{
                                backgroundColor: 'white', borderRadius: '14px',
                                border: '1px solid #F3F4F6', padding: '0.875rem 1rem',
                                display: 'flex', alignItems: 'center', gap: '0.875rem',
                              }}
                            >
                              <div style={{
                                width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                                backgroundColor: `${catColor}18`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <Zap size={16} style={{ color: catColor }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                                  {action.title}
                                </p>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', alignItems: 'center' }}>
                                  <span style={{
                                    fontSize: '0.6875rem', fontWeight: 500, padding: '0.125rem 0.5rem',
                                    borderRadius: '999px', backgroundColor: `${catColor}15`, color: catColor,
                                  }}>
                                    {action.category}
                                  </span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.6875rem', color: '#9CA3AF' }}>
                                    <Clock size={11} /> {action.estimatedMinutes} min
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                                <button
                                  onClick={() => completeAction(action.id)}
                                  style={{
                                    padding: '0.5rem', borderRadius: '10px', border: 'none',
                                    backgroundColor: '#F0FDF4', color: '#16A34A', cursor: 'pointer', display: 'flex',
                                  }}
                                  title="Mark done"
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                                <button
                                  onClick={() => skipAction(action.id)}
                                  style={{
                                    padding: '0.5rem', borderRadius: '10px', border: 'none',
                                    backgroundColor: '#F9FAFB', color: '#9CA3AF', cursor: 'pointer', display: 'flex',
                                  }}
                                  title="Skip"
                                >
                                  <SkipForward size={16} />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* Empty state */}
                    {!llmState.isLoading && shown.length === 0 && (
                      <div style={{
                        padding: '1.25rem', borderRadius: '14px', backgroundColor: 'white',
                        border: '1px dashed #E5E7EB', textAlign: 'center',
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
                );
              })()}
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
