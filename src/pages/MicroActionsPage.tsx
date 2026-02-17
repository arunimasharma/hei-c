import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, CheckCircle2, SkipForward, Zap, Trophy, Clock, RefreshCw, Sparkles, AlertTriangle, Lightbulb } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { useApp } from '../context/AppContext';

export default function MicroActionsPage() {
  const { state, completeAction, skipAction, refreshActions, llmState } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'suggested' | 'completed'>('suggested');
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  const activeActions = state.actions.filter(a => !a.completed && !a.skipped);
  const completedActions = state.actions.filter(a => a.completed);

  useEffect(() => {
    if (!hasInitialized.current && activeActions.length === 0 && completedActions.length === 0) {
      hasInitialized.current = true;
      refreshActions();
    }
  }, []);

  const handleComplete = (id: string) => {
    setJustCompleted(id);
    setTimeout(() => {
      completeAction(id);
      setJustCompleted(null);
    }, 800);
  };

  const categoryColors: Record<string, string> = {
    'Stress Relief': '#34D399',
    'Confidence Building': '#8B5CF6',
    'Energy Boost': '#F59E0B',
    'Reflection': '#3B82F6',
    'Grounding': '#6EE7B7',
    'Gratitude': '#84CC16',
    'Self-Care': '#EC4899',
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
      <div style={{ maxWidth: '48rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1F2937' }}>Micro-Actions</h1>
            {llmState.isAiGenerated && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                fontSize: '0.6875rem', fontWeight: 600, padding: '0.25rem 0.625rem',
                borderRadius: '999px', backgroundColor: 'rgba(139,92,246,0.1)', color: '#7C3AED',
              }}>
                <Sparkles size={12} /> AI
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshActions}
            disabled={llmState.isLoading}
          >
            {llmState.isLoading ? (
              <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
            ) : (
              <><RefreshCw size={14} /> Refresh</>
            )}
          </Button>
        </div>

        {/* AI Insight Banner */}
        {llmState.insight && llmState.isAiGenerated && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              padding: '1rem 1.25rem', borderRadius: '14px',
              backgroundColor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)',
            }}
          >
            <Lightbulb size={18} style={{ color: '#7C3AED', flexShrink: 0, marginTop: '0.125rem' }} />
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7C3AED', marginBottom: '0.25rem' }}>AI Insight</p>
              <p style={{ fontSize: '0.875rem', color: '#4C1D95', lineHeight: 1.5 }}>{llmState.insight}</p>
            </div>
          </motion.div>
        )}

        {/* Error Banner */}
        {llmState.error && (
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
            <p style={{ fontSize: '0.875rem', color: '#92400E' }}>{llmState.error}</p>
          </motion.div>
        )}

        {/* Loading State */}
        {llmState.isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '3rem 1rem', gap: '1rem',
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
              <p style={{ fontWeight: 600, color: '#1F2937', marginBottom: '0.25rem' }}>Generating personalized recommendations...</p>
              <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>Claude is analyzing your emotional patterns</p>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
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
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                >
                  {activeActions.length > 0 ? (
                    activeActions.map(action => {
                      const catColor = categoryColors[action.category] || '#6B7280';
                      return (
                        <motion.div
                          key={action.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{
                            opacity: justCompleted === action.id ? 0.5 : 1,
                            y: 0,
                            scale: justCompleted === action.id ? 0.98 : 1,
                          }}
                          style={{
                            backgroundColor: 'white', borderRadius: '16px', border: '1px solid #F3F4F6',
                            padding: '1.25rem', transition: 'all 0.2s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                            <div style={{
                              width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              backgroundColor: `${catColor}20`,
                            }}>
                              <Zap size={18} style={{ color: catColor }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h3 style={{ fontWeight: 600, color: '#1F2937' }}>{action.title}</h3>
                              <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.375rem', lineHeight: 1.5 }}>{action.description}</p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
                                <span style={{
                                  fontSize: '0.75rem', fontWeight: 500, padding: '0.25rem 0.625rem',
                                  borderRadius: '999px', backgroundColor: `${catColor}15`, color: catColor,
                                }}>
                                  {action.category}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#9CA3AF' }}>
                                  <Clock size={12} /> {action.estimatedMinutes} min
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
                              <button
                                onClick={() => handleComplete(action.id)}
                                style={{
                                  padding: '0.625rem', borderRadius: '12px', border: 'none',
                                  backgroundColor: '#F0FDF4', color: '#16A34A', cursor: 'pointer',
                                  display: 'flex', transition: 'all 0.2s',
                                }}
                                aria-label="Complete"
                                title="Mark Complete"
                              >
                                <CheckCircle2 size={20} />
                              </button>
                              <button
                                onClick={() => skipAction(action.id)}
                                style={{
                                  padding: '0.625rem', borderRadius: '12px', border: 'none',
                                  backgroundColor: '#F9FAFB', color: '#9CA3AF', cursor: 'pointer',
                                  display: 'flex', transition: 'all 0.2s',
                                }}
                                aria-label="Skip"
                                title="Skip"
                              >
                                <SkipForward size={20} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <Card>
                      <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                        <Zap size={44} style={{ color: '#9CA3AF', margin: '0 auto 0.75rem' }} />
                        <h3 style={{ fontWeight: 600, color: '#1F2937', marginBottom: '0.25rem' }}>No actions right now</h3>
                        <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '1.25rem' }}>Log some emotions and we'll suggest personalized actions.</p>
                        <Button variant="outline" onClick={refreshActions}>Generate Actions</Button>
                      </div>
                    </Card>
                  )}
                </motion.div>
              )}

              {tab === 'completed' && (
                <motion.div
                  key="completed"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                >
                  {completedActions.length > 0 ? (
                    completedActions.map(action => (
                      <div
                        key={action.id}
                        style={{
                          backgroundColor: 'white', borderRadius: '16px', border: '1px solid #F3F4F6',
                          padding: '1rem 1.25rem', opacity: 0.75,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <CheckCircle2 size={20} style={{ color: '#22C55E', flexShrink: 0 }} />
                          <div>
                            <h3 style={{ fontWeight: 500, color: '#1F2937', textDecoration: 'line-through', textDecorationColor: '#86EFAC' }}>{action.title}</h3>
                            <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.125rem' }}>
                              {action.completedAt ? `Completed ${new Date(action.completedAt).toLocaleDateString()}` : 'Completed'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Card>
                      <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                        <Trophy size={44} style={{ color: '#9CA3AF', margin: '0 auto 0.75rem' }} />
                        <h3 style={{ fontWeight: 600, color: '#1F2937', marginBottom: '0.25rem' }}>No completed actions yet</h3>
                        <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>Complete some micro-actions to see them here.</p>
                      </div>
                    </Card>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
