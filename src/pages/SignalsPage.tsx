/**
 * SignalsPage  /signals
 * Friction signals derived from Product Taste exercises.
 * Each exercise submission becomes a structured signal — stored locally, never shared.
 */

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Activity, MousePointerClick, Clock, Scroll, Ban,
  TrendingUp, AlertCircle, BarChart2,
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import InfoTooltip from '../components/common/InfoTooltip';
import { InsightStore } from '../lib/InsightStore';
import { THEME_LABELS, type FrictionTheme } from '../data/frictionCases';
import type { ThemeStat } from '../lib/credibilityEngine';
import { usePMGraphEvaluations } from '../integrations/pmGraph/usePMGraphEvaluations';
import { DIMENSION_LABELS } from '../integrations/pmGraph/pmGraphAggregates';

// ── platform-level trigger metadata (reference product patterns) ───────────────
// These describe behavioral friction patterns used in exercise scenarios.

const TRIGGER_META: Record<string, { label: string; icon: React.ReactElement; color: string; bg: string }> = {
  exit_intent:  { label: 'Exit Intent',  icon: <MousePointerClick size={14} />, color: '#DC2626', bg: '#FEF2F2' },
  time_stall:   { label: 'Time Stall',   icon: <Clock size={14} />,             color: '#D97706', bg: '#FFFBEB' },
  scroll_stall: { label: 'Scroll Stall', icon: <Scroll size={14} />,            color: '#4A5FC1', bg: '#EEF0FB' },
  no_action:    { label: 'No Action',    icon: <Ban size={14} />,               color: '#6B7280', bg: '#F9FAFB' },
};

// ── aggregate (static) platform signal data ───────────────────────────────────
// Anonymised aggregate patterns — the basis for exercise scenarios.

const PLATFORM_SIGNALS = [
  { option: 'Too expensive',           count: 1847, trigger: 'exit_intent',  pct: 71 },
  { option: 'Confusing UI',            count: 1634, trigger: 'time_stall',   pct: 74 },
  { option: 'Not sure where to start', count: 1412, trigger: 'no_action',    pct: 77 },
  { option: 'Thinking it over',        count: 1198, trigger: 'time_stall',   pct: 55 },
  { option: 'Too much to take in',     count: 983,  trigger: 'exit_intent',  pct: 64 },
  { option: 'Just browsing',           count: 871,  trigger: 'exit_intent',  pct: 62 },
  { option: 'Not useful yet',          count: 759,  trigger: 'time_stall',   pct: 58 },
  { option: 'Looking for something',   count: 683,  trigger: 'scroll_stall', pct: 61 },
  { option: 'Interesting but unclear', count: 591,  trigger: 'scroll_stall', pct: 72 },
  { option: 'Confusing',               count: 504,  trigger: 'scroll_stall', pct: 74 },
];

const TRIGGER_TOTALS = {
  exit_intent:  { count: 3701, pct: 34 },
  time_stall:   { count: 3591, pct: 33 },
  scroll_stall: { count: 2778, pct: 26 },
  no_action:    { count: 762,  pct: 7  },
};

// ── helpers ────────────────────────────────────────────────────────────────────

function timeAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatBadge({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '0.75rem', borderRadius: '12px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
      <p style={{ fontSize: '1.25rem', fontWeight: 700, color, margin: 0 }}>{value}</p>
      <p style={{ fontSize: '0.65rem', color: '#9CA3AF', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export default function SignalsPage() {
  const submissions = useMemo(() => InsightStore.getAll(), []);
  const insight     = useMemo(() => InsightStore.getProfile(), []);

  // PM Graph-backed aggregates from EvaluationStore (async, non-blocking)
  const { rankedDimensions, topMissedInsights, contestedRatio, surfaceStats, records: pmRecords } =
    usePMGraphEvaluations();

  // Theme breakdown from exercise submissions
  const themeEntries = useMemo(() =>
    (Object.entries(insight.domainAccuracy) as [FrictionTheme, ThemeStat][])
      .sort((a, b) => b[1].attempts - a[1].attempts),
    [insight]
  );

  const themesExplored = themeEntries.length;

  const recentFeed = submissions.slice().reverse().slice(0, 8);

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
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={18} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.02em' }}>Friction Signals</h1>
            <p style={{ fontSize: '0.8rem', color: '#9CA3AF', margin: 0 }}>Friction patterns you've identified through product exercises</p>
          </div>
        </div>

        {/* How signals are collected */}
        <div style={{
          padding: '1rem 1.125rem', borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(5,150,105,0.06) 100%)',
          border: '1px solid rgba(16,185,129,0.15)',
        }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', margin: '0 0 0.375rem' }}>
            How signals are collected
          </p>
          <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
            As you use products across the internet, you bring those experiences into hello-eq through <strong>Product Taste exercises</strong>.
            Each response you write is transformed into a structured friction signal — capturing what didn't work and why.
            Over time, these signals build your <strong>Friction Profile</strong>, helping you understand how you diagnose product problems.
          </p>
        </div>

        {/* Personal overview stats */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <TrendingUp size={15} color="#10B981" />
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>Your Signals</h3>
            <InfoTooltip
              side="right"
              width={260}
              text="Each completed Product exercise generates a friction signal — capturing what friction type you identified and how accurately you diagnosed its root cause."
            />
          </div>
          {insight.totalCases === 0 ? (
            <p style={{ fontSize: '0.875rem', color: '#9CA3AF', textAlign: 'center', padding: '1.5rem 0', margin: 0 }}>
              No signals yet. Complete a Product Taste exercise to generate your first friction signal.
            </p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem', marginBottom: '1.25rem' }}>
                <StatBadge label="Total signals" value={insight.totalCases} color="#10B981" />
                <StatBadge label="Themes explored" value={themesExplored} color="#D97706" />
                <StatBadge label="Avg accuracy" value={`${Math.round(insight.avgAccuracy * 100)}%`} color="#4A5FC1" />
              </div>

              {/* Theme breakdown */}
              {themeEntries.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <p style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.625rem' }}>By friction theme</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {themeEntries.map(([theme, { attempts, accuracy }]) => {
                      const meta = THEME_LABELS[theme];
                      const accuracyPct = Math.round(accuracy * 100);
                      return (
                        <div key={theme}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              <span style={{ fontSize: '0.875rem' }}>{meta.emoji}</span>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>{meta.label}</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>{attempts} exercise{attempts !== 1 ? 's' : ''} · {accuracyPct}% accuracy</span>
                          </div>
                          <div style={{ height: '6px', borderRadius: '999px', backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${accuracyPct}%` }}
                              transition={{ duration: 0.7, ease: 'easeOut' }}
                              style={{ height: '100%', borderRadius: '999px', backgroundColor: meta.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Themes explored chips */}
              {themeEntries.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>Themes explored</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {themeEntries.map(([theme, { attempts }]) => {
                      const meta = THEME_LABELS[theme];
                      return (
                        <span key={theme} style={{ padding: '0.3rem 0.7rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 500, backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.color}33` }}>
                          {meta.emoji} {meta.label} <span style={{ opacity: 0.7, fontWeight: 400 }}>×{attempts}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* ── PM Graph dimension profile ── */}
        {/* Strongest/weakest reasoning dimensions, missed insights, contested engagement. */}
        {/* Only rendered when PM Graph evaluations exist — fully additive, no redesign. */}
        {pmRecords.length > 0 && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <TrendingUp size={15} color="#7C3AED" />
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>PM Dimension Profile</h3>
              <InfoTooltip
                side="right"
                width={260}
                text="Derived from PM Graph-evaluated Friction Cases. Shows your average score across 6 PM reasoning dimensions — strongest first."
              />
              <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 700, color: '#7C3AED', padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: '#EDE9FE' }}>
                PM Graph · {pmRecords.length} eval{pmRecords.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Strongest benchmark surfaces */}
            {surfaceStats.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>
                  Benchmark surfaces — by PM score
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {surfaceStats.map((s, idx) => {
                    const meta   = THEME_LABELS[s.theme];
                    const pct    = Math.round(s.avgScore * 100);
                    const isTop  = idx === 0;
                    return (
                      <div key={s.surface}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <span style={{ fontSize: '0.875rem' }}>{meta.emoji}</span>
                            <span style={{ fontSize: '0.8125rem', fontWeight: isTop ? 600 : 400, color: '#374151' }}>{meta.label}</span>
                            {isTop && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#16A34A', padding: '0.05rem 0.35rem', borderRadius: '999px', backgroundColor: '#F0FDF4' }}>Strongest</span>}
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isTop ? '#16A34A' : '#6B7280' }}>
                            {pct}% avg · {s.count} eval{s.count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div style={{ height: '5px', borderRadius: '999px', backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.7, ease: 'easeOut', delay: idx * 0.05 }}
                            style={{ height: '100%', borderRadius: '999px', backgroundColor: meta.color, opacity: 0.75 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dimension strength/weakness */}
            {rankedDimensions.length > 0 && (
              <div style={{ marginBottom: topMissedInsights.length > 0 || contestedRatio !== null ? '1.25rem' : 0 }}>
                <p style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>
                  Reasoning dimensions
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {rankedDimensions.map(({ key, avg }, idx) => {
                    const pct      = Math.round(avg * 100);
                    const isTop    = idx === 0;
                    const isBottom = idx === rankedDimensions.length - 1;
                    const barColor = isTop ? '#16A34A' : isBottom ? '#DC2626' : '#7C3AED';
                    return (
                      <div key={key}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: isTop || isBottom ? 600 : 400 }}>
                              {DIMENSION_LABELS[key]}
                            </span>
                            {isTop    && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#16A34A', padding: '0.05rem 0.3rem', borderRadius: '999px', backgroundColor: '#F0FDF4' }}>Strongest</span>}
                            {isBottom && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#DC2626', padding: '0.05rem 0.3rem', borderRadius: '999px', backgroundColor: '#FEF2F2' }}>Weakest</span>}
                          </div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: barColor }}>{pct}%</span>
                        </div>
                        <div style={{ height: '4px', borderRadius: '999px', backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.7, ease: 'easeOut', delay: idx * 0.04 }}
                            style={{ height: '100%', borderRadius: '999px', backgroundColor: barColor, opacity: 0.7 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top missed insights */}
            {topMissedInsights.length > 0 && (
              <div style={{ marginBottom: contestedRatio !== null ? '1rem' : 0 }}>
                <p style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>
                  Patterns in missed insights
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {topMissedInsights.map((ins, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.5rem 0.625rem', borderRadius: '8px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#D97706', flexShrink: 0, marginTop: '0.1rem' }}>#{i + 1}</span>
                      <span style={{ fontSize: '0.8rem', color: '#374151', lineHeight: 1.4 }}>{ins}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contested engagement */}
            {contestedRatio !== null && (
              <div style={{ padding: '0.625rem 0.875rem', borderRadius: '10px', backgroundColor: '#F5F3FF', border: '1px solid #EDE9FE' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', color: '#7C3AED', fontWeight: 600 }}>Contested scenarios engaged</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#7C3AED' }}>
                    {Math.round(contestedRatio * 100)}%
                  </span>
                </div>
                <p style={{ fontSize: '0.72rem', color: '#9CA3AF', margin: '0.25rem 0 0', lineHeight: 1.4 }}>
                  Contested cases have no single right answer — high engagement here signals comfort with ambiguity.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Recent signals from exercises */}
        {recentFeed.length > 0 && (
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.625rem' }}>
              Recent signals
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentFeed.map((entry) => {
                const meta = THEME_LABELS[entry.theme];
                const scoreLabel = entry.score === 1 ? 'Perfect read' : entry.score === 0.5 ? 'Half right' : 'Learning moment';
                const scoreColor = entry.score === 1 ? '#16A34A' : entry.score === 0.5 ? '#D97706' : '#DC2626';
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.75rem 1rem', borderRadius: '12px',
                      backgroundColor: meta.bg, border: `1px solid ${meta.color}22`,
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{meta.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937' }}>{meta.label}</span>
                      <span style={{ fontSize: '0.75rem', color: '#9CA3AF', marginLeft: '0.5rem' }}>
                        {entry.rootIssueCorrect ? '✓ Root issue' : '✗ Root issue'} · {entry.fixCorrect ? '✓ Fix' : '✗ Fix'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: scoreColor }}>{scoreLabel}</span>
                      <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{timeAgo(new Date(entry.timestamp).getTime())}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Platform-wide signals */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <BarChart2 size={15} color="#4A5FC1" />
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>Platform Friction Patterns</h3>
            <InfoTooltip
              side="right"
              width={250}
              text="Anonymised aggregate patterns used as the basis for our exercises. Use this to contextualise your own signals and spot common friction patterns."
            />
            <span style={{ marginLeft: 'auto', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, backgroundColor: '#EEF0FB', color: '#4A5FC1' }}>Aggregate</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#9CA3AF', margin: '0 0 1rem', lineHeight: 1.5 }}>
            Anonymised friction patterns — pricing pages, onboarding flows, checkout, and more. These are the scenarios our exercises are based on.
          </p>

          {/* Trigger type glossary */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '1rem' }}>
            {[
              { key: 'exit_intent',  tip: 'A friction pattern where users move toward leaving a page — indicates the product failed to justify their continued attention' },
              { key: 'time_stall',   tip: 'A friction pattern where users dwell on a section without acting — often signals confusion, hesitation, or unclear value' },
              { key: 'scroll_stall', tip: 'A friction pattern where users stop scrolling mid-page — often indicates content that is overwhelming or hard to process' },
              { key: 'no_action',   tip: 'A friction pattern where users view a screen without any interaction — signals onboarding gaps or unclear next steps' },
            ].map(({ key, tip }) => {
              const meta = TRIGGER_META[key];
              return (
                <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.625rem', borderRadius: '7px', fontSize: '0.75rem', fontWeight: 500, backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.color}22` }}>
                  {meta.icon} {meta.label}
                  <InfoTooltip side="top" width={220} text={tip} iconSize={12} iconColor={meta.color} />
                </span>
              );
            })}
          </div>

          {/* Trigger breakdown */}
          <p style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.625rem' }}>Trigger distribution</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {Object.entries(TRIGGER_TOTALS).map(([trigger, { count, pct }]) => {
              const meta = TRIGGER_META[trigger];
              return (
                <div key={trigger} style={{ padding: '0.75rem', borderRadius: '10px', backgroundColor: meta.bg, border: `1px solid ${meta.color}22` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: meta.color }}>{meta.label}</span>
                  </div>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>{pct}%</p>
                  <p style={{ fontSize: '0.68rem', color: '#9CA3AF', margin: 0 }}>{count.toLocaleString()} signals</p>
                </div>
              );
            })}
          </div>

          {/* Top friction options */}
          <p style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.625rem' }}>Top dislike reasons</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {PLATFORM_SIGNALS.map((sig, idx) => {
              const trigMeta = TRIGGER_META[sig.trigger];
              const maxCount = PLATFORM_SIGNALS[0].count;
              const barPct = Math.round((sig.count / maxCount) * 100);
              return (
                <div key={sig.option}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9CA3AF', width: '1.25rem', textAlign: 'right' }}>#{idx + 1}</span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>{sig.option}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.1rem 0.4rem', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 600, backgroundColor: trigMeta.bg, color: trigMeta.color }}>
                        {trigMeta.icon} {trigMeta.label}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: 600, flexShrink: 0, marginLeft: '0.5rem' }}>{sig.pct}%</span>
                  </div>
                  <div style={{ height: '5px', borderRadius: '999px', backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.04 }}
                      style={{ height: '100%', borderRadius: '999px', backgroundColor: trigMeta.color, opacity: 0.65 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Footer context note */}
        <div style={{ padding: '0.875rem 1rem', borderRadius: '12px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <AlertCircle size={14} color="#9CA3AF" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
            <p style={{ fontSize: '0.78rem', color: '#6B7280', margin: 0, lineHeight: 1.55 }}>
              Platform aggregate data is anonymised and represents illustrative friction patterns used as exercise scenarios. Your personal signals are derived from your written responses in Product exercises and stored locally on your device only.
            </p>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
