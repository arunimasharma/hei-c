import { useState, useMemo } from 'react';
import { Plus, Zap, Target, Sparkles, RefreshCw, CheckCircle2, SkipForward, Clock, Lightbulb, ChevronDown, ChevronUp, TrendingUp, Info, Brain, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import GoalCard from '../components/goals/GoalCard';
import GoalForm from '../components/goals/GoalForm';
import { useApp } from '../context/AppContext';
import type { Goal, EmotionType } from '../types';

const CATEGORY_COLORS: Record<string, string> = {
  'Stress Relief': '#34D399',
  'Confidence Building': '#8B5CF6',
  'Energy Boost': '#F59E0B',
  'Reflection': '#3B82F6',
  'Grounding': '#6EE7B7',
  'Gratitude': '#84CC16',
  'Self-Care': '#EC4899',
};

const CATEGORY_ICONS: Record<string, string> = {
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
  const withDate = actions.filter(a => a.generatedAt);
  if (withDate.length === 0 || emotions.length === 0) return false;
  const latestGenerated = Math.max(...withDate.map(a => new Date(a.generatedAt!).getTime()));
  const latestEmotion = Math.max(...emotions.map(e => new Date(e.timestamp).getTime()));
  return latestEmotion > latestGenerated;
}

export default function GrowthPage() {
  const { state, addGoal, updateGoal, deleteGoal, completeAction, skipAction, dismissAction, refreshActions, llmState } = useApp();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<(Goal & { type: 'career' | 'emotional-intelligence' }) | undefined>();
  const [activeTab, setActiveTab] = useState<'goals' | 'actions'>('goals');
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [skipConfirmId, setSkipConfirmId] = useState<string | null>(null);

  const { user, goals, actions, emotions } = state;

  const weekSummary = useMemo(() => getWeekEmotionSummary(emotions), [emotions]);
  const stale = !llmState.isLoading && actions.filter(a => !a.completed && !a.skipped).length > 0
    && isActionsStale(actions.filter(a => !a.completed && !a.skipped), emotions);

  const toggleReasoning = (id: string) => {
    setExpandedReasoning(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Goals data
  const goalsWithType = useMemo(() => {
    return goals.map((goal) => {
      const type: 'career' | 'emotional-intelligence' = 'focusArea' in goal ? 'emotional-intelligence' : 'career';
      return { ...goal, type };
    });
  }, [goals]);

  const activeGoals = goalsWithType.filter((g) => g.status === 'active');
  const completedGoals = goalsWithType.filter((g) => g.status === 'completed');

  // Actions data
  const activeActions = actions.filter((a) => !a.completed && !a.skipped);
  const completedActions = actions.filter((a) => a.completed);

  // Stats
  const stats = {
    activeGoals: activeGoals.length,
    completedGoals: completedGoals.length,
    avgProgress:
      goalsWithType.length > 0
        ? Math.round(goalsWithType.reduce((sum, g) => sum + g.progress, 0) / goalsWithType.length)
        : 0,
    pendingActions: activeActions.length,
    completedActions: completedActions.length,
  };

  const handleEdit = (goal: Goal & { type: 'career' | 'emotional-intelligence' }) => {
    setEditingGoal(goal);
    setIsFormOpen(true);
  };

  const handleSubmit = (newGoal: Goal) => {
    if (editingGoal) {
      updateGoal(editingGoal.id, newGoal);
      setEditingGoal(undefined);
    } else {
      addGoal(newGoal);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingGoal(undefined);
  };

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>
              Your Growth
            </h1>
            <p style={{ color: '#6B7280', marginTop: '0.25rem', margin: 0 }}>
              Set goals and track actionable steps
            </p>
          </div>

          {activeTab === 'goals' && (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus size={16} /> New Goal
            </Button>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
          <Card>
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>
              Active Goals
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10B981', margin: '0.5rem 0 0 0' }}>
              {stats.activeGoals}
            </p>
          </Card>
          <Card>
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>
              Completed
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#4A5FC1', margin: '0.5rem 0 0 0' }}>
              {stats.completedGoals}
            </p>
          </Card>
          <Card>
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>
              Avg Progress
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#F59E0B', margin: '0.5rem 0 0 0' }}>
              {stats.avgProgress}%
            </p>
          </Card>
          <Card>
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>
              Pending Actions
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#EF4444', margin: '0.5rem 0 0 0' }}>
              {stats.pendingActions}
            </p>
          </Card>
        </div>

        {/* Tab Toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#F3F4F6', padding: '0.5rem', borderRadius: '10px', width: 'fit-content' }}>
          <Button
            size="sm"
            variant={activeTab === 'goals' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('goals')}
            style={{ cursor: 'pointer' }}
          >
            <Target size={16} /> Goals
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'actions' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('actions')}
            style={{ cursor: 'pointer' }}
          >
            <Zap size={16} /> Actions
          </Button>
        </div>

        {/* Goals Content */}
        {activeTab === 'goals' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          >
            {/* Active Goals */}
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', marginBottom: '1rem', margin: 0 }}>
                Active Goals ({stats.activeGoals})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {activeGoals.length > 0 ? (
                  activeGoals.map((goal, idx) => (
                    <motion.div
                      key={goal.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <GoalCard
                        goal={goal}
                        onEdit={handleEdit}
                        onDelete={deleteGoal}
                        onUpdateProgress={(id, progress) => updateGoal(id, { progress })}
                        onUpdateStatus={(id, status) => updateGoal(id, { status })}
                      />
                    </motion.div>
                  ))
                ) : (
                  <Card>
                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                      <p style={{ color: '#6B7280', margin: 0 }}>
                        No active goals. Create one to get started!
                      </p>
                    </div>
                  </Card>
                )}
              </div>
            </div>

            {/* Completed Goals */}
            {completedGoals.length > 0 && (
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#6B7280', marginBottom: '1rem', margin: 0 }}>
                  Completed Goals ({stats.completedGoals})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', opacity: 0.7 }}>
                  {completedGoals.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      onEdit={handleEdit}
                      onDelete={deleteGoal}
                      onUpdateProgress={(id, progress) => updateGoal(id, { progress })}
                      onUpdateStatus={(id, status) => updateGoal(id, { status })}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Actions Content */}
        {activeTab === 'actions' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            {/* Stale notice */}
            {stale && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '12px',
                backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Info size={15} style={{ color: '#3B82F6', flexShrink: 0 }} />
                  <p style={{ fontSize: '0.8125rem', color: '#1D4ED8', margin: 0 }}>
                    You logged new emotions since these were generated.
                  </p>
                </div>
                <button
                  onClick={refreshActions}
                  style={{
                    fontSize: '0.8125rem', fontWeight: 600, color: '#2563EB',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0.25rem 0.5rem', borderRadius: '6px', whiteSpace: 'nowrap', fontFamily: 'inherit',
                  }}
                >
                  Update actions
                </button>
              </div>
            )}

            {/* AI insight banner */}
            {llmState.insight && llmState.isAiGenerated && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                padding: '0.875rem 1.125rem', borderRadius: '14px',
                backgroundColor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)',
              }}>
                <Lightbulb size={16} style={{ color: '#7C3AED', flexShrink: 0, marginTop: '0.125rem' }} />
                <div>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#7C3AED', margin: '0 0 0.2rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Pattern detected</p>
                  <p style={{ fontSize: '0.875rem', color: '#4C1D95', margin: 0, lineHeight: 1.5 }}>{llmState.insight}</p>
                </div>
              </div>
            )}

            {/* Fallback notice */}
            {llmState.error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: '0.625rem 1rem', borderRadius: '10px',
                backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB',
              }}>
                <Brain size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>
                  Showing pattern-based suggestions tailored to your recent emotions.
                </p>
              </div>
            )}

            {/* Emotion context chips */}
            {weekSummary && weekSummary.top.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Tailored to:</span>
                {weekSummary.top.map(({ emotion, avg }) => (
                  <span key={emotion} style={{
                    fontSize: '0.75rem', fontWeight: 500, padding: '0.2rem 0.625rem',
                    borderRadius: '999px', backgroundColor: '#F3F4F6', color: '#374151',
                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  }}>
                    {emotion} <span style={{ color: '#9CA3AF' }}>· {avg.toFixed(0)}/10</span>
                  </span>
                ))}
              </div>
            )}

            {/* Active Actions header with refresh */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                  Recommended Actions ({stats.pendingActions})
                </h2>
                {llmState.isAiGenerated && (
                  <span style={{
                    fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.5rem',
                    borderRadius: '999px', backgroundColor: 'rgba(139,92,246,0.1)', color: '#7C3AED',
                  }}>
                    <Sparkles size={10} style={{ display: 'inline', marginRight: '0.2rem', verticalAlign: 'middle' }} />AI
                  </span>
                )}
              </div>
              <button
                onClick={refreshActions}
                disabled={llmState.isLoading}
                style={{
                  padding: '0.375rem 0.625rem', borderRadius: '8px', border: '1px solid #E5E7EB',
                  backgroundColor: 'white', cursor: llmState.isLoading ? 'default' : 'pointer',
                  color: '#6B7280', display: 'flex', alignItems: 'center', gap: '0.375rem',
                  fontSize: '0.75rem', fontFamily: 'inherit',
                }}
              >
                <RefreshCw size={13} style={{ animation: llmState.isLoading ? 'spin 1s linear infinite' : 'none' }} />
                {llmState.isLoading ? 'Generating…' : 'Refresh'}
              </button>
            </div>

            {/* Loading state */}
            {llmState.isLoading && (
              <Card>
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <p style={{ color: '#9CA3AF', margin: 0, fontSize: '0.875rem' }}>
                    Analyzing your emotional patterns…
                  </p>
                </div>
              </Card>
            )}

            {/* Action cards */}
            {!llmState.isLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {activeActions.length > 0 ? (
                  activeActions.map((action, idx) => {
                    const catColor = CATEGORY_COLORS[action.category] || '#6B7280';
                    const catIcon = CATEGORY_ICONS[action.category] || '✦';
                    const isExpanded = expandedReasoning.has(action.id);
                    return (
                      <motion.div
                        key={action.id}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        style={{
                          backgroundColor: 'white', borderRadius: '14px',
                          border: '1px solid #F3F4F6', overflow: 'hidden',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                      >
                        <div style={{ padding: '1rem 1.125rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                            <div style={{
                              width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                              backgroundColor: `${catColor}18`, display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: '1rem',
                            }}>
                              {catIcon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937', margin: 0, lineHeight: 1.3 }}>
                                {action.title}
                              </h3>
                              <p style={{ color: '#6B7280', fontSize: '0.8375rem', margin: '0.3rem 0 0', lineHeight: 1.5 }}>
                                {action.description}
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
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
                                      padding: '0.125rem 0.25rem', borderRadius: '4px', fontFamily: 'inherit',
                                    }}
                                  >
                                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    Why this?
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                            <button
                              onClick={() => completeAction(action.id)}
                              title="Mark done"
                              style={{
                                padding: '0.5rem', borderRadius: '10px', border: 'none',
                                backgroundColor: '#F0FDF4', color: '#16A34A', cursor: 'pointer', display: 'flex',
                              }}
                            >
                              <CheckCircle2 size={18} />
                            </button>
                            <button
                              onClick={() => setSkipConfirmId(action.id)}
                              title="Skip"
                              style={{
                                padding: '0.5rem', borderRadius: '10px', border: 'none',
                                backgroundColor: skipConfirmId === action.id ? '#FEF3C7' : '#F9FAFB',
                                color: skipConfirmId === action.id ? '#D97706' : '#9CA3AF',
                                cursor: 'pointer', display: 'flex',
                              }}
                            >
                              <SkipForward size={18} />
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
                              transition={{ duration: 0.18 }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div style={{
                                padding: '0.625rem 1.125rem 0.875rem',
                                borderTop: `1px solid ${catColor}20`,
                                backgroundColor: `${catColor}06`,
                                display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                              }}>
                                <TrendingUp size={13} style={{ color: catColor, flexShrink: 0, marginTop: '0.15rem' }} />
                                <p style={{ fontSize: '0.8125rem', color: '#4B5563', lineHeight: 1.55, margin: 0 }}>
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
                  <Card>
                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                      {emotions.length === 0 ? (
                        <>
                          <Brain size={32} style={{ color: '#D1D5DB', margin: '0 auto 0.75rem', display: 'block' }} />
                          <p style={{ color: '#6B7280', margin: '0 0 1rem', fontSize: '0.875rem' }}>
                            Log how you're feeling to get actions tailored to your current state.
                          </p>
                          <Button size="sm" variant="outline" onClick={refreshActions}>Generate anyway</Button>
                        </>
                      ) : (
                        <>
                          <Trophy size={32} style={{ color: '#D1D5DB', margin: '0 auto 0.75rem', display: 'block' }} />
                          <p style={{ color: '#6B7280', margin: '0 0 1rem', fontSize: '0.875rem' }}>
                            All caught up. Generate a fresh set based on your latest emotions.
                          </p>
                          <Button size="sm" variant="outline" onClick={refreshActions}>
                            {llmState.isLoading ? 'Generating…' : 'Generate new actions'}
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* Completed Actions */}
            {completedActions.length > 0 && (
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#6B7280', margin: '0.5rem 0 0.75rem' }}>
                  Completed ({stats.completedActions})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', opacity: 0.7 }}>
                  {completedActions.slice(0, 5).map((action) => {
                    const catColor = CATEGORY_COLORS[action.category] || '#6B7280';
                    return (
                      <div key={action.id} style={{
                        backgroundColor: 'white', borderRadius: '12px',
                        border: '1px solid #F3F4F6', padding: '0.75rem 1rem',
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                      }}>
                        <CheckCircle2 size={16} style={{ color: '#22C55E', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', margin: 0, textDecoration: 'line-through', textDecorationColor: '#86EFAC' }}>
                            {action.title}
                          </p>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                            <span style={{ fontSize: '0.6875rem', color: catColor, fontWeight: 600 }}>{action.category}</span>
                            {action.completedAt && (
                              <span style={{ fontSize: '0.6875rem', color: '#9CA3AF' }}>
                                · {new Date(action.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Goal Form Modal */}
      <GoalForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        goal={editingGoal}
        userId={user?.id || ''}
      />
    </DashboardLayout>
  );
}
