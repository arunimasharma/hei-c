/**
 * PublicProfileToggle
 *
 * Private app UI for enabling / disabling the public credibility profile.
 * Lives inside the InfluencePanel on the Influence page.
 *
 * States:
 *   idle     — not yet enabled, no public link exists
 *   syncing  — payload being computed and pushed to Supabase
 *   live     — profile is published and link is shareable
 *   error    — sync failed (Supabase error or network issue)
 *   offline  — device is offline; will sync when reconnected
 *
 * Privacy copy is prominent and honest — users should understand
 * exactly what is and isn't shared before they flip the switch.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Link2, ExternalLink, RefreshCw, WifiOff, AlertCircle, Lock, CheckCircle2 } from 'lucide-react';
import { useAuth }                  from '../../context/AuthContext';
import {
  buildPublicProfilePayload,
  getOrCreateSlug,
  isPublicProfileEnabled,
  setPublicProfileEnabled,
} from '../../lib/publicProfile';
import {
  syncPublicProfile,
  removePublicProfile,
  getSyncStatus,
  type SyncStatus,
} from '../../services/publicProfileSync';

// ── Status display config ─────────────────────────────────────────────────────

const STATUS_META: Record<SyncStatus, { label: string; color: string; icon: React.ReactNode }> = {
  idle:    { label: 'Not published',  color: '#9CA3AF', icon: <Globe size={13} />        },
  syncing: { label: 'Publishing…',   color: '#D97706', icon: <RefreshCw size={13} />     },
  live:    { label: 'Live',           color: '#16A34A', icon: <CheckCircle2 size={13} />  },
  error:   { label: 'Sync failed',   color: '#DC2626', icon: <AlertCircle size={13} />   },
  offline: { label: 'Offline',       color: '#6B7280', icon: <WifiOff size={13} />       },
};

// ── What is / isn't shared ────────────────────────────────────────────────────

const SHARED_ITEMS = [
  'Credibility score (0–100)',
  'Domain expertise tags',
  'Verification hash',
];

const PRIVATE_ITEMS = [
  'Journal entries',
  'Emotional logs',
  'Exercise answers',
  'AI reflections',
  'Career events',
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PublicProfileToggle() {
  const { user }  = useAuth();
  const slug      = getOrCreateSlug();
  const publicUrl = `${window.location.origin}/p/${slug}`;

  const [enabled,  setEnabled]  = useState(() => isPublicProfileEnabled());
  const [status,   setStatus]   = useState<SyncStatus>(() => getSyncStatus());
  const [copied,   setCopied]   = useState(false);
  const [noActivity, setNoActivity] = useState(false);

  // ── Toggle handler ──────────────────────────────────────────────────────────

  const handleToggle = useCallback(async () => {
    if (!user) return;

    if (enabled) {
      // Disable: remove from Supabase, update local state
      setEnabled(false);
      setPublicProfileEnabled(false);
      setStatus('idle');
      await removePublicProfile(user.id);
    } else {
      // Enable: build payload and sync
      setEnabled(true);
      setPublicProfileEnabled(true);
      setStatus('syncing');
      setNoActivity(false);

      const payload = await buildPublicProfilePayload();
      if (!payload) {
        // No activity to share yet
        setEnabled(false);
        setPublicProfileEnabled(false);
        setStatus('idle');
        setNoActivity(true);
        return;
      }

      const result = await syncPublicProfile(user.id, slug, payload);
      setStatus(result);
    }
  }, [enabled, user, slug]);

  // ── Retry handler ───────────────────────────────────────────────────────────

  const handleRetry = useCallback(async () => {
    if (!user) return;
    setStatus('syncing');
    const payload = await buildPublicProfilePayload();
    if (!payload) { setStatus('error'); return; }
    const result = await syncPublicProfile(user.id, slug, payload);
    setStatus(result);
  }, [user, slug]);

  // ── Copy link ───────────────────────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — ignore */ }
  }, [publicUrl]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const meta = STATUS_META[status];

  return (
    <div style={{
      borderRadius:    '16px',
      border:          '1px solid #E5E7EB',
      backgroundColor: '#FAFAFA',
      overflow:        'hidden',
    }}>

      {/* ── Header row with toggle ── */}
      <div style={{
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'space-between',
        padding:        '1rem 1.125rem',
        gap:            '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
          <div style={{
            width:           '32px', height: '32px',
            borderRadius:    '10px',
            background:      'linear-gradient(135deg, #4A5FC1 0%, #7C3AED 100%)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            flexShrink:      0,
          }}>
            <Globe size={15} color="white" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937' }}>
              Public Profile
            </p>
            <p style={{ margin: '0.125rem 0 0', fontSize: '0.78rem', color: '#6B7280', lineHeight: 1.45 }}>
              Share your credibility score with the world.
            </p>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          onClick={handleToggle}
          disabled={status === 'syncing'}
          aria-label={enabled ? 'Disable public profile' : 'Enable public profile'}
          style={{
            position:        'relative',
            width:           '42px',
            height:          '24px',
            borderRadius:    '999px',
            border:          'none',
            cursor:          status === 'syncing' ? 'not-allowed' : 'pointer',
            backgroundColor: enabled ? '#4A5FC1' : '#D1D5DB',
            transition:      'background-color 0.2s',
            flexShrink:      0,
          }}
        >
          <motion.span
            animate={{ x: enabled ? 20 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              position:        'absolute',
              top:             '3px',
              left:            0,
              width:           '18px',
              height:          '18px',
              borderRadius:    '50%',
              backgroundColor: 'white',
              boxShadow:       '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        </button>
      </div>

      {/* ── Status pill ── */}
      <div style={{ padding: '0 1.125rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{
          display:         'inline-flex',
          alignItems:      'center',
          gap:             '0.3rem',
          padding:         '0.25rem 0.625rem',
          borderRadius:    '999px',
          fontSize:        '0.75rem',
          fontWeight:      600,
          color:           meta.color,
          backgroundColor: `${meta.color}14`,
          border:          `1px solid ${meta.color}30`,
        }}>
          {meta.icon}
          {meta.label}
        </span>

        {/* Retry button on error */}
        {status === 'error' && (
          <button
            onClick={handleRetry}
            style={{
              fontSize:        '0.75rem',
              color:           '#4A5FC1',
              background:      'none',
              border:          'none',
              cursor:          'pointer',
              textDecoration:  'underline',
              padding:         0,
            }}
          >
            Retry
          </button>
        )}
      </div>

      {/* ── No-activity warning ── */}
      <AnimatePresence>
        {noActivity && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              margin:          '0 1.125rem 0.875rem',
              padding:         '0.75rem',
              borderRadius:    '10px',
              backgroundColor: '#FFFBEB',
              border:          '1px solid #FDE68A',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#92400E', lineHeight: 1.5 }}>
              Complete at least one Friction Case in the Product section before enabling your public profile.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Live: actions ── */}
      <AnimatePresence>
        {status === 'live' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{
              margin:       '0 1.125rem 1rem',
              padding:      '0.75rem 1rem',
              borderRadius: '12px',
              backgroundColor: '#F9FAFB',
              border:       '1px solid #E5E7EB',
            }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your public link
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <code style={{
                  flex:            1,
                  fontSize:        '0.78rem',
                  color:           '#374151',
                  backgroundColor: '#E5E7EB',
                  padding:         '0.375rem 0.625rem',
                  borderRadius:    '6px',
                  overflow:        'hidden',
                  textOverflow:    'ellipsis',
                  whiteSpace:      'nowrap',
                  fontFamily:      'monospace',
                }}>
                  {publicUrl}
                </code>
                <button
                  onClick={handleCopy}
                  title="Copy link"
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    gap:             '0.25rem',
                    padding:         '0.375rem 0.625rem',
                    borderRadius:    '6px',
                    border:          '1px solid #D1D5DB',
                    backgroundColor: copied ? '#DCFCE7' : 'white',
                    color:           copied ? '#16A34A' : '#374151',
                    fontSize:        '0.75rem',
                    fontWeight:      600,
                    cursor:          'pointer',
                    transition:      'all 0.15s',
                    flexShrink:      0,
                  }}
                >
                  <Link2 size={12} />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open public page"
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    padding:         '0.375rem',
                    borderRadius:    '6px',
                    border:          '1px solid #D1D5DB',
                    backgroundColor: 'white',
                    color:           '#374151',
                    cursor:          'pointer',
                    flexShrink:      0,
                    textDecoration:  'none',
                  }}
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Divider + privacy breakdown ── */}
      <div style={{
        borderTop:  '1px solid #E5E7EB',
        padding:    '0.875rem 1.125rem',
      }}>
        <p style={{
          margin:          '0 0 0.75rem',
          fontSize:        '0.75rem',
          fontWeight:      700,
          color:           '#9CA3AF',
          textTransform:   'uppercase',
          letterSpacing:   '0.05em',
        }}>
          What gets shared
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {/* Shared */}
          <div>
            {SHARED_ITEMS.map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem', marginBottom: '0.375rem' }}>
                <CheckCircle2 size={12} color="#16A34A" style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', color: '#374151' }}>{item}</span>
              </div>
            ))}
          </div>

          {/* Private */}
          <div>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.72rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Always private
            </p>
            {PRIVATE_ITEMS.map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem', marginBottom: '0.325rem' }}>
                <Lock size={11} color="#9CA3AF" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
