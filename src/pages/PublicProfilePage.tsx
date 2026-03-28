/**
 * PublicProfilePage — /p/:slug
 *
 * Public-facing page that displays a user's credibility profile.
 * This page is safe to share externally (LinkedIn, portfolio, etc).
 *
 * Data source: /api/public-profile/:slug
 * Only credibilityScore, expertTags, proofHash, and lastUpdated are fetched.
 * No personal data is ever shown here.
 */

import { useEffect, useState } from 'react';
import { useParams }           from 'react-router';
import { motion }              from 'motion/react';
import { Award, ShieldCheck }  from 'lucide-react';
import TransparencyBadge       from '../components/profile/TransparencyBadge';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicProfile {
  credibilityScore: number;
  expertTags:       string[];
  proofHash:        string;
  lastUpdated:      string;
}

// ── Theme metadata (matches THEME_LABELS in frictionCases.ts) ─────────────────

const THEME_META: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  pricing:    { label: 'Pricing',      emoji: '💰', color: '#D97706', bg: '#FFFBEB' },
  ux:         { label: 'UX / Clarity', emoji: '🧭', color: '#4A5FC1', bg: '#EEF0FB' },
  onboarding: { label: 'Onboarding',   emoji: '🗺️', color: '#10B981', bg: '#ECFDF5' },
  value:      { label: 'Value',        emoji: '🎯', color: '#7C3AED', bg: '#F5F3FF' },
  trust:      { label: 'Trust',        emoji: '🔒', color: '#0369A1', bg: '#F0F9FF' },
};

// ── Score → tier config ───────────────────────────────────────────────────────

