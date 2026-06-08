import { type CSSProperties, type ReactNode } from 'react';
import type { DrillType, DrillDifficulty } from '../../types/drilloop';

// ── Shared Drilloop visual language ──
// Drilloop's pillar colour is teal (loop / repetition), distinct from the
// existing Coach (#4A5FC1), Product (#7C3AED) and Influence (#D97706) pillars.

export const DRILLOOP = '#0D9488';
export const DRILLOOP_DARK = '#0B7A70';
export const DRILLOOP_SOFT = 'rgba(13,148,136,0.08)';

export function ProgressBar({ value, color = DRILLOOP, height = 8 }: { value: number; color?: string; height?: number }) {
  return (
    <div style={{ width: '100%', height, borderRadius: 999, backgroundColor: '#EEF2F1', overflow: 'hidden' }}>
      <div
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: '100%',
          borderRadius: 999,
          backgroundColor: color,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
}

export function Pill({ children, color = DRILLOOP, soft = true, style }: { children: ReactNode; color?: string; soft?: boolean; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        padding: '0.2rem 0.55rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600,
        color: soft ? color : 'white',
        backgroundColor: soft ? `${color}14` : color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function StatTile({ label, value, sub, color = DRILLOOP }: { label: string; value: ReactNode; sub?: string; color?: string }) {
  return (
    <div style={{ flex: '1 1 120px', minWidth: 120, padding: '0.875rem 1rem', borderRadius: 14, backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', marginTop: '0.2rem' }}>{label}</div>
      {sub && <div style={{ fontSize: '0.6875rem', color: '#9CA3AF', marginTop: '0.15rem' }}>{sub}</div>}
    </div>
  );
}

export const TYPE_META: Record<DrillType, { label: string; emoji: string }> = {
  judgment: { label: 'Judgment call', emoji: '⚖️' },
  scenario: { label: 'Scenario', emoji: '🎬' },
  recall: { label: 'Recall', emoji: '🧩' },
};

export const DIFFICULTY_META: Record<DrillDifficulty, { label: string; color: string }> = {
  core: { label: 'Core', color: '#0D9488' },
  stretch: { label: 'Stretch', color: '#D97706' },
  mastery: { label: 'Mastery', color: '#7C3AED' },
};

export function PageHeader({ emoji, title, subtitle, right }: { emoji: string; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${DRILLOOP}, ${DRILLOOP_DARK})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
          {emoji}
        </div>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.01em' }}>{title}</h1>
          {subtitle && <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: '0.15rem 0 0' }}>{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}
