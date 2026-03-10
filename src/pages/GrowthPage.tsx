import { useState, useMemo, useEffect } from 'react';
import { Plus, Target, Sparkles, RefreshCw, CheckCircle2, SkipForward, Clock, Lightbulb, ChevronDown, ChevronUp, TrendingUp, Info, Brain, Trophy, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import GoalCard from '../components/goals/GoalCard';
import GoalForm from '../components/goals/GoalForm';
import { useApp } from '../context/AppContext';
import { callClaudeMessages, parseActionResponse } from '../services/claudeApi';
import type { Goal, EmotionType } from '../types';

type IdealScenario = {
  generatedAt: string;
  basedOn: { reflections: number; exercises: number };
  productProfile: {
    headline: string;
    types: string[];
    strengths: string[];
    reasoning: string;
  };
  coworkerProfile: {
    headline: string;
    enhances: string[];
    drains: string[];
    reasoning: string;
  };
  automationProjects: Array<{
    title: string;
    purpose: string;
    description: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  }>;
};

const IDEAL_SCENARIO_KEY = 'heq_ideal_scenario';

type ControlFocus = { product: string; coworker: string; career: string };
const CONTROL_FOCUS_KEY = 'heq_control_focus';
const EMPTY_FOCUS: ControlFocus = { product: '', coworker: '', career: '' };

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
  const { state, addGoal, updateGoal, deleteGoal, completeAction, skipAction, dismissAction, refreshActions, llmState, checkAndUseAi } = useApp();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<(Goal & { type: 'career' | 'emotional-intelligence' }) | undefined>();
  const [activeTab, setActiveTab] = useState<'goals' | 'profile'>('goals');

  // Ideal Work Scenario state
  const [idealScenario, setIdealScenario] = useState<IdealScenario | null>(null);
  const [idealLoading, setIdealLoading] = useState(false);
  const [idealError, setIdealError] = useState('');
  const [profileReasoningOpen, setProfileReasoningOpen] = useState<Record<'product' | 'coworker', boolean>>({ product: false, coworker: false });

  // Control Plane focus state
  const [controlFocus, setControlFocus] = useState<ControlFocus>(EMPTY_FOCUS);
  const [focusDraft, setFocusDraft] = useState<ControlFocus>(EMPTY_FOCUS);
  const [focusSaved, setFocusSaved] = useState(false);

  // Load cached scenario + control focus from localStorage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(IDEAL_SCENARIO_KEY);
      if (cached) setIdealScenario(JSON.parse(cached));
    } catch { /* ignore */ }
    try {
      const savedFocus = localStorage.getItem(CONTROL_FOCUS_KEY);
      if (savedFocus) {
        const parsed = JSON.parse(savedFocus) as ControlFocus;
        setControlFocus(parsed);
        setFocusDraft(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  const handleSaveFocus = () => {
    localStorage.setItem(CONTROL_FOCUS_KEY, JSON.stringify(focusDraft));
    setControlFocus(focusDraft);
    setFocusSaved(true);
    setTimeout(() => setFocusSaved(false), 2200);
  };

  const focusHasChanges = JSON.stringify(focusDraft) !== JSON.stringify(controlFocus);

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

  const handleGenerateIdealScenario = async () => {
    if (!checkAndUseAi()) return;
    setIdealLoading(true);
    setIdealError('');

    const approvedReflections = state.reflections.filter(r => r.status === 'approved');
    const completedExercises = state.tasteExercises.filter(t => t.status === 'completed');

    const reflectionsText = approvedReflections.slice(-10).map(r =>
      `- Emotion: ${r.approvedEmotion || r.detectedEmotion} (${r.approvedIntensity || r.detectedIntensity}/10)` +
      `\n  Triggers: ${r.detectedTriggers?.join(', ') || 'none noted'}` +
      `\n  Summary: ${r.detectedSummary || r.text.slice(0, 120)}`
    ).join('\n\n');

    const exercisesText = completedExercises.slice(-6).map(t =>
      `- Product: ${t.productName} | Score: ${t.score}/10\n  Summary: ${t.summary}\n  Comment: ${t.scoreComment}`
    ).join('\n\n');

    const completedActionsText = state.actions.filter(a => a.completed).slice(-8).map(a =>
      `- ${a.title} (${a.category})`
    ).join('\n');

    const systemPrompt = `You are a career intelligence analyst who synthesizes emotional work patterns and product thinking to reveal someone's ideal work environment. Be specific, personal, and grounded in the actual data — never give generic career advice.

Return ONLY a valid JSON object matching this exact schema, no markdown fences, no preamble:
{
  "productProfile": {
    "headline": "One sharp sentence capturing their product intuition profile",
    "types": ["3-5 specific product domains or problem spaces they'd excel in"],
    "strengths": ["3-4 natural product strengths evidenced by their exercise data"],
    "reasoning": "2-3 sentences grounded in their actual exercise patterns and scores"
  },
  "coworkerProfile": {
    "headline": "One sharp sentence describing their ideal team dynamic",
    "enhances": ["3-4 specific coworker qualities that expand their emotional bandwidth"],
    "drains": ["2-3 specific team dynamics that consistently drain them"],
    "reasoning": "2-3 sentences grounded in their emotional trigger and intensity patterns"
  },
  "automationProjects": [
    {
      "title": "Project name (3-6 words)",
      "purpose": "One sentence: what this automates or amplifies specifically for them",
      "description": "2-3 sentences: what to build, how it works, why it fits their profile",
      "difficulty": "beginner"
    },
    { "title": "...", "purpose": "...", "description": "...", "difficulty": "intermediate" },
    { "title": "...", "purpose": "...", "description": "...", "difficulty": "advanced" }
  ]
}

difficulty values: "beginner" = no-code or simple scripts (buildable in a day), "intermediate" = API integrations (buildable in a week), "advanced" = custom models or complex pipelines (buildable in 2-4 weeks). Include exactly one of each difficulty.`;

    const userMessage = `Here is my work history to analyze:

## Emotional reflections (${approvedReflections.length} total, showing recent):
${reflectionsText || 'No reflections yet.'}

## Product taste exercises (${completedExercises.length} total, showing recent):
${exercisesText || 'No exercises yet.'}

## Completed growth actions:
${completedActionsText || 'None yet.'}

${state.user?.role ? `My role: ${state.user.role}` : ''}

Based on this, describe my ideal work scenario across the 3 dimensions.`;

    try {
      const response = await callClaudeMessages(systemPrompt, [{ role: 'user', content: userMessage }], 900);
      const raw = parseActionResponse(response).trim();
      const parsed: IdealScenario = {
        ...JSON.parse(raw),
        generatedAt: new Date().toISOString(),
        basedOn: { reflections: approvedReflections.length, exercises: completedExercises.length },
      };
      setIdealScenario(parsed);
      localStorage.setItem(IDEAL_SCENARIO_KEY, JSON.stringify(parsed));
    } catch {
      setIdealError('Something went wrong generating your profile. Please try again.');
    } finally {
      setIdealLoading(false);
    }
  };

  const goalsWithType = useMemo(() => {
    return goals.map((goal) => {
      const type: 'career' | 'emotional-intelligence' = 'focusArea' in goal ? 'emotional-intelligence' : 'career';
      return { ...goal, type };
    });
  }, [goals]);

  const activeGoals = goalsWithType.filter((g) => g.status === 'active');
  const completedGoals = goalsWithType.filter((g) => g.status === 'completed');
  const activeActions = actions.filter((a) => !a.completed && !a.skipped);
  const completedActions = actions.filter((a) => a.completed);

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
              Track actions and set goals for your development
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
              Pending Actions
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#EF4444', margin: '0.5rem 0 0 0' }}>
              {stats.pendingActions}
            </p>
          </Card>
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
              Avg Progress
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#F59E0B', margin: '0.5rem 0 0 0' }}>
              {stats.avgProgress}%
            </p>
          </Card>
          <Card>
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>
              Completed
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#4A5FC1', margin: '0.5rem 0 0 0' }}>
              {stats.completedActions}
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
            <Target size={16} /> Goals &amp; Actions
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'profile' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('profile')}
            style={{ cursor: 'pointer' }}
          >
            <Cpu size={16} /> Work Profile
          </Button>
        </div>

        {/* ── CONTROL PLANE (Goals tab) ── */}
        {activeTab === 'goals' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          >
            {/* Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 60%, #4C1D95 100%)',
              borderRadius: '16px', padding: '1.125rem 1.375rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Cpu size={15} color="#A5B4FC" />
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#A5B4FC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Control Plane
                  </span>
                </div>
                <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'white', margin: 0 }}>
                  Steer your AI — set your direction, shape every recommendation
                </p>
                <p style={{ fontSize: '0.75rem', color: '#A5B4FC', margin: '0.25rem 0 0' }}>
                  Your targets here flow into Actions, Work Profile analysis, and journal prompts
                </p>
              </div>
              <button
                onClick={handleSaveFocus}
                disabled={!focusHasChanges && !focusSaved}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.5rem 1.125rem', borderRadius: '10px', border: 'none',
                  background: focusSaved ? '#6EE7B7' : focusHasChanges ? 'white' : 'rgba(255,255,255,0.12)',
                  color: focusSaved ? '#065F46' : focusHasChanges ? '#312E81' : '#A5B4FC',
                  fontSize: '0.8125rem', fontWeight: 700, cursor: focusHasChanges ? 'pointer' : 'default',
                  fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.15s',
                }}
              >
                {focusSaved ? <><CheckCircle2 size={13} /> Saved & active</> : <><TrendingUp size={13} /> {focusHasChanges ? 'Save & activate' : 'Up to date'}</>}
              </button>
            </div>

            {/* Three steering lanes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>

              {/* Lane 1 — Product Direction */}
              {(() => {
                const current = idealScenario?.productProfile.headline;
                const isSet = !!controlFocus.product;
                return (
                  <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #E0E7FF', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Lane header */}
                    <div style={{ padding: '0.75rem 1rem', background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem' }}>🎯</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4338CA', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Product Direction</span>
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: isSet ? '#6366F1' : '#C7D2FE', boxShadow: isSet ? '0 0 0 3px #C7D2FE' : 'none', transition: 'all 0.2s' }} />
                    </div>

                    <div style={{ padding: '0.875rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Current state */}
                      <div>
                        <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#9CA3AF', margin: '0 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current (AI analysis)</p>
                        <p style={{ fontSize: '0.8125rem', color: current ? '#374151' : '#D1D5DB', margin: 0, fontStyle: current ? 'normal' : 'italic', lineHeight: 1.4 }}>
                          {current || 'Generate Work Profile to see current state'}
                        </p>
                      </div>

                      {/* Delta arrow */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <div style={{ flex: 1, height: '1px', borderTop: '1.5px dashed #E0E7FF' }} />
                        <span style={{ fontSize: '0.75rem', color: '#818CF8', fontWeight: 600 }}>↓ target</span>
                        <div style={{ flex: 1, height: '1px', borderTop: '1.5px dashed #E0E7FF' }} />
                      </div>

                      {/* Target input */}
                      <textarea
                        value={focusDraft.product}
                        onChange={e => setFocusDraft(p => ({ ...p, product: e.target.value }))}
                        placeholder="e.g. Build taste for AI-native B2C products and developer tools"
                        rows={2}
                        style={{
                          width: '100%', padding: '0.625rem 0.75rem', borderRadius: '8px',
                          border: '1.5px solid #E0E7FF', fontSize: '0.8125rem', fontFamily: 'inherit',
                          color: '#1F2937', outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5,
                        }}
                        onFocus={e => { e.target.style.borderColor = '#6366F1'; }}
                        onBlur={e => { e.target.style.borderColor = '#E0E7FF'; }}
                      />
                    </div>

                    {/* Downstream connectors */}
                    <div style={{ padding: '0.625rem 1rem', borderTop: '1px solid #EEF2FF', backgroundColor: '#F9FAFB', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                      <span style={{ fontSize: '0.6875rem', color: '#9CA3AF', alignSelf: 'center' }}>steers →</span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.1875rem 0.5rem', borderRadius: '6px', backgroundColor: '#F5F3FF', color: '#7C3AED' }}>🧪 Taste Exercises</span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.1875rem 0.5rem', borderRadius: '6px', backgroundColor: '#EEF2FF', color: '#4338CA' }}>📊 Product Fit Profile</span>
                    </div>
                  </div>
                );
              })()}

              {/* Lane 2 — Emotional Bandwidth */}
              {(() => {
                const current = idealScenario?.coworkerProfile.headline;
                const isSet = !!controlFocus.coworker;
                const eqGoalsCount = activeGoals.filter(g => 'focusArea' in g).length;
                return (
                  <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #D1FAE5', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '0.75rem 1rem', background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem' }}>🤝</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065F46', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Emotional Bandwidth</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {eqGoalsCount > 0 && <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#059669' }}>{eqGoalsCount} goal{eqGoalsCount !== 1 ? 's' : ''}</span>}
                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: isSet ? '#10B981' : '#A7F3D0', boxShadow: isSet ? '0 0 0 3px #A7F3D0' : 'none', transition: 'all 0.2s' }} />
                      </div>
                    </div>

                    <div style={{ padding: '0.875rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#9CA3AF', margin: '0 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current (AI analysis)</p>
                        <p style={{ fontSize: '0.8125rem', color: current ? '#374151' : '#D1D5DB', margin: 0, fontStyle: current ? 'normal' : 'italic', lineHeight: 1.4 }}>
                          {current || 'Generate Work Profile to see current state'}
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <div style={{ flex: 1, height: '1px', borderTop: '1.5px dashed #D1FAE5' }} />
                        <span style={{ fontSize: '0.75rem', color: '#34D399', fontWeight: 600 }}>↓ target</span>
                        <div style={{ flex: 1, height: '1px', borderTop: '1.5px dashed #D1FAE5' }} />
                      </div>

                      <textarea
                        value={focusDraft.coworker}
                        onChange={e => setFocusDraft(p => ({ ...p, coworker: e.target.value }))}
                        placeholder="e.g. Grow capacity to work with high-demand, fast-moving engineering leads"
                        rows={2}
                        style={{
                          width: '100%', padding: '0.625rem 0.75rem', borderRadius: '8px',
                          border: '1.5px solid #D1FAE5', fontSize: '0.8125rem', fontFamily: 'inherit',
                          color: '#1F2937', outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5,
                        }}
                        onFocus={e => { e.target.style.borderColor = '#10B981'; }}
                        onBlur={e => { e.target.style.borderColor = '#D1FAE5'; }}
                      />
                    </div>

                    <div style={{ padding: '0.625rem 1rem', borderTop: '1px solid #ECFDF5', backgroundColor: '#F9FAFB', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                      <span style={{ fontSize: '0.6875rem', color: '#9CA3AF', alignSelf: 'center' }}>steers →</span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.1875rem 0.5rem', borderRadius: '6px', backgroundColor: '#F0FDF4', color: '#059669' }}>📓 Journal Prompts</span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.1875rem 0.5rem', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#065F46' }}>🤝 Coworker Profile</span>
                    </div>
                  </div>
                );
              })()}

              {/* Lane 3 — Career Focus */}
              {(() => {
                const projects = idealScenario?.automationProjects;
                const isSet = !!controlFocus.career;
                const careerGoalsCount = activeGoals.filter(g => !('focusArea' in g)).length;
                const completedActionsCount = completedActions.length;
                return (
                  <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #EDE9FE', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '0.75rem 1rem', background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem' }}>🚀</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#5B21B6', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Career Focus</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {careerGoalsCount > 0 && <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#7C3AED' }}>{careerGoalsCount} goal{careerGoalsCount !== 1 ? 's' : ''}</span>}
                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: isSet ? '#7C3AED' : '#DDD6FE', boxShadow: isSet ? '0 0 0 3px #DDD6FE' : 'none', transition: 'all 0.2s' }} />
                      </div>
                    </div>

                    <div style={{ padding: '0.875rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#9CA3AF', margin: '0 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current (AI analysis)</p>
                        <p style={{ fontSize: '0.8125rem', color: projects ? '#374151' : '#D1D5DB', margin: 0, fontStyle: projects ? 'normal' : 'italic', lineHeight: 1.4 }}>
                          {projects ? projects[0]?.title : 'Generate Work Profile to see current state'}
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <div style={{ flex: 1, height: '1px', borderTop: '1.5px dashed #EDE9FE' }} />
                        <span style={{ fontSize: '0.75rem', color: '#A78BFA', fontWeight: 600 }}>↓ target</span>
                        <div style={{ flex: 1, height: '1px', borderTop: '1.5px dashed #EDE9FE' }} />
                      </div>

                      <textarea
                        value={focusDraft.career}
                        onChange={e => setFocusDraft(p => ({ ...p, career: e.target.value }))}
                        placeholder="e.g. Senior PM at an AI-native company — building systems thinking + shipping velocity"
                        rows={2}
                        style={{
                          width: '100%', padding: '0.625rem 0.75rem', borderRadius: '8px',
                          border: '1.5px solid #EDE9FE', fontSize: '0.8125rem', fontFamily: 'inherit',
                          color: '#1F2937', outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5,
                        }}
                        onFocus={e => { e.target.style.borderColor = '#7C3AED'; }}
                        onBlur={e => { e.target.style.borderColor = '#EDE9FE'; }}
                      />
                    </div>

                    <div style={{ padding: '0.625rem 1rem', borderTop: '1px solid #F5F3FF', backgroundColor: '#F9FAFB', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                      <span style={{ fontSize: '0.6875rem', color: '#9CA3AF', alignSelf: 'center' }}>steers →</span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.1875rem 0.5rem', borderRadius: '6px', backgroundColor: '#F5F3FF', color: '#7C3AED' }}>⚡ AI Actions ({completedActionsCount} done)</span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.1875rem 0.5rem', borderRadius: '6px', backgroundColor: '#EDE9FE', color: '#5B21B6' }}>🤖 Automation Projects</span>
                    </div>
                  </div>
                );
              })()}
            </div>


            {/* ── Recommended Actions subsection ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

              {llmState.isLoading && (
                <Card>
                  <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                    <p style={{ color: '#9CA3AF', margin: 0, fontSize: '0.875rem' }}>
                      Analyzing your emotional patterns…
                    </p>
                  </div>
                </Card>
              )}

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
                                  borderTop: '1px solid #FDE68A', backgroundColor: '#FFFBEB',
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
                                }}>
                                  <p style={{ fontSize: '0.8125rem', color: '#92400E', margin: 0 }}>Skip this action?</p>
                                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                    <button
                                      onClick={() => { dismissAction(action.id); setSkipConfirmId(null); }}
                                      style={{ fontSize: '0.75rem', fontWeight: 500, padding: '0.3rem 0.625rem', borderRadius: '6px', border: '1px solid #FCD34D', backgroundColor: 'white', color: '#92400E', cursor: 'pointer', fontFamily: 'inherit' }}
                                    >Skip for now</button>
                                    <button
                                      onClick={() => { skipAction(action.id); setSkipConfirmId(null); }}
                                      style={{ fontSize: '0.75rem', fontWeight: 500, padding: '0.3rem 0.625rem', borderRadius: '6px', border: 'none', backgroundColor: '#F59E0B', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}
                                    >Skip forever</button>
                                    <button
                                      onClick={() => setSkipConfirmId(null)}
                                      style={{ fontSize: '0.75rem', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem 0.25rem', fontFamily: 'inherit' }}
                                    >Cancel</button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

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
            </div>

            {/* Connector divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#F3F4F6' }} />
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#D1D5DB', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                supporting goals
              </span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#F3F4F6' }} />
            </div>

            {/* Goals — grouped by lane type */}
            {activeGoals.length === 0 && completedGoals.length === 0 ? (
              <Card>
                <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                  <p style={{ color: '#6B7280', margin: 0, fontSize: '0.875rem' }}>
                    No goals yet. Use <strong>+ New Goal</strong> to set milestones that anchor your steering lanes.
                  </p>
                </div>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* EI goals — green left border (Emotional Bandwidth lane) */}
                {activeGoals.filter(g => 'focusArea' in g).map((goal, idx) => (
                  <motion.div key={goal.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}>
                    <div style={{ borderLeft: '3px solid #34D399', borderRadius: '0 12px 12px 0', overflow: 'hidden' }}>
                      <GoalCard goal={goal} onEdit={handleEdit} onDelete={deleteGoal}
                        onUpdateProgress={(id, progress) => updateGoal(id, { progress })}
                        onUpdateStatus={(id, status) => updateGoal(id, { status })} />
                    </div>
                  </motion.div>
                ))}

                {/* Career goals — purple left border (Career Focus lane) */}
                {activeGoals.filter(g => !('focusArea' in g)).map((goal, idx) => (
                  <motion.div key={goal.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (idx + activeGoals.filter(g => 'focusArea' in g).length) * 0.04 }}>
                    <div style={{ borderLeft: '3px solid #7C3AED', borderRadius: '0 12px 12px 0', overflow: 'hidden' }}>
                      <GoalCard goal={goal} onEdit={handleEdit} onDelete={deleteGoal}
                        onUpdateProgress={(id, progress) => updateGoal(id, { progress })}
                        onUpdateStatus={(id, status) => updateGoal(id, { status })} />
                    </div>
                  </motion.div>
                ))}

                {/* Completed goals */}
                {completedGoals.length > 0 && (
                  <div style={{ opacity: 0.55 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', margin: '0.25rem 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Completed ({completedGoals.length})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {completedGoals.map(goal => (
                        <div key={goal.id} style={{ borderLeft: `3px solid ${'focusArea' in goal ? '#A7F3D0' : '#DDD6FE'}`, borderRadius: '0 12px 12px 0', overflow: 'hidden' }}>
                          <GoalCard goal={goal} onEdit={handleEdit} onDelete={deleteGoal}
                            onUpdateProgress={(id, progress) => updateGoal(id, { progress })}
                            onUpdateStatus={(id, status) => updateGoal(id, { status })} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── WORK PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1F2937', margin: '0 0 0.25rem' }}>
                  Your Ideal Work Scenario
                </h2>
                <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>
                  {idealScenario
                    ? `Generated ${Math.floor((Date.now() - new Date(idealScenario.generatedAt).getTime()) / 86400000) === 0
                        ? 'today'
                        : `${Math.floor((Date.now() - new Date(idealScenario.generatedAt).getTime()) / 86400000)}d ago`
                      } · based on ${idealScenario.basedOn.reflections} reflection${idealScenario.basedOn.reflections !== 1 ? 's' : ''} & ${idealScenario.basedOn.exercises} exercise${idealScenario.basedOn.exercises !== 1 ? 's' : ''}`
                    : 'AI synthesises your reflections and product exercises to reveal where you\'d thrive.'}
                </p>
              </div>
              <button
                onClick={handleGenerateIdealScenario}
                disabled={idealLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.5rem 1rem', borderRadius: '10px', border: 'none',
                  background: idealLoading ? '#E5E7EB' : 'linear-gradient(135deg, #4A5FC1 0%, #7C3AED 100%)',
                  color: idealLoading ? '#9CA3AF' : 'white',
                  fontSize: '0.8125rem', fontWeight: 600, cursor: idealLoading ? 'default' : 'pointer',
                  fontFamily: 'inherit', flexShrink: 0,
                }}
              >
                {idealLoading
                  ? <><motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-flex' }}><RefreshCw size={13} /></motion.span> Analysing…</>
                  : <><Sparkles size={13} /> {idealScenario ? 'Refresh' : 'Generate profile'}</>
                }
              </button>
            </div>

            {idealError && (
              <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <p style={{ fontSize: '0.875rem', color: '#DC2626', margin: 0 }}>{idealError}</p>
              </div>
            )}

            {!idealScenario && !idealLoading && !idealError && (
              <Card>
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '14px', background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Cpu size={22} color="#7C3AED" />
                  </div>
                  <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>No profile yet</p>
                  <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0, maxWidth: '22rem', lineHeight: 1.5 }}>
                    Hit "Generate profile" above. The more reflections and product taste exercises you have, the sharper the analysis.
                  </p>
                </div>
              </Card>
            )}

            {idealLoading && (
              <Card>
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 48, height: 48, borderRadius: '14px', background: 'linear-gradient(135deg, #4A5FC1, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Sparkles size={22} color="white" />
                  </motion.div>
                  <div>
                    <p style={{ fontWeight: 600, color: '#1F2937', margin: '0 0 0.25rem' }}>Synthesising your data…</p>
                    <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>Analysing emotional patterns, product instincts, and growth signals</p>
                  </div>
                </div>
              </Card>
            )}

            <AnimatePresence>
              {idealScenario && !idealLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  {/* ── 1. Product Profile ── */}
                  <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E0E7FF', overflow: 'hidden' }}>
                    <div style={{ padding: '1.125rem 1.25rem', background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)', borderBottom: '1px solid #E0E7FF' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                        <span style={{ fontSize: '1rem' }}>🎯</span>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#4F46E5', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Product Fit</span>
                      </div>
                      <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1E1B4B', margin: 0, lineHeight: 1.35 }}>
                        {idealScenario.productProfile.headline}
                      </p>
                    </div>
                    <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6366F1', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Product domains</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                          {idealScenario.productProfile.types.map(t => (
                            <span key={t} style={{ fontSize: '0.8125rem', padding: '0.25rem 0.75rem', borderRadius: '999px', backgroundColor: '#EEF2FF', color: '#4338CA', fontWeight: 500 }}>{t}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6366F1', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Natural strengths</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {idealScenario.productProfile.strengths.map(s => (
                            <div key={s} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                              <span style={{ color: '#818CF8', marginTop: '0.2rem', flexShrink: 0 }}>✦</span>
                              <span style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => setProfileReasoningOpen(p => ({ ...p, product: !p.product }))}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', fontSize: '0.75rem', fontFamily: 'inherit', alignSelf: 'flex-start' }}
                      >
                        {profileReasoningOpen.product ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {profileReasoningOpen.product ? 'Hide' : 'Show'} reasoning
                      </button>
                      <AnimatePresence>
                        {profileReasoningOpen.product && (
                          <motion.p
                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            style={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6, margin: 0, fontStyle: 'italic', overflow: 'hidden' }}
                          >
                            {idealScenario.productProfile.reasoning}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* ── 2. Coworker Dynamics ── */}
                  <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #D1FAE5', overflow: 'hidden' }}>
                    <div style={{ padding: '1.125rem 1.25rem', background: 'linear-gradient(135deg, #ECFDF5 0%, #F0FDF4 100%)', borderBottom: '1px solid #D1FAE5' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                        <span style={{ fontSize: '1rem' }}>🤝</span>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#059669', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Coworker Dynamics</span>
                      </div>
                      <p style={{ fontSize: '1rem', fontWeight: 700, color: '#064E3B', margin: 0, lineHeight: 1.35 }}>
                        {idealScenario.coworkerProfile.headline}
                      </p>
                    </div>
                    <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Expands your bandwidth</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {idealScenario.coworkerProfile.enhances.map(e => (
                            <div key={e} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                              <span style={{ color: '#34D399', marginTop: '0.2rem', flexShrink: 0 }}>↑</span>
                              <span style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>{e}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Drains your energy</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {idealScenario.coworkerProfile.drains.map(d => (
                            <div key={d} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                              <span style={{ color: '#FCA5A5', marginTop: '0.2rem', flexShrink: 0 }}>↓</span>
                              <span style={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.5 }}>{d}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => setProfileReasoningOpen(p => ({ ...p, coworker: !p.coworker }))}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', fontSize: '0.75rem', fontFamily: 'inherit', alignSelf: 'flex-start' }}
                      >
                        {profileReasoningOpen.coworker ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {profileReasoningOpen.coworker ? 'Hide' : 'Show'} reasoning
                      </button>
                      <AnimatePresence>
                        {profileReasoningOpen.coworker && (
                          <motion.p
                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            style={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6, margin: 0, fontStyle: 'italic', overflow: 'hidden' }}
                          >
                            {idealScenario.coworkerProfile.reasoning}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* ── 3. AI Automation Projects ── */}
                  <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #EDE9FE', overflow: 'hidden' }}>
                    <div style={{ padding: '1.125rem 1.25rem', background: 'linear-gradient(135deg, #F5F3FF 0%, #FDF4FF 100%)', borderBottom: '1px solid #EDE9FE' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                        <span style={{ fontSize: '1rem' }}>🤖</span>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#7C3AED', letterSpacing: '0.06em', textTransform: 'uppercase' }}>AI Automation Projects</span>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#5B21B6', margin: 0, lineHeight: 1.4 }}>
                        Personal AI projects to amplify your strengths and reduce cognitive load on your weaknesses.
                      </p>
                    </div>
                    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {idealScenario.automationProjects.map((proj, i) => {
                        const difficultyStyle = {
                          beginner:     { bg: '#F0FDF4', color: '#16A34A', label: 'Beginner' },
                          intermediate: { bg: '#FFFBEB', color: '#D97706', label: 'Intermediate' },
                          advanced:     { bg: '#FEF2F2', color: '#DC2626', label: 'Advanced' },
                        }[proj.difficulty];
                        return (
                          <div key={i} style={{ backgroundColor: '#FAFAFA', borderRadius: '12px', border: '1px solid #F3F4F6', padding: '0.875rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem', gap: '0.5rem' }}>
                              <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>{proj.title}</p>
                              <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.1875rem 0.5rem', borderRadius: '6px', backgroundColor: difficultyStyle.bg, color: difficultyStyle.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {difficultyStyle.label}
                              </span>
                            </div>
                            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#7C3AED', margin: '0 0 0.375rem' }}>{proj.purpose}</p>
                            <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0, lineHeight: 1.55 }}>{proj.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

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
