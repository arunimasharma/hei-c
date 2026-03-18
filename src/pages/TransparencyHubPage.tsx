import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  BarChart, Bar, Cell, Legend,
} from 'recharts';
import {
  ShieldCheck, TrendingUp, Heart, Eye, EyeOff,
  CheckCircle2, Award, Brain, FlaskConical,
  Lock, Info, Zap,
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import { useApp } from '../context/AppContext';
import { EMOTIONS } from '../utils/emotionHelpers';
import { formatDate, calculateStreak } from '../utils/dateHelpers';
import type { EmotionType } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const POSITIVE_EMOTIONS: EmotionType[] = ['Joy', 'Pride', 'Gratitude', 'Hope', 'Confidence', 'Excitement'];
const HIGH_STRESS_EMOTIONS: EmotionType[] = ['Stress', 'Anxiety', 'Fear'];

const ONBOARDING_DAYS = 14;
const BATCH_WEEKS = 11;

// Batch week milestone labels
const BATCH_MILESTONES: Record<number, string> = {
  1: 'Orientation',
  2: 'First EQ Log',
  4: 'Product Taste',
  6: 'Midpoint Review',
  8: 'Deep Reflection',
  10: 'Growth Sprint',
  11: 'Graduation',
};

// ─── Privacy Utilities ────────────────────────────────────────────────────────

/**
 * Anonymize emotion entries for the dashboard.
 * Strips userId, eventId, and free-text notes to prevent
 * accidental PII exposure when the anonymized toggle is on.
 */
function anonymizeEntry(entry: { emotion: EmotionType; intensity: number; timestamp: string; triggers?: string[] }) {
  return {
    emotion: entry.emotion,
    intensity: entry.intensity,
    timestamp: entry.timestamp,
    triggers: entry.triggers,
  };
}

// ─── Score helpers ────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return '#10B981';
  if (score >= 50) return '#F59E0B';
  if (score >= 25) return '#F97316';
  return '#EF4444';
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'Strong';
  if (score >= 50) return 'Developing';
  if (score >= 25) return 'Emerging';
  return 'Early Stage';
}

// ─── Main Component ───────────────────────────────────────────────────────────

type TabId = 'emotional' | 'career' | 'vitals';

