import { useEffect, useState, useCallback } from 'react';
import { Users, Check, X, Clock, Sparkles, Mail, AlertCircle, Loader2 } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import { DRILLOOP, DRILLOOP_DARK, DRILLOOP_SOFT, Pill } from './shared';
import {
  getMatches, respondToMatch, getMyProfile, setMatchingOptIn,
  type MatchAction,
} from '../../services/drilloop/repo';
import type { MatchView, Connection, MemberProfile } from '../../types/connect';

const MATCH_TYPE_LABEL: Record<string, string> = {
  knowledge_complement: 'Complementary strengths',
  goal_aligned: 'Aligned goals',
  mixed: 'Strengths + goals',
};

// ── Connect tab ──
// The connection product's member surface: suggested 1:1s with rationale and
// accept/decline/snooze, mutual-accept contact reveal, matching opt-out control,
// and a history of tracked connections. Wired to the real backend via repo.ts.

export default function ConnectView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ matches, connections }, prof] = await Promise.all([getMatches(), getMyProfile()]);
      setMatches(matches);
      setConnections(connections);
      setProfile(prof);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your connections.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const respond = async (m: MatchView, action: MatchAction) => {
    setBusyId(m.match.id);
    setError(null);
    try {
      const updated = await respondToMatch(m.match.id, action);
      setMatches(prev => prev.map(x => (x.match.id === updated.match.id ? updated : x)));
      if (updated.match.status === 'accepted') await load(); // surface the new connection
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update that match.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleOptIn = async () => {
    if (!profile) return;
    const next = !profile.matchingOptIn;
    setProfile({ ...profile, matchingOptIn: next });
    try { await setMatchingOptIn(next); } catch { void load(); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6B7280', fontSize: '0.85rem', padding: '2rem' }}>
        <Loader2 size={16} className="spin" /> Loading your connections…
      </div>
    );
  }

  const open = matches.filter(m => m.viewerStatus === 'suggested' || (m.viewerStatus === 'accepted' && m.match.status !== 'accepted'));
  const optedOut = profile && !profile.matchingOptIn;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#B91C1C', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '0.6rem 0.875rem' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Matching pool control (opt-out default) */}
      <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Users size={18} color={DRILLOOP} />
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F2937' }}>Connection suggestions</div>
            <div style={{ fontSize: '0.76rem', color: '#6B7280' }}>
              {optedOut ? "You're not in the matching pool — you won't be suggested to others." : "You're in the matching pool. We suggest people worth meeting based on your drills + profile."}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={toggleOptIn} style={{ borderColor: '#E5E7EB', color: optedOut ? DRILLOOP : '#6B7280' }}>
          {optedOut ? 'Join the pool' : 'Leave the pool'}
        </Button>
      </Card>

      {/* Open suggestions */}
      {!optedOut && open.length === 0 && (
        <Card style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '1.75rem' }}>🤝</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1F2937', margin: '0.5rem 0 0.25rem' }}>No suggestions right now</h3>
          <p style={{ fontSize: '0.82rem', color: '#6B7280', margin: 0 }}>
            Answer more profile drills in Today to sharpen your matches. New suggestions appear after each matching run.
          </p>
        </Card>
      )}

      {open.map(m => (
        <MatchCard key={m.match.id} view={m} busy={busyId === m.match.id} onRespond={respond} />
      ))}

      {/* History */}
      <ConnectionHistory matches={matches} connections={connections} />
    </div>
  );
}

function MatchCard({ view, busy, onRespond }: { view: MatchView; busy: boolean; onRespond: (m: MatchView, a: MatchAction) => void }) {
  const { match, counterpart, viewerStatus } = view;
  const waitingOnOther = viewerStatus === 'accepted' && match.status !== 'accepted';
  const name = counterpart.displayName ?? 'A member';

  return (
    <Card style={{ borderLeft: `4px solid ${DRILLOOP}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: DRILLOOP_SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: DRILLOOP_DARK }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937' }}>{name}</div>
            {match.confidence != null && <div style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>{Math.round(match.confidence * 100)}% match</div>}
          </div>
        </div>
        <Pill>{MATCH_TYPE_LABEL[match.matchType] ?? 'Worth meeting'}</Pill>
      </div>

      <p style={{ fontSize: '0.86rem', color: '#374151', lineHeight: 1.55, margin: '0 0 0.75rem' }}>{match.rationale}</p>

      {counterpart.goals.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {counterpart.goals.map((g, i) => (
            <span key={i} style={{ fontSize: '0.72rem', color: DRILLOOP_DARK, backgroundColor: DRILLOOP_SOFT, padding: '0.25rem 0.55rem', borderRadius: 8 }}>{g}</span>
          ))}
        </div>
      )}

      {waitingOnOther ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: DRILLOOP_DARK, fontWeight: 600 }}>
          <Check size={15} /> You accepted — waiting for {name} to accept too.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button onClick={() => onRespond(view, 'accept')} disabled={busy} style={{ backgroundColor: DRILLOOP }}>
            <Check size={15} /> Accept
          </Button>
          <Button variant="outline" onClick={() => onRespond(view, 'snooze')} disabled={busy} style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>
            <Clock size={14} /> Snooze
          </Button>
          <Button variant="outline" onClick={() => onRespond(view, 'decline')} disabled={busy} style={{ borderColor: '#E5E7EB', color: '#9CA3AF' }}>
            <X size={14} /> Pass
          </Button>
        </div>
      )}
    </Card>
  );
}

function ConnectionHistory({ matches, connections }: { matches: MatchView[]; connections: Connection[] }) {
  const connectedViews = matches.filter(m => m.match.status === 'accepted');
  const past = matches.filter(m => m.viewerStatus === 'declined' || m.match.status === 'declined' || m.match.status === 'expired');

  if (connections.length === 0 && connectedViews.length === 0 && past.length === 0) return null;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
        <Sparkles size={16} color={DRILLOOP} />
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Your connections</h3>
      </div>

      {connectedViews.length === 0 && <p style={{ fontSize: '0.8rem', color: '#9CA3AF', margin: '0 0 0.5rem' }}>No mutual connections yet — accept a suggestion to start one.</p>}

      {connectedViews.map(m => (
        <div key={m.match.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.6rem 0', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1F2937' }}>{m.counterpart.displayName ?? 'A member'}</div>
          {m.counterpart.contact ? (
            <a href={`mailto:${m.counterpart.contact}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem', fontWeight: 600, color: DRILLOOP, textDecoration: 'none' }}>
              <Mail size={13} /> {m.counterpart.contact}
            </a>
          ) : (
            <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>Connected</span>
          )}
        </div>
      ))}

      {past.length > 0 && (
        <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '0.75rem' }}>
          {past.length} past suggestion{past.length === 1 ? '' : 's'} declined or expired.
        </div>
      )}
    </Card>
  );
}
