/**
 * ActionsPage  /actions
 * Rule-based action recommendations derived from exercise-generated friction signals + insight accuracy.
 * No ML — pure rule matching. Modular, MVP-simple.
 */

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Lightbulb, CheckCircle2, ArrowRight, AlertTriangle,
  Zap, BookOpen, Target, TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import InfoTooltip from '../components/common/InfoTooltip';
import { InsightStore } from '../lib/InsightStore';
import { THEME_LABELS, type FrictionTheme } from '../data/frictionCases';

// ── rule engine ───────────────────────────────────────────────────────────────

interface Action {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  cta: string;
  ctaPath?: string;
  icon: React.ReactElement;
  color: string;
  bg: string;
}

function deriveActions(
  insight: ReturnType<typeof InsightStore.getProfile>,
): Action[] {
  const actions: Action[] = [];
  const exerciseCount = insight.totalCases;

  // ── Rule 1: No exercises yet — encourage first signal ─────────────────────
  if (exerciseCount === 0) {
    actions.push({
      id: 'r1_no_exercises',
      priority: 'high',
      category: 'Get Started',
      title: 'Complete your first Product Taste exercise',
      description: 'When you analyze a product experience in an exercise, your written response becomes a structured friction signal. One exercise starts building your product thinking profile.',
      cta: 'Open Exercises',
      ctaPath: '/product',
      icon: <Zap size={16} />,
      color: '#4A5FC1',
      bg: '#EEF0FB',
    });
  }

  // ── Rule 2: A few exercises done — encourage consistency ─────────────────
  if (exerciseCount >= 1 && exerciseCount < 3) {
    actions.push({
      id: 'r2_build_volume',
      priority: 'high',
      category: 'Build Signal Volume',
      title: 'Complete 3 exercises to unlock meaningful patterns',
      description: `You've generated ${exerciseCount} friction signal${exerciseCount === 1 ? '' : 's'} through exercises. At 3+ signals, your profile starts revealing consistent patterns in how you think about product problems.`,
      cta: 'Continue Exercises',
      ctaPath: '/product',
      icon: <Target size={16} />,
      color: '#D97706',
      bg: '#FFFBEB',
    });
  }

  // ── Rule 3: Low accuracy (< 50%) ─────────────────────────────────────────
  if (insight.totalCases >= 2 && insight.avgAccuracy < 0.5) {
    actions.push({
      id: 'r3_low_accuracy',
      priority: 'high',
      category: 'Improve Accuracy',
      title: 'Review your diagnostic approach',
      description: `Your current accuracy is ${Math.round(insight.avgAccuracy * 100)}%. Try reading the benchmark insights after each exercise — they reveal the expected analysis vs. common assumptions.`,
      cta: 'Practice Friction Cases',
      ctaPath: '/product',
      icon: <AlertTriangle size={16} />,
      color: '#DC2626',
      bg: '#FEF2F2',
    });
  }

  // ── Rule 4: Good accuracy, suggest harder theme ───────────────────────────
  if (insight.totalCases >= 3 && insight.avgAccuracy >= 0.65) {
    // Find a theme they haven't mastered yet
    const allThemes: FrictionTheme[] = ['pricing', 'ux', 'onboarding', 'value', 'trust'];
    const unmastered = allThemes.find(t => {
      const d = insight.domainAccuracy[t];
      return !d || d.attempts < 2 || d.accuracy < 0.6;
    });
    if (unmastered) {
      const meta = THEME_LABELS[unmastered];
      actions.push({
        id: 'r4_expand_domains',
        priority: 'medium',
        category: 'Expand Expertise',
        title: `Explore ${meta.label} cases`,
        description: `You're performing well overall (${Math.round(insight.avgAccuracy * 100)}% accuracy). Practising ${meta.label.toLowerCase()} cases will diversify your signal profile and unlock a new expert tag.`,
        cta: `Try ${meta.emoji} ${meta.label} Cases`,
        ctaPath: '/product',
        icon: <BookOpen size={16} />,
        color: meta.color,
        bg: meta.bg,
      });
    }
  }

  // ── Rule 5: Only one theme explored — encourage breadth ──────────────────
  const themesExplored = Object.keys(insight.domainAccuracy).length;
  if (exerciseCount >= 3 && themesExplored === 1) {
    const currentTheme = Object.keys(insight.domainAccuracy)[0] as FrictionTheme;
    const allThemes: FrictionTheme[] = ['pricing', 'ux', 'onboarding', 'value', 'trust'];
    const nextTheme = allThemes.find(t => t !== currentTheme);
    if (nextTheme) {
      const meta = THEME_LABELS[nextTheme];
      actions.push({
        id: 'r5_single_theme',
        priority: 'medium',
        category: 'Signal Pattern',
        title: 'Broaden your friction coverage',
        description: `All your signals so far come from ${THEME_LABELS[currentTheme].label.toLowerCase()} exercises. PMs with strong product thinking diagnose friction across multiple domains — try ${meta.label.toLowerCase()} next to build a more complete profile.`,
        cta: `Try ${meta.emoji} ${meta.label} Cases`,
        ctaPath: '/product',
        icon: <TrendingUp size={16} />,
        color: meta.color,
        bg: meta.bg,
      });
    }
  }

  // ── Rule 6: Expert tag earned ─────────────────────────────────────────────
  if (insight.expertTags.length > 0) {
    const tag = insight.expertTags[0];
    const meta = THEME_LABELS[tag];
    actions.push({
      id: 'r6_expert_tag',
      priority: 'low',
      category: 'Milestone',
      title: `You're a ${meta.label} expert`,
      description: `You've demonstrated strong accuracy in ${meta.label.toLowerCase()} scenarios through your exercises. Your influence profile now shows this expertise. Keep your streak going to maintain the tag.`,
      cta: 'View Influence',
      ctaPath: '/influence',
      icon: <CheckCircle2 size={16} />,
      color: meta.color,
      bg: meta.bg,
    });
  }

  // ── Rule 7: Moderate volume — encourage depth ─────────────────────────────
  if (exerciseCount >= 3 && exerciseCount < 10) {
    actions.push({
      id: 'r7_build_depth',
      priority: 'low',
      category: 'Build Depth',
      title: 'Keep analysing to sharpen your profile',
      description: `You've generated ${exerciseCount} friction signals through exercises. At 10+ signals your thinking patterns become statistically meaningful — PMs look for consistent diagnoses across many scenarios, not one-off reactions.`,
      cta: 'See Your Signals',
      ctaPath: '/signals',
      icon: <Zap size={16} />,
      color: '#10B981',
      bg: '#ECFDF5',
    });
  }

  // Sort by priority
  const order = { high: 0, medium: 1, low: 2 };
  return actions.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ── priority chip ─────────────────────────────────────────────────────────────

const PRIORITY_META = {
  high:   { label: 'High priority', tip: 'Blocking your progress — do this first to unlock the next stage', color: '#DC2626', bg: '#FEF2F2' },
  medium: { label: 'Suggested',     tip: 'Will meaningfully improve your profile if you do it soon',         color: '#D97706', bg: '#FFFBEB' },
  low:    { label: 'Nice to do',    tip: 'A milestone or polish action — good to do but not urgent',          color: '#6B7280', bg: '#F9FAFB' },
};

// ── main component ─────────────────────────────────────────────────────────────

export default function ActionsPage() {
  const insight = useMemo(() => InsightStore.getProfile(), []);

  const actions = useMemo(
    () => deriveActions(insight),
    [insight]
  );

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #7C3AED 0%, #4A5FC1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lightbulb size={18} color="white" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.02em' }}>Recommended Actions</h1>
              <InfoTooltip
                side="right"
                width={260}
                text="Recommendations are rule-based, not ML. They fire based on your exercise count, case accuracy, themes explored, and expert tags earned. No data leaves your device."
              />
            </div>
            <p style={{ fontSize: '0.8rem', color: '#9CA3AF', margin: 0 }}>What to improve based on how you think about products</p>
          </div>
        </div>

        {/* How recommendations work */}
        <div style={{
          padding: '1rem 1.125rem', borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(74,95,193,0.06) 100%)',
          border: '1px solid rgba(124,58,237,0.14)',
        }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', margin: '0 0 0.375rem' }}>
            How recommendations are generated
          </p>
          <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: '0 0 0.5rem', lineHeight: 1.6 }}>
            We analyse the <strong>friction signals</strong> you've generated through Product exercises along with your <strong>case accuracy</strong> to identify gaps in your product thinking.
          </p>
          <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
            These recommendations help you: <strong>spot patterns you're missing</strong>, improve how you diagnose product problems, and build stronger product intuition.
          </p>
        </div>

        {/* Progress summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {[
            { label: 'Signals generated', value: insight.totalCases,         color: '#10B981' },
            { label: 'Avg accuracy',       value: insight.totalCases > 0 ? `${Math.round(insight.avgAccuracy * 100)}%` : '—', color: '#D97706' },
            { label: 'Expert tags',        value: insight.expertTags.length,  color: '#7C3AED' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '0.875rem', borderRadius: '12px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', textAlign: 'center' }}>
              <p style={{ fontSize: '1.375rem', fontWeight: 700, color, margin: 0 }}>{value}</p>
              <p style={{ fontSize: '0.65rem', color: '#9CA3AF', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Action cards */}
        {actions.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎯</div>
              <p style={{ fontWeight: 600, color: '#1F2937', marginBottom: '0.375rem' }}>You're all caught up</p>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', maxWidth: '18rem', margin: '0 auto' }}>
                Keep reflecting in exercises — new recommendations will appear as your signal profile grows.
              </p>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {actions.map((action, idx) => {
              const pri = PRIORITY_META[action.priority];
              return (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.05 }}
                >
                  <Card>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                      {/* Icon */}
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: action.bg, border: `1px solid ${action.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: action.color }}>
                        {action.icon}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Category + priority */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: action.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{action.category}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.1rem 0.45rem', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 600, color: pri.color, backgroundColor: pri.bg }}>
                            {pri.label}
                            <InfoTooltip side="top" width={200} text={pri.tip} iconSize={11} iconColor={pri.color} />
                          </span>
                        </div>

                        {/* Title */}
                        <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937', margin: '0 0 0.375rem', lineHeight: 1.35 }}>{action.title}</p>

                        {/* Description */}
                        <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: '0 0 0.75rem', lineHeight: 1.55 }}>{action.description}</p>

                        {/* CTA */}
                        {action.ctaPath ? (
                          <Link
                            to={action.ctaPath}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                              padding: '0.45rem 0.875rem', borderRadius: '8px',
                              fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none',
                              backgroundColor: action.color, color: 'white',
                            }}
                          >
                            {action.cta} <ArrowRight size={13} />
                          </Link>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                            padding: '0.45rem 0.875rem', borderRadius: '8px',
                            fontSize: '0.8125rem', fontWeight: 600,
                            backgroundColor: action.bg, color: action.color,
                            border: `1px solid ${action.color}33`,
                          }}>
                            {action.cta}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        <div style={{ padding: '0.875rem 1rem', borderRadius: '12px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: '0.78rem', color: '#6B7280', margin: 0, lineHeight: 1.55 }}>
            Recommendations are generated by rule-based logic from your local data. No data leaves your device. As you complete more exercises and build friction signals across themes, recommendations become more personalised.
          </p>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
