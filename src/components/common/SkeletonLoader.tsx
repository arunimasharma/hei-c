/**
 * Progressive Skeleton Loader
 *
 * Replaces generic spinners with context-aware loading states that narrate
 * what the AI is doing.  Each variant renders anatomically correct skeleton
 * shapes for its target content area, paired with a reasoning step copy.
 *
 * Usage:
 *   <SkeletonLoader variant="journal" reasoningStep="Mapping the ABC model…" />
 *   <SkeletonLoader variant="actions" />
 *   <SkeletonLoader variant="taste" reasoningStep="Scoring your analysis…" />
 */

import { motion, AnimatePresence } from 'motion/react';

// ── Shared primitives ─────────────────────────────────────────────────────────

function Pulse({
  width = '100%',
  height = '0.875rem',
  radius = '6px',
  opacity = 1,
}: {
  width?: string | number;
  height?: string | number;
  radius?: string;
  opacity?: number;
}) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.85, 0.4] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: '#E9EAED',
        opacity,
      }}
      aria-hidden="true"
    />
  );
}

function ReasoningBadge({ step }: { step: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.3 }}
        role="status"
        aria-live="polite"
        aria-label={`AI status: ${step}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.25rem 0.75rem',
          borderRadius: '999px',
          backgroundColor: 'rgba(74,95,193,0.07)',
          border: '1px solid rgba(74,95,193,0.12)',
          fontSize: '0.75rem',
          fontWeight: 500,
          color: '#4A5FC1',
        }}
      >
        {/* Spinning arc indicator */}
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            border: '1.5px solid rgba(74,95,193,0.25)',
            borderTopColor: '#4A5FC1',
            display: 'inline-block',
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
        {step}
      </motion.div>
    </AnimatePresence>
  );
}

// ── Variant: Journal analysis ─────────────────────────────────────────────────

function JournalSkeleton({ reasoningStep }: { reasoningStep?: string | null }) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
      aria-busy="true"
      aria-label="Analysing your journal entry"
    >
      {reasoningStep && (
        <div>
          <ReasoningBadge step={reasoningStep} />
        </div>
      )}

      {/* Emotion + intensity row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Pulse width={48} height={48} radius="50%" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <Pulse width="40%" height="1rem" />
          <Pulse width="25%" height="0.75rem" opacity={0.6} />
        </div>
      </div>

      {/* Summary lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <Pulse width="100%" />
        <Pulse width="88%" />
        <Pulse width="72%" opacity={0.7} />
      </div>

      {/* CBT section placeholder */}
      <div
        style={{
          padding: '0.875rem',
          borderRadius: '12px',
          backgroundColor: 'rgba(74,95,193,0.03)',
          border: '1px solid rgba(74,95,193,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <Pulse width="30%" height="0.75rem" opacity={0.5} />
        <Pulse width="95%" />
        <Pulse width="80%" opacity={0.7} />
      </div>

      {/* Trigger pills */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
        {[52, 68, 44].map((w, i) => (
          <Pulse key={i} width={w} height="1.5rem" radius="999px" opacity={0.5} />
        ))}
      </div>
    </div>
  );
}

// ── Variant: Micro-actions list ───────────────────────────────────────────────

function ActionsSkeleton({ reasoningStep }: { reasoningStep?: string | null }) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
      aria-busy="true"
      aria-label="Generating personalised actions"
    >
      {reasoningStep && (
        <div>
          <ReasoningBadge step={reasoningStep} />
        </div>
      )}

      {[1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            padding: '0.75rem',
            borderRadius: '12px',
            backgroundColor: '#FAFAFA',
            border: '1px solid #F3F4F6',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <Pulse width={32} height={32} radius="9px" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <Pulse width="65%" height="0.9rem" />
            <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
              <Pulse width={60} height="1.25rem" radius="999px" opacity={0.5} />
              <Pulse width={40} height="0.75rem" opacity={0.4} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Variant: Taste exercise scoring ──────────────────────────────────────────

function TasteSkeleton({ reasoningStep }: { reasoningStep?: string | null }) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      aria-busy="true"
      aria-label="Scoring your product analysis"
    >
      {reasoningStep && (
        <div>
          <ReasoningBadge step={reasoningStep} />
        </div>
      )}

      {/* Score circle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Pulse width={52} height={52} radius="14px" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Pulse key={i} width={14} height={14} radius="3px" opacity={0.5} />
            ))}
          </div>
          <Pulse width="50%" height="0.75rem" opacity={0.6} />
        </div>
      </div>

      {/* Analysis text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <Pulse width="100%" />
        <Pulse width="94%" />
        <Pulse width="87%" />
        <Pulse width="60%" opacity={0.7} />
      </div>
    </div>
  );
}

// ── Variant: Ideal scenario / growth profile ──────────────────────────────────

function ProfileSkeleton({ reasoningStep }: { reasoningStep?: string | null }) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
      aria-busy="true"
      aria-label="Building your growth profile"
    >
      {reasoningStep && (
        <div>
          <ReasoningBadge step={reasoningStep} />
        </div>
      )}

      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Pulse width="35%" height="0.75rem" opacity={0.5} />
          <Pulse width="100%" height="1rem" />
          <Pulse width="78%" opacity={0.65} />
        </div>
      ))}
    </div>
  );
}

// ── Variant: Generic inline (replaces LoadingSpinner in simple contexts) ──────

function InlineSkeleton({
  lines = 2,
  reasoningStep,
}: {
  lines?: number;
  reasoningStep?: string | null;
}) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
      aria-busy="true"
    >
      {reasoningStep && (
        <div style={{ marginBottom: '0.25rem' }}>
          <ReasoningBadge step={reasoningStep} />
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <Pulse key={i} width={i === lines - 1 ? '65%' : '100%'} opacity={i === 0 ? 1 : 0.7} />
      ))}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export type SkeletonVariant = 'journal' | 'actions' | 'taste' | 'profile' | 'inline';

interface SkeletonLoaderProps {
  variant?: SkeletonVariant;
  /** The current AI reasoning step text (from useJournalAnalysis or similar). */
  reasoningStep?: string | null;
  /** Number of lines for the 'inline' variant. */
  lines?: number;
}

export default function SkeletonLoader({
  variant = 'inline',
  reasoningStep,
  lines,
}: SkeletonLoaderProps) {
  switch (variant) {
    case 'journal':  return <JournalSkeleton  reasoningStep={reasoningStep} />;
    case 'actions':  return <ActionsSkeleton  reasoningStep={reasoningStep} />;
    case 'taste':    return <TasteSkeleton    reasoningStep={reasoningStep} />;
    case 'profile':  return <ProfileSkeleton  reasoningStep={reasoningStep} />;
    default:         return <InlineSkeleton   reasoningStep={reasoningStep} lines={lines} />;
  }
}
