/**
 * TransparencyBadge
 *
 * Shows the proof hash and explains how verification works.
 * The badge exists to answer one question a viewer might ask:
 *   "How do I know this score is real?"
 *
 * Design intent:
 *   • Calm, professional — not defensive
 *   • Explains the verification model simply
 *   • Truncates hash for readability; reveals full hash on expand
 *   • No raw data is ever shown here
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  proofHash: string;
  lastUpdated: string;
  /** Compact mode for inline use (e.g. inside a card). Full mode for the public page. */
  variant?: 'compact' | 'full';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function TransparencyBadge({ proofHash, lastUpdated, variant = 'full' }: Props) {
  const [expanded, setExpanded] = useState(false);

  const shortHash = proofHash.slice(0, 8) + '…' + proofHash.slice(-8);

  if (variant === 'compact') {
    return (
      <div style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            '0.375rem',
        padding:        '0.3rem 0.7rem',
        borderRadius:   '999px',
        backgroundColor: '#F0FDF4',
        border:         '1px solid #BBF7D0',
      }}>
        <ShieldCheck size={13} color="#16A34A" />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16A34A' }}>
          Verified
        </span>
        <span style={{ fontSize: '0.72rem', color: '#6B7280', fontFamily: 'monospace' }}>
          {proofHash.slice(0, 8)}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius:    '16px',
      border:          '1px solid #BBF7D0',
      backgroundColor: '#F0FDF4',
      overflow:        'hidden',
    }}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '0.875rem 1rem',
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          textAlign:      'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width:           '30px',
            height:          '30px',
            borderRadius:    '8px',
            backgroundColor: '#DCFCE7',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
          }}>
            <ShieldCheck size={15} color="#16A34A" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#15803D' }}>
              Verified by proof hash
            </p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6B7280' }}>
              Last computed {formatDate(lastUpdated)}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <code style={{
            fontSize:        '0.72rem',
            color:           '#374151',
            backgroundColor: '#E5E7EB',
            padding:         '0.2rem 0.4rem',
            borderRadius:    '4px',
            fontFamily:      'monospace',
          }}>
            {shortHash}
          </code>
          {expanded
            ? <ChevronUp size={14} color="#6B7280" />
            : <ChevronDown size={14} color="#6B7280" />
          }
        </div>
      </button>

      {/* Expandable explanation */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding:         '0 1rem 1rem',
              borderTop:       '1px solid #BBF7D0',
              paddingTop:      '0.875rem',
            }}>

              {/* How it works */}
              <p style={{ fontSize: '0.8125rem', color: '#374151', lineHeight: 1.6, margin: '0 0 0.75rem' }}>
                This score is derived from Friction Case exercises completed inside the Hello-EQ platform.
                Each case is scored against a benchmarked outcome — the credibility score reflects both
                accuracy and volume. To prevent spoofing, a proof hash is computed from the score,
                expertise tags, case count, and the current month.
              </p>

              {/* Hash sections */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.875rem' }}>
                {[
                  { label: 'What\'s hashed',   value: 'Score · Tags · Case count · Month (YYYY-MM)' },
                  { label: 'Algorithm',         value: 'SHA-256 via Web Crypto API' },
                  { label: 'Rotation',          value: 'Hash refreshes each time the profile syncs' },
                  { label: 'What\'s excluded',  value: 'Raw answers · Journal entries · Any personal data' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16A34A', minWidth: '7rem', flexShrink: 0 }}>
                      {label}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#374151' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Full hash */}
              <div>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.3rem' }}>
                  Full hash
                </p>
                <code style={{
                  display:         'block',
                  fontSize:        '0.72rem',
                  wordBreak:       'break-all',
                  color:           '#374151',
                  backgroundColor: '#E5E7EB',
                  padding:         '0.5rem 0.625rem',
                  borderRadius:    '6px',
                  fontFamily:      'monospace',
                  lineHeight:      1.6,
                }}>
                  {proofHash}
                </code>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
