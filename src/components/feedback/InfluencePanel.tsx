/**
 * InfluencePanel
 * Shows the user's full "influence loop" story:
 *   1. Reputation card  — level, score, XP progress
 *   2. Taste profile    — learned preferences from their feedback
 *   3. Insight credibility — PM case accuracy + domain expert tags
 *   4. Impact feed      — "your feedback is shaping the product"
 */

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Zap, Target, TrendingUp, Users, CheckCircle2, BookOpen, Award, ShieldCheck } from 'lucide-react';
import { FeedbackStore } from '../../lib/FeedbackStore';
import { InsightStore } from '../../lib/InsightStore';
import { THEME_LABELS } from '../../data/frictionCases';
import Card from '../common/Card';
import InfoTooltip from '../common/InfoTooltip';
import PublicProfileToggle from '../profile/PublicProfileToggle';
import { useFrictionCredibility } from '../../integrations/pmGraph/useFrictionCredibility';
import { formatVersionKeyLabel } from '../../integrations/pmGraph/EvaluationStore';
import ProvenanceBadge from '../common/ProvenanceBadge';

// ── static impact cards (real claims once Supabase is wired) ─────────────────

const IMPACT_CARDS = [
  {
    icon: '🧭',
    theme: 'Clarity',
    stat: '74%',
    detail: 'Across products, confusing UI is the #1 reason users stall. Teams that acted on these signals reprioritised simplification into their next sprint.',
    color: '#4A5FC1',
    bg: '#EEF0FB',
  },
  {
    icon: '💰',
    theme: 'Pricing',
    stat: '71%',
    detail: 'Pricing pages generate more exit-intent signals than any other page type. Consistent signals like yours have prompted teams to ship transparent pricing.',
    color: '#D97706',
    bg: '#FFFBEB',
  },
  {
    icon: '🗺️',
    theme: 'Onboarding',
    stat: '77%',
    detail: 'Users who don\'t know where to start on a product bounce within 60 seconds. Signals flagging this friction led to guided first-run flows being built.',
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
          The next time you hesitate or try to leave a product page, a prompt will appear.
          One tap = influence points + a signal about product friction.
        </p>
      </div>
    </Card>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function InfluencePanel() {
  // Read from FeedbackStore fresh on each render
  const rep     = useMemo(() => FeedbackStore.getReputation(),    []);
  const taste   = useMemo(() => FeedbackStore.getTasteProfile(),  []);
  const all     = useMemo(() => FeedbackStore.getAll(),           []);
  const insight = useMemo(() => InsightStore.getProfile(),        []);

  // PM Graph-backed credibility — loaded async from EvaluationStore.
  // When available, dimension-score-derived values replace the coarse MCQ scores.
  // Falls back to InsightStore values while loading or if no PM Graph data exists.
  const { pmProfile, pmEvalCount, loading: pmLoading } = useFrictionCredibility();

  // Resolved values: prefer PM Graph when we have evaluated records.
  const isPMBacked       = !pmLoading && pmProfile !== null && pmProfile.totalExercises > 0;
  const credibilityScore = isPMBacked ? pmProfile!.score           : insight.credibilityScore;
  const expertTags       = isPMBacked ? pmProfile!.expertThemes    : insight.expertTags;
  const confidence       = isPMBacked ? pmProfile!.confidence      : insight.confidence;
  const evalSourceCount  = isPMBacked ? pmEvalCount                : insight.totalCases;

  // Strongest PM Graph theme — the theme with highest accuracy in the pm profile
  const strongestPMTheme = isPMBacked && pmProfile
    ? (Object.entries(pmProfile.themes) as [import('../../data/frictionCases').FrictionTheme, import('../../lib/credibilityEngine').ThemeStat][])
        .sort((a, b) => b[1].accuracy - a[1].accuracy)[0] ?? null
    : null;

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                Product Influence
              </p>
              <InfoTooltip
                side="bottom"
                width={240}
                text="Your influence score grows each time you capture a friction signal. Rare signals (minority opinions) earn extra points because they identify issues most users miss."
              />
            </div>
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
            { icon: <Zap size={14} color="#D97706" />, value: all.length, label: 'signals' },
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>Your Taste Profile</h3>
              <InfoTooltip
                side="right"
                width={240}
                text="Built from friction signals captured across products you've used. The more consistently you identify the same type of friction across different products, the sharper your taste profile becomes."
              />
            </div>
          </div>

          {/* Top signal */}
          <div style={{ padding: '1rem', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(74,95,193,0.06) 0%, rgba(124,58,237,0.06) 100%)', border: '1px solid rgba(74,95,193,0.12)', marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0 0 0.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Primary Signal</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>{taste.topThemeEmoji}</span>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1F2937' }}>{taste.topThemeLabel}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: '0.375rem 0 0', lineHeight: 1.5 }}>
              Your signals across products consistently point to this friction type.
              Products that get this right tend to keep you engaged.
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

      {/* ── 3. Insight Credibility (from FrictionCaseExercise scores) ──────── */}
      {insight.totalCases > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={15} color="white" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>Insight Credibility</h3>
              <InfoTooltip
                side="right"
                width={260}
                text="Earned by completing Friction Cases in the Product section. Each case is scored against benchmarked outcomes — your accuracy builds this score. Low volume cases score lower to prevent lucky guesses."
              />
            </div>
          </div>

          {/* Credibility score bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>
                {isPMBacked ? 'PM dimension score' : 'Accuracy vs. benchmark scenarios'}
              </span>
              {isPMBacked && (
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7C3AED', padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: '#EDE9FE' }}>
                  PM Graph
                </span>
              )}
              {isPMBacked && pmProfile?.versionMix?.isMixed && (
                <span
                  title={`Scored under ${pmProfile.versionMix.distinctVersions.length} rubric versions: ${pmProfile.versionMix.distinctVersions.join(', ')}. Scores are aggregated but may not be directly comparable across versions.`}
                  style={{ fontSize: '0.65rem', fontWeight: 700, color: '#B45309', padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: '#FEF3C7', cursor: 'help' }}
                >
                  mixed rubrics
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#D97706' }}>{credibilityScore}/100</span>
          </div>
          <div style={{ height: '8px', borderRadius: '999px', backgroundColor: '#F3F4F6', overflow: 'hidden', marginBottom: '0.5rem' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${credibilityScore}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ height: '100%', borderRadius: '999px', backgroundColor: '#D97706' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: isPMBacked && pmProfile?.versionMix && !pmProfile.versionMix.isMixed ? '0.375rem' : '1rem' }}>
            <p style={{ fontSize: '0.72rem', color: '#9CA3AF', margin: 0 }}>
              Based on {evalSourceCount} {isPMBacked ? 'PM Graph evaluation' : 'case'}{evalSourceCount !== 1 ? 's' : ''} · {confidence} confidence
            </p>
            <InfoTooltip
              side="right"
              width={270}
              text={isPMBacked
                ? 'Score uses PM Graph dimension scores (6 rubric dimensions per attempt), not just right/wrong. Volume-weighted: more evaluated cases = more weight. Expert tags need ≥2 evaluations at ≥60%.'
                : 'Score = accuracy × volume. More cases = more weight. A single lucky guess scores low; consistent accuracy over 10+ cases scores high.'}
            />
          </div>
          {/* Provenance label — single-version only; mixed case is already shown as a badge above. */}
          {isPMBacked && pmProfile?.versionMix && !pmProfile.versionMix.isMixed && (
            <ProvenanceBadge
              label={formatVersionKeyLabel(pmProfile.versionMix.distinctVersions[0])}
              style={{ margin: '0 0 1rem', fontSize: '0.68rem' }}
            />
          )}

          {/* Impact alignment stat */}
          <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(217,119,6,0.06) 0%, rgba(245,158,11,0.06) 100%)', border: '1px solid rgba(217,119,6,0.15)', marginBottom: expertTags.length > 0 ? '1rem' : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <ShieldCheck size={13} color="#D97706" />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Impact Alignment</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#374151', lineHeight: 1.55 }}>
              Your diagnoses matched the benchmark analysis <strong>{Math.round(insight.avgAccuracy * 100)}%</strong> of the time — putting you in the top {Math.round(100 - insight.avgAccuracy * 60)}% of analysers.
            </p>
          </div>

          {/* Strongest PM theme — shown only when PM-backed and has theme data */}
          {isPMBacked && strongestPMTheme && (
            <div style={{ padding: '0.625rem 0.875rem', borderRadius: '10px', backgroundColor: '#F5F3FF', border: '1px solid #EDE9FE', marginTop: expertTags.length > 0 ? 0 : '0.75rem', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.375rem' }}>Strongest domain</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.125rem' }}>{THEME_LABELS[strongestPMTheme[0]].emoji}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: THEME_LABELS[strongestPMTheme[0]].color }}>
                  {THEME_LABELS[strongestPMTheme[0]].label}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6B7280', marginLeft: 'auto' }}>
                  {Math.round(strongestPMTheme[1].accuracy * 100)}% avg · {strongestPMTheme[1].attempts} eval{strongestPMTheme[1].attempts !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Domain expert tags */}
          {expertTags.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Domain expertise</p>
                <InfoTooltip
                  side="right"
                  width={260}
                  text={isPMBacked
                    ? 'Unlocked when your PM Graph dimension-score average is ≥60% across at least 2 evaluated cases in a theme.'
                    : 'Unlocked when you get ≥60% accuracy on at least 2 cases in a theme. Each tag shows PMs you have a track record in that problem area.'}
                />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {expertTags.map(tag => {
                  const meta = THEME_LABELS[tag];
                  return (
                    <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.7rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.color}33` }}>
                      {meta.emoji} {meta.label} expert
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── 4. Impact feed ────────────────────────────────────────────────── */}
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
            Each signal you capture across products refines your <strong>product taste profile</strong> — a growing record of how you identify friction across the internet. PMs and designers use exactly this kind of cross-product, pattern-based insight.
          </p>
        </div>
      </div>

      {/* ── 5. Public Profile ─────────────────────────────────────────────── */}
      <div>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem' }}>
          Share your credibility
        </p>
        <PublicProfileToggle />
      </div>

    </motion.div>
  );
}
