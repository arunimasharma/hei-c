/**
 * InfluencePanel
 * Shows the user's full "influence loop" story:
 *   1. Reputation card  — level, score, XP progress
 *   2. Taste profile    — learned preferences from their feedback
 *   3. Impact feed      — "your feedback is shaping the product"
 */

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Zap, Target, TrendingUp, Users, CheckCircle2, BookOpen } from 'lucide-react';
import { FeedbackStore } from '../../lib/FeedbackStore';
import Card from '../common/Card';

// ── static impact cards (real claims once Supabase is wired) ─────────────────

const IMPACT_CARDS = [
  {
    icon: '🧭',
    theme: 'Clarity',
    stat: '74%',
    detail: 'When most users flag confusing UI, teams have reprioritised simplification into their next sprint.',
    color: '#4A5FC1',
    bg: '#EEF0FB',
  },
  {
    icon: '💰',
    theme: 'Pricing',
    stat: '71%',
    detail: 'Consistent price-friction signals have prompted teams to ship transparent pricing pages.',
    color: '#D97706',
    bg: '#FFFBEB',
  },
  {
    icon: '🗺️',
    theme: 'Onboarding',
    stat: '77%',
    detail: 'When users repeatedly say they don\'t know where to start, guided first-run flows get built.',
    color: '#10B981',
    bg: '#ECFDF5',
  },
];

// ── reputation progress bar ───────────────────────────────────────────────────

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: '8px', borderRadius: '999px', backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ height: '100%', borderRadius: '999px', backgroundColor: color }}
      />
    </div>
  );
}

// ── empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📣</div>
        <p style={{ fontWeight: 600, color: '#1F2937', marginBottom: '0.375rem' }}>
          Your influence story starts here
        </p>
        <p style={{ fontSize: '0.875rem', color: '#6B7280', maxWidth: '18rem', margin: '0 auto' }}>
          The next time you feel friction while using the app, a prompt will appear.
          One tap = influence points + product impact.
        </p>
      </div>
    </Card>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function InfluencePanel() {
  // Read from FeedbackStore fresh on each render
  const rep   = useMemo(() => FeedbackStore.getReputation(),    []);
  const taste = useMemo(() => FeedbackStore.getTasteProfile(),  []);
  const all   = useMemo(() => FeedbackStore.getAll(),           []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
    >

      {/* ── 1. Reputation card ────────────────────────────────────────────── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Product Influence
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.375rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{rep.levelEmoji}</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937' }}>{rep.level}</span>
            </div>
          </div>
          <div style={{
            textAlign: 'right',
            padding: '0.5rem 0.875rem',
            borderRadius: '12px',
            backgroundColor: '#F9FAFB',
            border: '1px solid #E5E7EB',
          }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: rep.levelColor, margin: 0 }}>{rep.score}</p>
            <p style={{ fontSize: '0.7rem', color: '#9CA3AF', margin: 0, fontWeight: 600 }}>pts</p>
          </div>
        </div>

        <div style={{ marginBottom: '0.5rem' }}>
          <ProgressBar pct={rep.progressPct} color={rep.levelColor} />
        </div>
        <p style={{ fontSize: '0.78rem', color: '#9CA3AF', margin: 0 }}>
          {rep.progressPct < 100
            ? `${rep.nextLevelScore - rep.score} pts to next level`
            : 'Maximum level reached'}
        </p>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1.25rem' }}>
          {[
            { icon: <Zap size={14} color="#D97706" />, value: all.length, label: 'feedbacks' },
            { icon: <Target size={14} color="#4A5FC1" />, value: taste?.triggerVariety ?? 0, label: 'trigger types' },
            { icon: <TrendingUp size={14} color="#10B981" />, value: rep.score, label: 'influence pts' },
          ].map(({ icon, value, label }) => (
            <div key={label} style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                {icon}
              </div>
              <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>{value}</p>
              <p style={{ fontSize: '0.65rem', color: '#9CA3AF', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── 2. Taste profile ──────────────────────────────────────────────── */}
      {taste ? (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={15} color="white" />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>Your Taste Profile</h3>
          </div>

          {/* Top signal */}
          <div style={{ padding: '1rem', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(74,95,193,0.06) 0%, rgba(124,58,237,0.06) 100%)', border: '1px solid rgba(74,95,193,0.12)', marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0 0 0.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Primary Signal</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>{taste.topThemeEmoji}</span>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1F2937' }}>{taste.topThemeLabel}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: '0.375rem 0 0', lineHeight: 1.5 }}>
              Your feedback consistently points to this pattern.
              Products that nail this tend to resonate most with you.
            </p>
          </div>

          {/* Recent feedback tags */}
          {taste.recentOptions.length > 0 && (
            <div>
              <p style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>Recent signals</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {taste.recentOptions.map((opt, i) => (
                  <span key={i} style={{ padding: '0.3rem 0.7rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 500, backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' }}>
                    {opt}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      ) : (
        <EmptyState />
      )}

      {/* ── 3. Impact feed ────────────────────────────────────────────────── */}
      <div>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem' }}>
          What consistent feedback can unlock
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {IMPACT_CARDS.map((card) => (
            <motion.div
              key={card.theme}
              whileHover={{ y: -1 }}
              style={{
                padding: '1rem 1.125rem',
                borderRadius: '14px',
                backgroundColor: card.bg,
                border: `1px solid ${card.color}22`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.875rem',
              }}
            >
              <span style={{ fontSize: '1.375rem', flexShrink: 0, marginTop: '0.1rem' }}>{card.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: card.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.theme}</span>
                  <span style={{ padding: '0.1rem 0.45rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, color: card.color, backgroundColor: `${card.color}18` }}>
                    {card.stat} agree
                  </span>
                </div>
                <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0, lineHeight: 1.5 }}>{card.detail}</p>
              </div>
              <CheckCircle2 size={16} color={card.color} style={{ flexShrink: 0, marginTop: '0.2rem', opacity: 0.7 }} />
            </motion.div>
          ))}
        </div>

        {/* Trust + career signal footer */}
        <div style={{ marginTop: '1rem', padding: '0.875rem 1rem', borderRadius: '14px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <Users size={14} color="#4A5FC1" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1F2937' }}>Why this matters for you</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#6B7280', margin: 0, lineHeight: 1.55 }}>
            Each signal you give refines your <strong>product taste profile</strong> — a growing record of how you
            think about products. PMs and designers use exactly this kind of sharp, pattern-based feedback.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