function scoreTier(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: 'Product Lead',     color: '#7C3AED', bg: '#F5F3FF' };
  if (score >= 60) return { label: 'Product Analyst',  color: '#4A5FC1', bg: '#EEF0FB' };
  if (score >= 40) return { label: 'Influencer',       color: '#0369A1', bg: '#F0F9FF' };
  if (score >= 20) return { label: 'Critic',           color: '#D97706', bg: '#FFFBEB' };
  return              { label: 'Observer',            color: '#6B7280', bg: '#F3F4F6' };
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const tier       = scoreTier(score);
  const radius     = 44;
  const circ       = 2 * Math.PI * radius;
  const dashOffset = circ * (1 - score / 100);

  return (
    <div style={{ position: 'relative', width: '120px', height: '120px' }}>
      <svg width="120" height="120" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx="55" cy="55" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="10" />
        {/* Progress */}
        <motion.circle
          cx="55" cy="55" r={radius}
          fill="none"
          stroke={tier.color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      {/* Score label */}
      <div style={{
        position:        'absolute',
        inset:           0,
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
      }}>
        <span style={{ fontSize: '1.875rem', fontWeight: 800, color: tier.color, lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          / 100
        </span>
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  const bar = (w: string, h = '14px') => (
    <div style={{ width: w, height: h, borderRadius: '6px', backgroundColor: '#E5E7EB', animation: 'pulse 1.5s ease-in-out infinite' }} />
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', paddingTop: '3rem' }}>
      <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#E5E7EB' }} />
      {bar('8rem', '1.5rem')}
      {bar('14rem')}
      {bar('10rem')}
    </div>
  );
}

// ── Not-found state ───────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div style={{ textAlign: 'center', paddingTop: '4rem', paddingBottom: '2rem' }}>
      <p style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</p>
      <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.5rem' }}>
        Profile not found
      </p>
      <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>
        This link may be invalid or the profile may have been removed.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PublicProfilePage() {
  const { slug }    = useParams<{ slug: string }>();
  const [profile,  setProfile]  = useState<PublicProfile | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public-profile/${encodeURIComponent(slug)}`);
        if (cancelled) return;
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json() as PublicProfile;
        setProfile(data);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slug]);

  const tier = profile ? scoreTier(profile.credibilityScore) : null;

  return (
    <div style={{
      minHeight:       '100dvh',
      backgroundColor: '#F9FAFB',
      fontFamily:      'Inter, system-ui, sans-serif',
    }}>
      {/* ── Minimal header ── */}
      <header style={{
        borderBottom:    '1px solid #E5E7EB',
        backgroundColor: 'white',
        padding:         '0.875rem 1.5rem',
        display:         'flex',
        alignItems:      'center',
        gap:             '0.5rem',
      }}>
        <div style={{
          width:           '28px', height: '28px',
          borderRadius:    '8px',
          background:      'linear-gradient(135deg, #4A5FC1 0%, #7C3AED 100%)',
          display:         'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Award size={14} color="white" />
        </div>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F2937' }}>Hello-EQ</span>
        <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>· Credibility Profile</span>
      </header>

      {/* ── Content ── */}
      <main style={{
        maxWidth: '480px',
        margin:   '0 auto',
        padding:  '2rem 1.25rem 4rem',
      }}>
        {loading && <Skeleton />}
        {!loading && notFound && <NotFound />}

        {!loading && profile && tier && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >

            {/* ── Score card ── */}
            <div style={{
              backgroundColor: 'white',
              borderRadius:    '20px',
              border:          '1px solid #E5E7EB',
              padding:         '2rem 1.5rem',
              display:         'flex',
              flexDirection:   'column',
              alignItems:      'center',
              gap:             '1rem',
              textAlign:       'center',
              boxShadow:       '0 1px 4px rgba(0,0,0,0.04)',
            }}>

              {/* Tier badge */}
              <span style={{
                padding:         '0.3rem 0.875rem',
                borderRadius:    '999px',
                fontSize:        '0.78rem',
                fontWeight:      700,
                color:           tier.color,
                backgroundColor: tier.bg,
                border:          `1px solid ${tier.color}30`,
                letterSpacing:   '0.02em',
              }}>
                {tier.label}
              </span>

              {/* Animated score ring */}
              <ScoreRing score={profile.credibilityScore} />

              {/* Label */}
              <div>
                <p style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#1F2937' }}>
                  Insight Credibility
                </p>
                <p style={{ margin: '0.375rem 0 0', fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.55, maxWidth: '22rem' }}>
                  Earned by diagnosing real product friction cases against expert benchmarks.
                  The higher the score, the more consistently accurate the analysis.
                </p>
              </div>
            </div>

            {/* ── Expert tags ── */}
            {profile.expertTags.length > 0 && (
              <div style={{
                backgroundColor: 'white',
                borderRadius:    '16px',
                border:          '1px solid #E5E7EB',
                padding:         '1.25rem 1.375rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.875rem' }}>
                  <ShieldCheck size={15} color="#4A5FC1" />
                  <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#1F2937' }}>
                    Domain Expertise
                  </p>
                </div>
                <p style={{ margin: '0 0 0.875rem', fontSize: '0.8rem', color: '#6B7280', lineHeight: 1.5 }}>
                  Unlocked by achieving ≥60% accuracy across multiple cases in a domain.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {profile.expertTags.map(tag => {
                    const meta = THEME_META[tag] ?? { label: tag, emoji: '🏷', color: '#6B7280', bg: '#F3F4F6' };
                    return (
                      <span key={tag} style={{
                        display:         'inline-flex',
                        alignItems:      'center',
                        gap:             '0.3rem',
                        padding:         '0.375rem 0.75rem',
                        borderRadius:    '999px',
                        fontSize:        '0.8125rem',
                        fontWeight:      600,
                        color:           meta.color,
                        backgroundColor: meta.bg,
                        border:          `1px solid ${meta.color}30`,
                      }}>
                        {meta.emoji} {meta.label} expert
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Transparency badge ── */}
            <TransparencyBadge
              proofHash={profile.proofHash}
              lastUpdated={profile.lastUpdated}
              variant="full"
            />

            {/* ── Footer: about Hello-EQ ── */}
            <div style={{
              padding:         '1.125rem 1.375rem',
              borderRadius:    '16px',
              backgroundColor: '#F3F4F6',
              border:          '1px solid #E5E7EB',
            }}>
              <p style={{ margin: '0 0 0.375rem', fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
                What is Hello-EQ?
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#6B7280', lineHeight: 1.6 }}>
                Hello-EQ is a private practice environment for product thinkers. Friction Case exercises
                present real product scenarios and score how accurately you diagnose the root cause.
                This profile shows only the aggregated outcome — your private reasoning stays local and encrypted.
              </p>
            </div>

          </motion.div>
        )}
      </main>
    </div>
  );
}