export default function TransparencyHubPage() {
  const { state } = useApp();
  const [privacyMode, setPrivacyMode] = useState(true); // Anonymized by default
  const [activeTab, setActiveTab] = useState<TabId>('emotional');

  // ── Compute all metrics ─────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const emotions = state.emotions;
    const reflections = state.reflections.filter(r => r.status === 'approved');
    const allReflections = state.reflections;
    const actions = state.actions;
    const goals = state.goals;
    const tasteExercises = state.tasteExercises ?? [];
    const events = state.events;
    const user = state.user;

    // ── Streak & volume ──
    const streak = calculateStreak(emotions.map(e => e.timestamp));
    const totalLogged = emotions.length;

    // ── Empathy ratio ──
    const positiveCount = emotions.filter(e => POSITIVE_EMOTIONS.includes(e.emotion)).length;
    const empathyRatio = totalLogged > 0 ? positiveCount / totalLogged : 0;

    // ── Action rates ──
    const completedActions = actions.filter(a => a.completed).length;
    const skippedActions = actions.filter(a => a.skipped).length;
    const actionDenominator = completedActions + skippedActions;
    const actionRate = actionDenominator > 0 ? completedActions / actionDenominator : 0;

    // ── Goal progress ──
    const avgGoalProgress = goals.length > 0
      ? goals.reduce((sum, g) => sum + g.progress, 0) / goals.length
      : 0;

    // ── Product taste ──
    const avgTasteScore = tasteExercises.length > 0
      ? tasteExercises.reduce((sum, t) => sum + t.score, 0) / tasteExercises.length
      : 0;

    // ── Learning events ──
    const learningEvents = events.filter(e => e.type === 'Learning' || e.type === 'Achievement').length;

    // ── Proof of Empathy (0–100) ──
    const proofOfEmpathy = Math.round(
      empathyRatio * 40 +
      Math.min(streak / ONBOARDING_DAYS, 1) * 30 +
      Math.min(reflections.length / 10, 1) * 30,
    );

    // ── Proof of Growth (0–100) ──
    const proofOfGrowth = Math.round(
      actionRate * 30 +
      (avgGoalProgress / 100) * 30 +
      (avgTasteScore / 5) * 20 +
      Math.min(learningEvents / 5, 1) * 20,
    );

    // ── Vital Signs ──

    // Self-Awareness: approved reflections / all reflections
    const selfAwareness = allReflections.length > 0
      ? Math.round((reflections.length / allReflections.length) * 100)
      : 0;

    // Growth Momentum: completed actions / (completed + skipped)
    const growthMomentum = Math.round(actionRate * 100);

    // Product Taste: avg score / 5
    const productTaste = Math.round((avgTasteScore / 5) * 100);

    // Emotional Resilience: after high-stress entry, did user log positive within 48 h?
    const highStressEntries = emotions.filter(
      e => HIGH_STRESS_EMOTIONS.includes(e.emotion) && e.intensity >= 7,
    );
    let recoveries = 0;
    highStressEntries.forEach(stressEntry => {
      const stressTime = new Date(stressEntry.timestamp).getTime();
      const hasRecovery = emotions.some(
        e =>
          POSITIVE_EMOTIONS.includes(e.emotion) &&
          new Date(e.timestamp).getTime() > stressTime &&
          new Date(e.timestamp).getTime() - stressTime < 48 * 60 * 60 * 1000,
      );
      if (hasRecovery) recoveries++;
    });
    const emotionalResilience = highStressEntries.length > 0
      ? Math.round((recoveries / highStressEntries.length) * 100)
      : totalLogged > 0 ? 72 : 0; // Neutral baseline when no high-stress data yet

    // ── Radar data for Vital Signs ──
    const radarData = [
      { subject: 'Resilience', value: emotionalResilience },
      { subject: 'Self-Awareness', value: selfAwareness },
      { subject: 'Momentum', value: growthMomentum },
      { subject: 'Product Taste', value: productTaste },
      { subject: 'Empathy', value: Math.round(empathyRatio * 100) },
    ];

    // ── Career Milestones ──
    const joinDate = user?.createdAt ? new Date(user.createdAt) : new Date();
    const now = new Date();
    const daysSinceJoined = Math.max(
      0,
      Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24)),
    );

    // Unique active days within first 14 days
    const activeDaysInOnboarding = new Set(
      emotions
        .filter(e => {
          const dayNum = Math.floor(
            (new Date(e.timestamp).getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          return dayNum >= 0 && dayNum < ONBOARDING_DAYS;
        })
        .map(e => new Date(e.timestamp).toDateString()),
    ).size;

    const onboardingDaysCompleted = Math.min(
      ONBOARDING_DAYS,
      Math.max(activeDaysInOnboarding, Math.min(daysSinceJoined, ONBOARDING_DAYS)),
    );

    const currentBatchWeek = Math.min(BATCH_WEEKS, Math.floor(daysSinceJoined / 7) + 1);

    // Per-week activity for batch tracker (any event logged that week)
    const weeksWithActivity = new Set<number>();
    emotions.forEach(e => {
      const weekNum = Math.floor(
        (new Date(e.timestamp).getTime() - joinDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
      );
      if (weekNum >= 0 && weekNum < BATCH_WEEKS) weeksWithActivity.add(weekNum);
    });

    // ── Emotional chart data (last 30 days) ──
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentEmotions = emotions.filter(e => new Date(e.timestamp) >= thirtyDaysAgo);
    const byDate = new Map<string, Record<string, number>>();
    [...recentEmotions]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .forEach(e => {
        // Use anonymize utility — strips userId/eventId/notes
        const safe = anonymizeEntry(e);
        const dateKey = formatDate(safe.timestamp);
        if (!byDate.has(dateKey)) byDate.set(dateKey, {});
        const entry = byDate.get(dateKey)!;
        if (!entry[safe.emotion] || safe.intensity > entry[safe.emotion]) {
          entry[safe.emotion] = safe.intensity;
        }
      });

    const chartData = Array.from(byDate.entries()).map(([date, ems]) => ({ date, ...ems }));
    const activeEmotionTypes = EMOTIONS.filter(em => recentEmotions.some(r => r.emotion === em.type));

    return {
      proofOfEmpathy,
      proofOfGrowth,
      emotionalResilience,
      selfAwareness,
      growthMomentum,
      productTaste,
      radarData,
      streak,
      totalLogged,
      reflectionsCount: reflections.length,
      completedActions,
      skippedActions,
      tasteCount: tasteExercises.length,
      avgTasteScore: Math.round(avgTasteScore * 10) / 10,
      avgGoalProgress: Math.round(avgGoalProgress),
      goalsCount: goals.length,
      daysSinceJoined,
      onboardingDaysCompleted,
      currentBatchWeek,
      weeksWithActivity,
      chartData,
      activeEmotionTypes,
    };
  }, [state]);

  // ── Tab config ──────────────────────────────────────────────────────────────
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'emotional', label: 'Emotional Health', icon: <Heart size={15} /> },
    { id: 'career', label: 'Career Milestones', icon: <Award size={15} /> },
    { id: 'vitals', label: 'Vital Signs', icon: <Zap size={15} /> },
  ];

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '0.375rem',
    padding: '0.5rem 0.875rem', borderRadius: '999px', border: 'none',
    fontSize: '0.875rem', fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
    backgroundColor: active ? '#4A5FC1' : 'transparent',
    color: active ? 'white' : '#6B7280',
  });

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #4A5FC1 0%, #7C3AED 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ShieldCheck size={18} color="white" />
              </div>
              <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.02em' }}>
                Self Evals
              </h1>
            </div>
            <p style={{ color: '#6B7280', margin: 0, fontSize: '0.9375rem' }}>
              Your Proof of Empathy &amp; Proof of Growth — live data, full visibility.
            </p>
          </div>

          {/* Privacy toggle */}
          <button
            onClick={() => setPrivacyMode(p => !p)}
            aria-pressed={privacyMode}
            aria-label={privacyMode ? 'Switch to full view' : 'Switch to anonymized view'}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 0.875rem', borderRadius: '10px', border: '1px solid #E5E7EB',
              backgroundColor: privacyMode ? 'rgba(74,95,193,0.06)' : 'white',
              color: privacyMode ? '#4A5FC1' : '#6B7280',
              cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500,
              fontFamily: 'inherit', transition: 'all 0.2s',
            }}
          >
            {privacyMode ? <EyeOff size={15} /> : <Eye size={15} />}
            {privacyMode ? 'Anonymized' : 'Full View'}
          </button>
        </div>

        {/* ── Privacy Notice ───────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.875rem 1rem', borderRadius: '12px',
          backgroundColor: 'rgba(74,95,193,0.06)', border: '1px solid rgba(74,95,193,0.15)',
        }}>
          <Lock size={16} style={{ color: '#4A5FC1', flexShrink: 0 }} />
          <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0, lineHeight: 1.5 }}>
            <strong style={{ color: '#4A5FC1' }}>Your data, secured.</strong>{' '}
            Data is stored in your account and used to power personalised insights and pattern recognition.
            {privacyMode && ' Anonymized mode hides identifiable details in this view.'}
          </p>
        </div>

        {/* ── Proof Cards ─────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <ProofCard
            icon={<Heart size={20} color="white" />}
            gradient="linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)"
            label="Proof of Empathy"
            score={metrics.proofOfEmpathy}
            description="Measures your emotional awareness, reflective depth, and positive engagement over time."
            stats={[
              { label: 'Streak', value: `${metrics.streak}d` },
              { label: 'Reflections', value: String(metrics.reflectionsCount) },
              { label: 'Positive ratio', value: `${metrics.totalLogged > 0 ? Math.round((metrics.totalLogged > 0 ? state.emotions.filter(e => POSITIVE_EMOTIONS.includes(e.emotion)).length / metrics.totalLogged : 0) * 100) : 0}%` },
            ]}
          />
          <ProofCard
            icon={<TrendingUp size={20} color="white" />}
            gradient="linear-gradient(135deg, #059669 0%, #4A5FC1 100%)"
            label="Proof of Growth"
            score={metrics.proofOfGrowth}
            description="Tracks your action completion, goal progress, product taste development, and learning investments."
            stats={[
              { label: 'Actions done', value: String(metrics.completedActions) },
              { label: 'Goal progress', value: `${metrics.avgGoalProgress}%` },
              { label: 'Taste score', value: `${metrics.avgTasteScore}/5` },
            ]}
          />
        </div>

        {/* ── Tab Navigation ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={tabBtnStyle(activeTab === t.id)}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Emotional Health Dashboard ─────────────────────────────── */}
        {activeTab === 'emotional' && (
          <motion.div
            key="emotional"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                    Emotional Intensity — Last 30 Days
                  </h2>
                  <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: '0.25rem 0 0' }}>
                    {privacyMode ? 'Aggregated view — no personal details exposed' : 'Full view — emotion type and intensity per day'}
                  </p>
                </div>
                <PrivacyBadge anonymized={privacyMode} />
              </div>

              {metrics.chartData.length === 0 ? (
                <EmptyState icon="📊" message="Log your first emotion to see your emotional health trend." />
              ) : (
                <div style={{ height: '340px', marginLeft: '-0.5rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <defs>
                        {metrics.activeEmotionTypes.map(({ type, color }) => (
                          <linearGradient key={type} id={`hub-gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white', border: '1px solid #E5E7EB',
                          borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          padding: '10px 14px', fontSize: '0.8125rem',
                        }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={((value: unknown, name: unknown) => [`${value ?? 0}/10`, name]) as any}
                      />
                      {metrics.activeEmotionTypes.map(({ type, color }) => (
                        <Area
                          key={type}
                          type="monotone"
                          dataKey={type}
                          stroke={color}
                          fill={`url(#hub-gradient-${type})`}
                          strokeWidth={2}
                          connectNulls
                          dot={false}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Emotion breakdown row */}
            {metrics.totalLogged > 0 && (
              <Card>
                <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#1F2937', margin: '0 0 1rem' }}>
                  Emotion Breakdown
                </h2>
                <EmotionBreakdown emotions={state.emotions} />
              </Card>
            )}

            {/* Work Mode — last 8 weeks */}
            {state.workModes && state.workModes.length > 0 && (() => {
              const modeColors: Record<string, string> = {
                strategic: '#4A5FC1',
                reactive:  '#DC2626',
                balanced:  '#F59E0B',
                survival:  '#6B7280',
              };
              const modeLabels: Record<string, string> = {
                strategic: 'Strategic',
                reactive:  'Reactive',
                balanced:  'Balanced',
                survival:  'Survival',
              };
              // Build 8-week buckets
              const now = Date.now();
              const weekMs = 7 * 24 * 60 * 60 * 1000;
              const weeks = Array.from({ length: 8 }, (_, i) => {
                const weekStart = now - (7 - i) * weekMs;
                const weekEnd   = weekStart + weekMs;
                const label = new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const entry = state.workModes.find(w => {
                  const t = new Date(w.timestamp).getTime();
                  return t >= weekStart && t < weekEnd;
                });
                return { week: label, mode: entry?.mode ?? null };
              }).filter(w => w.mode !== null);
              if (weeks.length === 0) return null;
              const chartData = weeks.map(w => ({
                week: w.week,
                strategic: w.mode === 'strategic' ? 1 : 0,
                reactive:  w.mode === 'reactive'  ? 1 : 0,
                balanced:  w.mode === 'balanced'  ? 1 : 0,
                survival:  w.mode === 'survival'  ? 1 : 0,
              }));
              return (
                <Card>
                  <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#1F2937', margin: '0 0 0.375rem' }}>
                    Work Mode — Last 8 Weeks
                  </h2>
                  <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: '0 0 1rem' }}>
                    How you've been operating week to week
                  </p>
                  <div style={{ height: '180px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '10px', fontSize: '0.8125rem' }}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={((_: unknown, name: unknown) => [modeLabels[name as string] || name, '']) as any}
                        />
                        <Legend formatter={(v: string) => <span style={{ fontSize: '0.75rem' }}>{modeLabels[v] || v}</span>} />
                        {(['strategic', 'reactive', 'balanced', 'survival'] as const).map(m => (
                          <Bar key={m} dataKey={m} stackId="a" fill={modeColors[m]} radius={m === 'survival' ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                            {chartData.map((_, i) => <Cell key={i} fill={modeColors[m]} />)}
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              );
            })()}
          </motion.div>
        )}

        {/* ── Tab: Career Milestones ───────────────────────────────────────── */}
        {activeTab === 'career' && (
          <motion.div
            key="career"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            {/* 14-Day Onboarding Challenge */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #4A5FC1 0%, #818CF8 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Brain size={18} color="white" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                    14-Day Onboarding Challenge
                  </h2>
                  <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>
                    {metrics.onboardingDaysCompleted}/{ONBOARDING_DAYS} days active
                  </p>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <span style={{
                    fontSize: '1.25rem', fontWeight: 700,
                    color: metrics.onboardingDaysCompleted >= ONBOARDING_DAYS ? '#10B981' : '#4A5FC1',
                  }}>
                    {Math.round((metrics.onboardingDaysCompleted / ONBOARDING_DAYS) * 100)}%
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ height: '10px', borderRadius: '999px', backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(metrics.onboardingDaysCompleted / ONBOARDING_DAYS) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    style={{
                      height: '100%', borderRadius: '999px',
                      background: 'linear-gradient(90deg, #4A5FC1 0%, #818CF8 100%)',
                    }}
                  />
                </div>
              </div>

              {/* Day grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.375rem' }}>
                {Array.from({ length: ONBOARDING_DAYS }, (_, i) => {
                  const completed = i < metrics.onboardingDaysCompleted;
                  const isCurrent = i === metrics.onboardingDaysCompleted && i < ONBOARDING_DAYS;
                  return (
                    <div
                      key={i}
                      title={`Day ${i + 1}${completed ? ' — completed' : isCurrent ? ' — in progress' : ''}`}
                      style={{
                        height: '36px', borderRadius: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.6875rem', fontWeight: 600,
                        backgroundColor: completed ? 'rgba(74,95,193,0.12)' : isCurrent ? 'rgba(74,95,193,0.05)' : '#F9FAFB',
                        color: completed ? '#4A5FC1' : '#9CA3AF',
                        border: isCurrent ? '1.5px dashed #4A5FC1' : '1px solid transparent',
                        transition: 'all 0.2s',
                      }}
                    >
                      {completed ? <CheckCircle2 size={14} style={{ color: '#4A5FC1' }} /> : `${i + 1}`}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* 11-Week Club Batch */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FlaskConical size={18} color="white" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                    11-Week Club Batch
                  </h2>
                  <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>
                    Week {metrics.currentBatchWeek} of {BATCH_WEEKS}
                  </p>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <span style={{
                    fontSize: '1.25rem', fontWeight: 700, color: '#7C3AED',
                  }}>
                    {Math.round((metrics.currentBatchWeek / BATCH_WEEKS) * 100)}%
                  </span>
                </div>
              </div>

              {/* Week timeline */}
              <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
                {/* Connecting line */}
                <div style={{
                  position: 'absolute', left: '0.6875rem', top: '8px',
                  bottom: '8px', width: '2px', backgroundColor: '#E5E7EB',
                }} />
                <div
                  style={{
                    position: 'absolute', left: '0.6875rem', top: '8px',
                    width: '2px',
                    height: `${Math.min(100, ((metrics.currentBatchWeek - 1) / (BATCH_WEEKS - 1)) * 100)}%`,
                    background: 'linear-gradient(180deg, #7C3AED 0%, #EC4899 100%)',
                    transition: 'height 0.8s ease-out',
                  }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {Array.from({ length: BATCH_WEEKS }, (_, i) => {
                    const weekNum = i + 1;
                    const isActive = weekNum <= metrics.currentBatchWeek;
                    const isCurrent = weekNum === metrics.currentBatchWeek;
                    const hasMilestone = BATCH_MILESTONES[weekNum];
                    const hasActivity = metrics.weeksWithActivity.has(i);

                    return (
                      <div key={weekNum} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', paddingBottom: weekNum < BATCH_WEEKS ? '0.875rem' : 0 }}>
                        {/* Node */}
                        <div style={{
                          width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
                          zIndex: 1,
                          backgroundColor: isActive ? (hasMilestone ? '#7C3AED' : '#C4B5FD') : '#E5E7EB',
                          border: isCurrent ? '2px solid #7C3AED' : '2px solid transparent',
                          boxShadow: isCurrent ? '0 0 0 3px rgba(124,58,237,0.15)' : 'none',
                          transition: 'all 0.3s',
                        }} />

                        {/* Label row */}
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '0.8125rem',
                            fontWeight: hasMilestone ? 600 : 400,
                            color: isActive ? '#1F2937' : '#9CA3AF',
                          }}>
                            Week {weekNum}
                          </span>
                          {hasMilestone && (
                            <span style={{
                              fontSize: '0.6875rem', fontWeight: 600,
                              padding: '0.125rem 0.5rem', borderRadius: '999px',
                              backgroundColor: isActive ? 'rgba(124,58,237,0.1)' : '#F3F4F6',
                              color: isActive ? '#7C3AED' : '#9CA3AF',
                            }}>
                              {BATCH_MILESTONES[weekNum]}
                            </span>
                          )}
                          {hasActivity && (
                            <span style={{
                              fontSize: '0.625rem', fontWeight: 600,
                              padding: '0.1rem 0.4rem', borderRadius: '999px',
                              backgroundColor: 'rgba(16,185,129,0.1)', color: '#10B981',
                            }}>
                              Active
                            </span>
                          )}
                          {isCurrent && (
                            <span style={{
                              fontSize: '0.625rem', fontWeight: 700,
                              padding: '0.1rem 0.4rem', borderRadius: '999px',
                              backgroundColor: 'rgba(124,58,237,0.12)', color: '#7C3AED',
                              letterSpacing: '0.03em',
                            }}>
                              NOW
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── Tab: Vital Signs Scorecard ───────────────────────────────────── */}
        {activeTab === 'vitals' && (
          <motion.div
            key="vitals"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            {/* Radar chart */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                  Organizational Vital Signs
                </h2>
                <PrivacyBadge anonymized={privacyMode} />
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: '0 0 1rem' }}>
                Transparent scoring across five dimensions of emotional &amp; professional health.
              </p>

              {metrics.totalLogged === 0 ? (
                <EmptyState icon="📡" message="Start logging emotions and completing actions to see your vital signs." />
              ) : (
                <div style={{ height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={metrics.radarData} cx="50%" cy="50%" outerRadius="75%">
                      <PolarGrid stroke="#E5E7EB" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                      />
                      <Radar
                        name="Score"
                        dataKey="value"
                        stroke="#4A5FC1"
                        fill="#4A5FC1"
                        fillOpacity={0.18}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Scorecard grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <VitalCard
                title="Emotional Resilience"
                score={metrics.emotionalResilience}
                description="Recovery rate after high-stress events within 48 hours."
                icon={<Heart size={16} />}
              />
              <VitalCard
                title="Self-Awareness"
                score={metrics.selfAwareness}
                description="Depth of reflective practice — approved vs. total journal entries."
                icon={<Brain size={16} />}
              />
              <VitalCard
                title="Growth Momentum"
                score={metrics.growthMomentum}
                description="Action completion rate — actions done vs. done + skipped."
                icon={<TrendingUp size={16} />}
              />
              <VitalCard
                title="Product Taste"
                score={metrics.productTaste}
                description="Average product taste exercise score, normalized to 100."
                icon={<FlaskConical size={16} />}
              />
            </div>

            {/* Accountability note */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              padding: '1rem', borderRadius: '12px',
              backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
            }}>
              <Info size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
              <p style={{ fontSize: '0.8125rem', color: '#92400E', margin: 0, lineHeight: 1.55 }}>
                <strong>Accountability note:</strong> These scores are based on your logged activity.
                They reflect your self-reported progress — not external validation. Use them as personal
                benchmarks, not absolute measures. Peer-review integrations are on the roadmap.
              </p>
            </div>
          </motion.div>
        )}

      </div>
    </DashboardLayout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ProofCardProps {
  icon: React.ReactNode;
  gradient: string;
  label: string;
  score: number;
  description: string;
  stats: { label: string; value: string }[];
}

function ProofCard({ icon, gradient, label, score, description, stats }: ProofCardProps) {
  const color = scoreColor(score);
  const statusLabel = scoreLabel(score);
  return (
    <div style={{
      borderRadius: '18px', padding: '1.5rem',
      backgroundColor: 'white', border: '1px solid #F3F4F6',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      display: 'flex', flexDirection: 'column', gap: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
          background: gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            {label}
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: '#1F2937', lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: '0.875rem', color: '#9CA3AF' }}>/100</span>
            <span style={{
              fontSize: '0.6875rem', fontWeight: 700, padding: '0.125rem 0.5rem',
              borderRadius: '999px', backgroundColor: `${color}18`, color,
              marginLeft: '0.25rem',
            }}>
              {statusLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div>
        <div style={{ height: '6px', borderRadius: '999px', backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
            style={{ height: '100%', borderRadius: '999px', backgroundColor: color }}
          />
        </div>
      </div>

      <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0, lineHeight: 1.55 }}>
        {description}
      </p>

      {/* Stat pills */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {stats.map(s => (
          <div key={s.label} style={{
            padding: '0.375rem 0.75rem', borderRadius: '999px',
            backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6',
          }}>
            <span style={{ fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 500 }}>{s.label} </span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#374151' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface VitalCardProps {
  title: string;
  score: number;
  description: string;
  icon: React.ReactNode;
}

function VitalCard({ title, score, description, icon }: VitalCardProps) {
  const color = scoreColor(score);
  const status = scoreLabel(score);

  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem',
      border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
          backgroundColor: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937' }}>{title}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem', marginBottom: '0.625rem' }}>
        <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937', lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>/100</span>
        <span style={{
          fontSize: '0.6875rem', fontWeight: 600,
          padding: '0.125rem 0.425rem', borderRadius: '999px',
          backgroundColor: `${color}15`, color, marginLeft: 'auto',
        }}>
          {status}
        </span>
      </div>

      <div style={{ height: '6px', borderRadius: '999px', backgroundColor: '#F3F4F6', overflow: 'hidden', marginBottom: '0.75rem' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: '999px', backgroundColor: color }}
        />
      </div>

      <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0, lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}

function PrivacyBadge({ anonymized }: { anonymized: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.375rem',
      padding: '0.25rem 0.625rem', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 600,
      backgroundColor: anonymized ? 'rgba(74,95,193,0.08)' : 'rgba(16,185,129,0.08)',
      color: anonymized ? '#4A5FC1' : '#059669',
    }}>
      {anonymized ? <EyeOff size={11} /> : <Eye size={11} />}
      {anonymized ? 'Anonymized' : 'Full View'}
    </div>
  );
}

function EmotionBreakdown({ emotions }: { emotions: { emotion: EmotionType; intensity: number; timestamp: string }[] }) {
  const counts = emotions.reduce((acc, e) => {
    acc[e.emotion] = (acc[e.emotion] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] ?? 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      {sorted.map(([emotion, count]) => {
        const em = EMOTIONS.find(e => e.type === emotion);
        if (!em) return null;
        return (
          <div key={emotion} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.125rem', width: '24px', textAlign: 'center', flexShrink: 0 }}>{em.icon}</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151', width: '90px', flexShrink: 0 }}>{emotion}</span>
            <div style={{ flex: 1, height: '8px', borderRadius: '999px', backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(count / max) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: '999px', backgroundColor: em.color }}
              />
            </div>
            <span style={{ fontSize: '0.8125rem', color: '#9CA3AF', fontWeight: 500, width: '30px', textAlign: 'right', flexShrink: 0 }}>
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.875rem' }}>{icon}</div>
      <p style={{ color: '#9CA3AF', fontSize: '0.9375rem', margin: 0 }}>{message}</p>
    </div>
  );
}
