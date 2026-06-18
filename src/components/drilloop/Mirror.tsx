import { useState } from 'react';
import { motion } from 'motion/react';
import { Users, Flame } from 'lucide-react';
import type { Drill } from '../../types/drilloop';
import { getPeerAnswers, cohortAnswerCount } from '../../data/drilloopCommunity';
import { DRILLOOP, DRILLOOP_SOFT, Pill } from './shared';

// ── Mirror — see how sharp peers reasoned on the same drill ──
// The social layer that replaces the feed: reasoning next to reasoning, fully
// anonymized, shown only AFTER the member commits their own answer so it can't
// be copied. This is the "learn from how serious people think" surface.

export default function Mirror({ drill }: { drill: Drill }) {
  const peers = getPeerAnswers(drill);
  const total = cohortAnswerCount(drill);
  const [sharped, setSharped] = useState<Set<number>>(new Set());

  const toggleSharp = (i: number) =>
    setSharped(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
        <Users size={16} color={DRILLOOP} />
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Mirror — how your cohort reasoned</h3>
      </div>
      <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: '0 0 0.875rem' }}>
        {total} members answered this. Anonymized on purpose — learn from the thinking, not the name.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {peers.map((p, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 0.875rem', borderRadius: 12, backgroundColor: '#FAFAFA', border: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, backgroundColor: DRILLOOP_SOFT, color: DRILLOOP, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>
              {p.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7280' }}>{p.role}</span>
                <Pill color={p.score >= 85 ? '#10B981' : p.score >= 70 ? DRILLOOP : '#F97316'}>{p.score}/100</Pill>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.5, margin: '0 0 0.4rem' }}>“{p.excerpt}”</p>
              <button onClick={() => toggleSharp(i)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: 0, color: sharped.has(i) ? '#F97316' : '#9CA3AF' }}>
                <Flame size={13} fill={sharped.has(i) ? '#F97316' : 'none'} /> Sharp · {p.sharp + (sharped.has(i) ? 1 : 0)}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
