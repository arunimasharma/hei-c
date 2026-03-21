/**
 * FlowJourney
 * Horizontal 5-step navigation showing the friction-signal → influence loop.
 *
 * variant="nav"    — used as the primary header navigation (prominent, larger)
 * variant="inline" — small inline strip inside page content (legacy, deprecated)
 *
 * Auto-detects the active step from the current URL when no `active` prop given.
 * Steps: Coach → Signals → Product → Influence → Actions
 */

import { useLocation, Link } from 'react-router';
import { ChevronRight } from 'lucide-react';

export type JourneyStep = 'coach' | 'signals' | 'product' | 'influence' | 'actions';

interface Step {
  id: JourneyStep;
  emoji: string;
  label: string;
  path: string;
  tip: string;
}

const STEPS: Step[] = [
  { id: 'coach',     emoji: '🧠', label: 'Coach',     path: '/',          tip: 'Reflect on product experiences and start exercises' },
  { id: 'signals',   emoji: '📡', label: 'Signals',   path: '/signals',   tip: 'Friction patterns you\'ve identified through exercises' },
  { id: 'product',   emoji: '🧪', label: 'Product',   path: '/product',   tip: 'Diagnose friction cases to build analytical credibility' },
  { id: 'influence', emoji: '⚡', label: 'Influence',  path: '/influence', tip: 'Your reputation & Insight Credibility score' },
  { id: 'actions',   emoji: '💡', label: 'Actions',   path: '/actions',   tip: 'Recommended next steps based on your exercise signals' },
];

const PATH_TO_STEP: Record<string, JourneyStep> = {
  '/':          'coach',
  '/signals':   'signals',
  '/product':   'product',
  '/influence': 'influence',
  '/actions':   'actions',
};

interface FlowJourneyProps {
  /** Explicit active step — if omitted, auto-detected from current URL */
  active?: JourneyStep;
  /** 'nav' = primary header navigation; 'inline' = small in-page strip */
  variant?: 'nav' | 'inline';
}

export default function FlowJourney({ active, variant = 'inline' }: FlowJourneyProps) {
  const location = useLocation();
  const activeStep = active ?? PATH_TO_STEP[location.pathname] ?? undefined;
  const isNav = variant === 'nav';

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      gap: isNav ? '0.125rem' : '0.125rem',
      padding: isNav ? '0' : '0.5rem 0.875rem',
      borderRadius: isNav ? '0' : '12px',
      backgroundColor: isNav ? 'transparent' : '#F9FAFB',
      border: isNav ? 'none' : '1px solid #E5E7EB',
    }}>
      {STEPS.map((step, idx) => {
        const isCurrent = step.id === activeStep;

        if (isNav) {
          return (
            <span key={step.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0' }}>
              <Link
                to={step.path}
                title={step.tip}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.5rem 0.875rem', borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: isCurrent ? 600 : 400,
                  textDecoration: 'none', transition: 'background 0.15s, color 0.15s',
                  color: isCurrent ? '#1F2937' : '#6B7280',
                  backgroundColor: isCurrent ? 'rgba(0,0,0,0.05)' : 'transparent',
                  pointerEvents: isCurrent ? 'none' : 'auto',
                }}
                onMouseEnter={e => {
                  if (!isCurrent) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)';
                }}
                onMouseLeave={e => {
                  if (!isCurrent) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ fontSize: '1rem' }}>{step.emoji}</span>
                <span>{step.label}</span>
              </Link>
              {idx < STEPS.length - 1 && (
                <ChevronRight size={13} color="#D1D5DB" style={{ flexShrink: 0, marginLeft: '-0.125rem', marginRight: '-0.125rem' }} />
              )}
            </span>
          );
        }

        // inline variant
        return (
          <span key={step.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.125rem' }}>
            <Link
              to={step.path}
              title={step.tip}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.25rem 0.5rem', borderRadius: '7px',
                fontSize: '0.75rem', fontWeight: isCurrent ? 700 : 400,
                textDecoration: 'none', transition: 'background 0.15s',
                color: isCurrent ? '#1F2937' : '#9CA3AF',
                backgroundColor: isCurrent ? 'white' : 'transparent',
                boxShadow: isCurrent ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                pointerEvents: isCurrent ? 'none' : 'auto',
              }}
            >
              <span style={{ fontSize: '0.8125rem' }}>{step.emoji}</span>
              <span>{step.label}</span>
            </Link>
            {idx < STEPS.length - 1 && (
              <ChevronRight size={11} color="#D1D5DB" style={{ flexShrink: 0 }} />
            )}
          </span>
        );
      })}
    </div>
  );
}
