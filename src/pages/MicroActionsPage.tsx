import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, CheckCircle2, SkipForward, Zap, Trophy, Clock,
  RefreshCw, Sparkles, AlertCircle, Lightbulb, ChevronDown,
  ChevronUp, Brain, TrendingUp, Info,
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { useApp } from '../context/AppContext';
import type { EmotionType } from '../types';

const categoryColors: Record<string, string> = {
  'Stress Relief': '#34D399',
  'Confidence Building': '#8B5CF6',
  'Energy Boost': '#F59E0B',
  'Reflection': '#3B82F6',
  'Grounding': '#6EE7B7',
  'Gratitude': '#84CC16',
  'Self-Care': '#EC4899',
};

const categoryIcons: Record<string, string> = {
  'Stress Relief': '🌿',
  'Confidence Building': '💪',
  'Energy Boost': '⚡',
  'Reflection': '🪞',
  'Grounding': '🌱',
  'Gratitude': '🙏',
  'Self-Care': '💛',
};

function getWeekEmotionSummary(emotions: { emotion: EmotionType; intensity: number; timestamp: string }[]) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = emotions.filter(e => new Date(e.timestamp).getTime() >= weekAgo);
  if (recent.length === 0) return null;

  const counts = new Map<EmotionType, { total: number; count: number }>();
  recent.forEach(e => {
    const curr = counts.get(e.emotion) ?? { total: 0, count: 0 };
    counts.set(e.emotion, { total: curr.total + e.intensity, count: curr.count + 1 });
  });

  const top = [...counts.entries()]
    .map(([emotion, { total, count }]) => ({ emotion, avg: total / count, count }))
    .sort((a, b) => b.count - a.count || b.avg - a.avg)
    .slice(0, 2);

  return { top, total: recent.length };
}

function isActionsStale(
  actions: { generatedAt?: string }[],
  emotions: { timestamp: string }[],
): boolean {
  const activeWithDate = actions.filter(a => a.generatedAt);
  if (activeWithDate.length === 0) return false;
  const latestGenerated = Math.max(...activeWithDate.map(a => new Date(a.generatedAt!).getTime()));
  const latestEmotion = Math.max(...emotions.map(e => new Date(e.timestamp).getTime()));
  return latestEmotion > latestGenerated;
}

export default function MicroActionsPage() {
  const { state, completeAction, skipAction, refreshActions, llmState } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'suggested' | 'completed'>('suggested');
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const hasInitialized = useRef(false);

  const activeActions = state.actions.filter(a => !a.completed && !a.skipped);
  const completedActions = state.actions.filter(a => a.completed);
  const weekSummary = getWeekEmotionSummary(state.emotions);
  const stale = !llmState.isLoading && activeActions.length > 0 && state.emotions.length > 0
    && isActionsStale(activeActions, state.emotions);

  useEffect(() => {
    if (!hasInitialized.current && activeActions.length === 0 && completedActions.length === 0) {
      hasInitialized.current = true;
      if (state.emotions.length > 0) refreshActions();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleComplete = (id: string) => {
    setJustCompleted(id);
    setTimeout(() => {
      completeAction(id);
      setJustCompleted(null);
    }, 600);
  };

  const toggleReasoning = (id: string) => {
    setExpandedReasoning(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tabBtnStyle = (active: boolean) => ({
    flex: 1, padding: '0.625rem', borderRadius: '12px', border: 'none',
    fontSize: '0.875rem', fontWeight: 500 as const, cursor: 'pointer' as const,
    backgroundColor: active ? '#4A5FC1' : 'transparent',
    color: active ? 'white' : '#6B7280',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
    transition: 'all 0.2s', fontFamily: 'inherit',
  });

  return (
    <DashboardLayout>
      <div style={{ maxWidth: '48rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                padding: '0.5rem', borderRadius: '12px', border: 'none',
                backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
                color: '#6B7280',
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1F2937', lineHeight: 1.2 }}>Micro-Actions</h1>
              {weekSummary && (
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.125rem' }}>
                  Based on {weekSummary.total} emotion{weekSummary.total !== 1 ? 's' : ''} logged this week
                </p>
              )}
            </div>
            {llmState.isAiGenerated && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                fontSize: '0.6875rem', fontWeight: 600, padding: '0.25rem 0.625rem',
                borderRadius: '999px', backgroundColor: 'rgba(139,92,246,0.1)', color: '#7C3AED',
                whiteSpace: 'nowrap',
              }}>
                <Sparkles size={11} /> AI
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshActions}
            disabled={llmState.isLoading}
          >
            {llmState.isLoading
              ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
              : <><RefreshCw size={14} /> Refresh</>
            }
          </Button>
        </div>

        {/* Stale actions notice */}
        {stale && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '12px',
              backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Info size={15} style={{ color: '#3B82F6', flexShrink: 0 }} />
              <p style={{ fontSize: '0.8125rem', color: '#1D4ED8' }}>
                You logged new emotions since these were generated.
              </p>
            </div>
            <button
              onClick={refreshActions}
              style={{
                fontSize: '0.8125rem', fontWeight: 600, color: '#2563EB',
                background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                padding: '0.25rem 0.5rem', borderRadius: '6px',
              }}
            >
              Update actions
            </button>
          </motion.div>
        )}

        {/* AI Insight Banner */}
        {llmState.insight && llmState.isAiGenerated && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              padding: '1rem 1.25rem', borderRadius: '14px',
              backgroundColor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)',
            }}
          >
            <Lightbulb size={17} style={{ color: '#7C3AED', flexShrink: 0, marginTop: '0.125rem' }} />
            <div>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#7C3AED', marginBottom: '0.25rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Pattern detected
              </p>
              <p style={{ fontSize: '0.875rem', color: '#4C1D95', lineHeight: 1.55 }}>{llmState.insight}</p>
            </div>
          </motion.div>
        )}

        {/* Fallback notice — friendly, not alarming */}
        {llmState.error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1.25rem', borderRadius: '12px',
              backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB',
            }}
          >
            <Brain size={16} style={{ color: '#6B7280', flexShrink: 0 }} />
            <p style={{ fontSize: '0.8125rem', color: '#6B7280' }}>
              Showing pattern-based suggestions tailored to your recent emotions.
            </p>
          </motion.div>
        )}

        {/* Emotion context chips */}
        {weekSummary && weekSummary.top.length > 0 && !llmState.isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Tailored to:</span>
            {weekSummary.top.map(({ emotion, avg }) => (
              <span
                key={emotion}
                style={{
                  fontSize: '0.75rem', fontWeight: 500,
                  padding: '0.25rem 0.625rem', borderRadius: '999px',
                  backgroundColor: '#F3F4F6', color: '#374151',
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                }}
              >
                {emotion}
                <span style={{ color: '#9CA3AF' }}>· {avg.toFixed(0)}/10</span>
              </span>
            ))}
          </div>
        )}

        {/* Loading State */}
        {llmState.isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '3.5rem 1rem', gap: '1rem',
            }}
          >
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px',
              background: 'linear-gradient(135deg, #4A5FC1 0%, #7C3AED 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulse 2s ease-in-out infinite',
            }}>
              <Sparkles size={24} style={{ color: 'white' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 600, color: '#1F2937', marginBottom: '0.25rem' }}>
                Analyzing your emotional patterns…
              </p>
              <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                Generating actions specific to you
              </p>
            </div>
          </motion.div>
        )}

        {/* Main content */}
        {!llmState.isLoading && (
          <>
            <div style={{
              display: 'flex', backgroundColor: 'white', borderRadius: '16px',
              padding: '0.375rem', border: '1px solid #F3F4F6',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <button onClick={() => setTab('suggested')} style={tabBtnStyle(tab === 'suggested')}>
                <Zap size={14} style={{ display: 'inline', marginRight: '0.375rem', verticalAlign: 'middle' }} />
                Suggested ({activeActions.length})
                {llmState.isAiGenerated && (
                  <span style={{
                    marginLeft: '0.375rem', fontSize: '0.625rem', fontWeight: 700,
                    padding: '0.0625rem 0.375rem', borderRadius: '999px',
                    backgroundColor: tab === 'suggested' ? 'rgba(255,255,255,0.25)' : 'rgba(139,92,246,0.15)',
                    color: tab === 'suggested' ? 'white' : '#7C3AED',
                  }}>
                    AI
                  </span>
                )}
              </button>
              <button onClick={() => setTab('completed')} style={tabBtnStyle(tab === 'completed')}>
                <Trophy size={14} style={{ display: 'inline', marginRight: '0.375rem', verticalAlign: 'middle' }} />
                Completed ({completedActions.length})
              </button>
            </div>

            <AnimatePresence mode="wait">
              {tab === 'suggested' && (
                <motion.div
                  key="suggested"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}
                >
                  {activeActions.length > 0 ? (
                    activeActions.map(action => {
                      const catColor = categoryColors[action.category] || '#6B7280';
                      const catIcon = categoryIcons[action.category] || '✦';
                      const isExpanded = expandedReasoning.has(action.id);
                      const isCompleting = justCompleted === action.id;

                      return (
                        <motion.div
                          key={action.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{
                            opacity: isCompleting ? 0.4 : 1,
                            y: 0,
                            scale: isCompleting ? 0.97 : 1,
                          }}
                          transition={{ duration: 0.2 }}
                          style={{
                            backgroundColor: 'white', borderRadius: '16px',
                            border: `1px solid ${isCompleting ? '#D1FAE5' : '#F3F4F6'}`,
                            overflow: 'hidden',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                          }}
                        >
                          <div style={{ padding: '1.125rem 1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                              {/* Category icon */}
                              <div style={{
                                width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                backgroundColor: `${catColor}18`, fontSize: '1.125rem',
                              }}>
                                {catIcon}
                              </div>

                              {/* Content */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ fontWeight: 600, color: '#1F2937', fontSize: '0.9375rem', lineHeight: 1.3 }}>
                                  {action.title}
                                </h3>
                                <p style={{ fontSize: '0.8375rem', color: '#6B7280', marginTop: '0.3rem', lineHeight: 1.55 }}>
                                  {action.description}
                                </p>

                                {/* Meta row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginTop: '0.625rem', flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: '0.6875rem', fontWeight: 600, padding: '0.2rem 0.5rem',
                                    borderRadius: '999px', backgroundColor: `${catColor}15`, color: catColor,
                                    textTransform: 'uppercase', letterSpacing: '0.03em',
                                  }}>
                                    {action.category}
                                  </span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: '#9CA3AF' }}>
                                    <Clock size={11} /> {action.estimatedMinutes} min
                                  </span>
                                  {action.reasoning && (
                                    <button
                                      onClick={() => toggleReasoning(action.id)}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '0.2rem',
                                        fontSize: '0.75rem', color: '#6B7280', fontWeight: 500,
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        padding: '0.125rem 0.25rem', borderRadius: '4px',
                                        fontFamily: 'inherit',
                                      }}
                                    >
                                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      Why this?
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
                                <button
                                  onClick={() => handleComplete(action.id)}
                                  title="Mark complete"
                                  style={{
                                    padding: '0.5rem', borderRadius: '10px', border: 'none',
                                    backgroundColor: '#F0FDF4', color: '#16A34A', cursor: 'pointer',
                                    display: 'flex', transition: 'all 0.15s',
                                  }}
                                >
                                  <CheckCircle2 size={19} />
                                </button>
                                <button
                                  onClick={() => skipAction(action.id)}
                                  title="Skip — won't suggest this again"
                                  style={{
                                    padding: '0.5rem', borderRadius: '10px', border: 'none',
                                    backgroundColor: '#F9FAFB', color: '#9CA3AF', cursor: 'pointer',
                                    display: 'flex', transition: 'all 0.15s',
                                  }}
                                >
                                  <SkipForward size={19} />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Reasoning panel */}
                          <AnimatePresence>
                            {isExpanded && action.reasoning && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div style={{
                                  padding: '0.75rem 1.25rem 1rem',
                                  borderTop: `1px solid ${catColor}20`,
                                  backgroundColor: `${catColor}06`,
                                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                                }}>
                                  <TrendingUp size={14} style={{ color: catColor, flexShrink: 0, marginTop: '0.1rem' }} />
                                  <p style={{ fontSize: '0.8125rem', color: '#4B5563', lineHeight: 1.55 }}>
                                    {action.reasoning}
                                  </p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })
                  ) : (
                    /* Empty state — context-aware */
                    <Card>
                      <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                        {state.emotions.length === 0 ? (
                          <>
                            <div style={{
                              width: '52px', height: '52px', borderRadius: '14px',
                              background: 'linear-gradient(135deg, #E0E7FF 0%, #EDE9FE 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              margin: '0 auto 1rem',
                            }}>
                              <Brain size={22} style={{ color: '#6366F1' }} />
                            </div>
                            <h3 style={{ fontWeight: 600, color: '#1F2937', marginBottom: '0.5rem' }}>
                              Log an emotion first
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '1.25rem', maxWidth: '280px', margin: '0 auto 1.25rem' }}>
                              Actions are personalized to how you're actually feeling. Log your first emotion to get started.
                            </p>
                            <Button variant="primary" onClick={() => navigate('/emotions/log')}>
                              Log how you're feeling
                            </Button>
                          </>
                        ) : (
                          <>
                            <div style={{
                              width: '52px', height: '52px', borderRadius: '14px',
                              background: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              margin: '0 auto 1rem',
                            }}>
                              <Zap size={22} style={{ color: '#059669' }} />
                            </div>
                            <h3 style={{ fontWeight: 600, color: '#1F2937', marginBottom: '0.5rem' }}>
                              All caught up
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '1.25rem' }}>
                              You've worked through your current actions. Generate a fresh set based on your latest emotions.
                            </p>
                            <Button variant="outline" onClick={refreshActions}>
                              Generate new actions
                            </Button>
                          </>
                        )}
                      </div>
                    </Card>
                  )}

                  {/* Skip hint */}
                  {activeActions.length > 0 && (
                    <p style={{ fontSize: '0.75rem', color: '#D1D5DB', textAlign: 'center' }}>
                      Skipping an action tells the system not to suggest it again.
                    </p>
                  )}
                </motion.div>
              )}

              {tab === 'completed' && (
                <motion.div
                  key="completed"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}
                >
                  {completedActions.length > 0 ? (
                    <>
                      {/* Streak summary */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.875rem 1.25rem', borderRadius: '14px',
                        backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0',
                      }}>
                        <Trophy size={18} style={{ color: '#16A34A', flexShrink: 0 }} />
                        <p style={{ fontSize: '0.875rem', color: '#166534', fontWeight: 500 }}>
                          {completedActions.length} action{completedActions.length !== 1 ? 's' : ''} completed — great work building this habit.
                        </p>
                      </div>

                      {completedActions.map(action => {
                        const catColor = categoryColors[action.category] || '#6B7280';
                        return (
                          <div
                            key={action.id}
                            style={{
                              backgroundColor: 'white', borderRadius: '14px',
                              border: '1px solid #F3F4F6', padding: '0.875rem 1.25rem', opacity: 0.8,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <CheckCircle2 size={18} style={{ color: '#22C55E', flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <h3 style={{
                                  fontWeight: 500, color: '#374151', fontSize: '0.875rem',
                                  textDecoration: 'line-through', textDecorationColor: '#86EFAC',
                                }}>
                                  {action.title}
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                  <span style={{
                                    fontSize: '0.6875rem', color: catColor, fontWeight: 600,
                                  }}>
                                    {action.category}
                                  </span>
                                  {action.completedAt && (
                                    <span style={{ fontSize: '0.6875rem', color: '#9CA3AF' }}>
                                      · {new Date(action.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <Card>
                      <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
                        <Trophy size={40} style={{ color: '#D1D5DB', margin: '0 auto 0.75rem' }} />
                        <h3 style={{ fontWeight: 600, color: '#1F2937', marginBottom: '0.25rem' }}>
                          No completed actions yet
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                          Complete a micro-action and it will show up here.
                        </p>
                      </div>
                    </Card>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* No API key / error state */}
        {!llmState.isLoading && !llmState.isAiGenerated && !llmState.error && activeActions.length === 0 && state.emotions.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              padding: '0.75rem 1rem', borderRadius: '12px',
              backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB',
              marginTop: '-0.5rem',
            }}
          >
            <AlertCircle size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
              Connect a Claude API key in Settings for AI-personalized recommendations.
            </p>
          </motion.div>
        )}

      </div>
    </DashboardLayout>
  );
}
