import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Lock, Flame, Target, TrendingUp, Award, Check, ArrowLeft, Sparkles, Wrench } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import DrillPlayer from '../components/drilloop/DrillPlayer';
import { DRILLOOP, DRILLOOP_DARK, DRILLOOP_SOFT, Pill, ProgressBar, StatTile, PageHeader, DIFFICULTY_META } from '../components/drilloop/shared';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import type { Drill, DrillGrade, SelfRating, FeedbackTag, DrilloopState } from '../types/drilloop';
import { CREATOR } from '../data/drilloopCreator';
import { getCatalog } from '../services/drilloopCatalog';
import {
  loadState, saveState, recordAttempt, recordFeedback, upgradeToMember, dayKey,
  computeMetrics,
} from '../services/drilloopStore';

type View = 'today' | 'program' | 'progress';

function unlocked(state: DrilloopState, drill: Drill): boolean {
  return state.tier === 'member' || !!drill.isSample;
}

export default function DrilloopMemberPage() {
  const [state, setState] = useState<DrilloopState>(() => loadState());
  const [view, setView] = useState<View>('today');
  const [activeDrill, setActiveDrill] = useState<Drill | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const catalog = useMemo(() => getCatalog(), []);
  const metrics = useMemo(() => computeMetrics(state), [state]);
  const completedIds = useMemo(() => new Set(state.attempts.map(a => a.drillId)), [state.attempts]);

  const nextDrill = catalog.find(d => !completedIds.has(d.id)) ?? null;
  const isMember = state.tier === 'member';

  const persist = (next: DrilloopState) => { saveState(next); setState(next); };

  const startDrill = (drill: Drill) => {
    if (!unlocked(state, drill)) { setShowPaywall(true); return; }
    setActiveDrill(drill);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleComplete = (drill: Drill, r: { answer: string; grade: DrillGrade; selfRating: SelfRating }) => {
    const now = new Date();
    persist(recordAttempt(state, {
      drillId: drill.id,
      phase: drill.phase,
      completedAt: now.toISOString(),
      day: dayKey(now),
      answer: r.answer,
      selfRating: r.selfRating,
      aiScore: r.grade.score,
      aiFeedback: r.grade.feedback,
      grade: r.grade,
    }, now));
  };

  const handleFeedback = (drill: Drill, tag: FeedbackTag, note: string) => {
    persist(recordFeedback(state, drill.id, tag, note, new Date()));
  };

  const upgrade = () => {
    persist(upgradeToMember(state, new Date()));
    setShowPaywall(false);
  };

  // ── Active drill player view ──
  if (activeDrill) {
    return (
      <DashboardLayout>
        <button onClick={() => setActiveDrill(null)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: 'none', color: '#6B7280', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', marginBottom: '1.25rem', fontFamily: 'inherit', padding: 0 }}>
          <ArrowLeft size={15} /> Back
        </button>
        <DrillPlayer
          key={activeDrill.id}
          drill={activeDrill}
          nextLabel={nextDrill && nextDrill.id !== activeDrill.id ? 'Next drill →' : 'Back to dashboard'}
          onComplete={r => handleComplete(activeDrill, r)}
          onFeedback={(tag, note) => handleFeedback(activeDrill, tag, note)}
          onNext={() => {
            const after = getCatalog().find(d => d.id !== activeDrill.id && !new Set([...completedIds, activeDrill.id]).has(d.id));
            if (after && unlocked(state, after)) setActiveDrill(after);
            else { setActiveDrill(null); setView('progress'); }
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <PageHeader
          emoji="🔁"
          title="Drilloop"
          subtitle={`${CREATOR.topic} · with ${CREATOR.name}`}
          right={
            <Link to="/drilloop/creator" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 600, color: DRILLOOP, textDecoration: 'none', padding: '0.45rem 0.75rem', borderRadius: 10, backgroundColor: DRILLOOP_SOFT }}>
              <Wrench size={14} /> Creator view
            </Link>
          }
        />

        {/* Membership status banner */}
        {isMember ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', fontWeight: 600, color: DRILLOOP_DARK, backgroundColor: DRILLOOP_SOFT, padding: '0.55rem 0.875rem', borderRadius: 10, alignSelf: 'flex-start' }}>
            <Sparkles size={14} /> Member — full program unlocked
          </div>
        ) : (
          <CreatorLanding onJoin={() => setShowPaywall(true)} />
        )}

        {/* Sub-nav */}
        <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid #F3F4F6', paddingBottom: '0.1rem' }}>
          {([['today', 'Today'], ['program', 'Program'], ['progress', 'Progress']] as [View, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '0.55rem 0.875rem', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: view === v ? 700 : 500, color: view === v ? DRILLOOP : '#6B7280', borderBottom: view === v ? `2px solid ${DRILLOOP}` : '2px solid transparent', marginBottom: -1 }}>
              {label}
            </button>
          ))}
        </div>

        {view === 'today' && <TodayView nextDrill={nextDrill} metrics={metrics} state={state} onStart={startDrill} />}
        {view === 'program' && <ProgramView catalog={catalog} completedIds={completedIds} state={state} onStart={startDrill} />}
        {view === 'progress' && <ProgressView state={state} metrics={metrics} />}
      </div>

      {showPaywall && <Paywall onClose={() => setShowPaywall(false)} onUpgrade={upgrade} />}
    </DashboardLayout>
  );
}

// ── Creator landing (the conversion surface) ──
function CreatorLanding({ onJoin }: { onJoin: () => void }) {
  return (
    <Card style={{ background: `linear-gradient(135deg, ${DRILLOOP}, ${DRILLOOP_DARK})`, border: 'none', color: 'white', padding: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>{CREATOR.avatar}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{CREATOR.name}</div>
          <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>{CREATOR.handle} · {CREATOR.topic}</div>
        </div>
      </div>
      <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem', lineHeight: 1.25, letterSpacing: '-0.01em' }}>{CREATOR.tagline}</h2>
      <p style={{ fontSize: '0.9rem', lineHeight: 1.55, opacity: 0.92, margin: '0 0 1.125rem', maxWidth: 560 }}>{CREATOR.bio}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
        <button onClick={onJoin}
          style={{ backgroundColor: 'white', color: DRILLOOP_DARK, border: 'none', borderRadius: 12, padding: '0.7rem 1.4rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}>
          Start membership — ${CREATOR.tiers[1].price}/mo
        </button>
        <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>Or try the free sample drills below ↓</span>
      </div>
    </Card>
  );
}

// ── Today view ──
function TodayView({ nextDrill, metrics, state, onStart }: { nextDrill: Drill | null; metrics: ReturnType<typeof computeMetrics>; state: DrilloopState; onStart: (d: Drill) => void }) {
  const locked = nextDrill ? !unlocked(state, nextDrill) : false;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <StatTile label="Day streak" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Flame size={18} color="#F97316" />{metrics.currentStreak}</span>} color="#F97316" />
        <StatTile label="Drills done" value={`${metrics.completedDrills}/${metrics.totalDrills}`} />
        <StatTile label="Nailed cold" value={`${Math.round(metrics.masteryRate * 100)}%`} sub="self-rated" />
      </div>

      {nextDrill ? (
        <Card hover style={{ borderLeft: `4px solid ${DRILLOOP}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Pill>{locked ? <><Lock size={11} /> Members only</> : "Today’s drill"}</Pill>
            <Pill color={DIFFICULTY_META[nextDrill.difficulty].color}>{DIFFICULTY_META[nextDrill.difficulty].label}</Pill>
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1F2937', margin: '0.25rem 0 0.4rem' }}>{nextDrill.title}</h3>
          <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: '0 0 1rem', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{nextDrill.prompt}</p>
          <Button onClick={() => onStart(nextDrill)} style={{ backgroundColor: locked ? '#9CA3AF' : DRILLOOP, boxShadow: locked ? 'none' : '0 2px 8px rgba(13,148,136,0.3)' }}>
            {locked ? <><Lock size={14} /> Unlock to drill</> : <><Target size={15} /> Start drill</>}
          </Button>
        </Card>
      ) : (
        <Card style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem' }}>🏆</div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1F2937', margin: '0.5rem 0' }}>You’ve cleared every drill.</h3>
          <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: 0 }}>Re-drill any from the Program tab to keep the judgment sharp — repetition is the point.</p>
        </Card>
      )}

      {state.shoutouts.length > 0 && <ShoutoutStrip state={state} />}
    </div>
  );
}

// ── Program view (full catalog, grouped by phase) ──
function ProgramView({ catalog, completedIds, state, onStart }: { catalog: Drill[]; completedIds: Set<string>; state: DrilloopState; onStart: (d: Drill) => void }) {
  const phases = [...new Set(catalog.map(d => d.phase))].sort((a, b) => a - b);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {phases.map(phase => {
        const drills = catalog.filter(d => d.phase === phase);
        return (
          <div key={phase}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
              Phase {phase} · {drills[0].phaseTitle}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {drills.map(d => {
                const done = completedIds.has(d.id);
                const locked = !unlocked(state, d);
                return (
                  <button key={d.id} onClick={() => onStart(d)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left', width: '100%', padding: '0.875rem 1rem', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: done ? '#10B98115' : locked ? '#F3F4F6' : DRILLOOP_SOFT }}>
                      {done ? <Check size={15} color="#10B981" /> : locked ? <Lock size={13} color="#9CA3AF" /> : <Target size={14} color={DRILLOOP} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: locked ? '#9CA3AF' : '#1F2937' }}>{d.title}</div>
                      <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: 1 }}>
                        {DIFFICULTY_META[d.difficulty].label}{d.isSample ? ' · free sample' : ''}{d.authored ? ' · creator drill' : ''}
                      </div>
                    </div>
                    {done && <Pill color="#10B981">Done</Pill>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Progress view ──
function ProgressView({ state, metrics }: { state: DrilloopState; metrics: ReturnType<typeof computeMetrics> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <StatTile label="Completion" value={`${Math.round(metrics.completionRate * 100)}%`} />
        <StatTile label="Longest streak" value={metrics.longestStreak} sub="days" color="#F97316" />
        <StatTile label="Days active" value={metrics.daysActive} />
        <StatTile label="Improvement" value={`${metrics.improvement >= 0 ? '+' : ''}${metrics.improvement}`} sub="2nd half vs 1st" color={metrics.improvement >= 0 ? '#10B981' : '#DC2626'} />
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <TrendingUp size={16} color={DRILLOOP} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Strength by phase</h3>
        </div>
        {metrics.phaseProgress.filter(p => p.total > 0).map(p => (
          <div key={p.phase} style={{ marginBottom: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
              <span style={{ color: '#374151', fontWeight: 500 }}>P{p.phase} · {p.phaseTitle}</span>
              <span style={{ color: '#9CA3AF' }}>{p.completed}/{p.total} · {p.mastery || 0}%</span>
            </div>
            <ProgressBar value={p.total ? (p.completed / p.total) * 100 : 0} color={p.mastery >= 70 ? '#10B981' : p.mastery >= 40 ? DRILLOOP : '#F97316'} />
          </div>
        ))}
        {metrics.completedDrills === 0 && <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>Complete a drill to see your strength map build.</p>}
      </Card>

      <ShoutoutStrip state={state} />
    </div>
  );
}

function ShoutoutStrip({ state }: { state: DrilloopState }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
        <Award size={16} color={DRILLOOP} />
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Your shoutouts</h3>
      </div>
      {state.shoutouts.length === 0 ? (
        <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>Earn recognition by drilling — first rep, streaks, phase mastery and more.</p>
      ) : (
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {state.shoutouts.map(s => (
            <motion.div key={s.id} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 12, backgroundColor: DRILLOOP_SOFT, border: `1px solid ${DRILLOOP}22` }}>
              <span style={{ fontSize: '1.1rem' }}>{s.emoji}</span>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1F2937' }}>{s.label}</div>
                <div style={{ fontSize: '0.68rem', color: '#6B7280' }}>{s.detail}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Paywall (Stripe Checkout stand-in) ──
function Paywall({ onClose, onUpgrade }: { onClose: () => void; onUpgrade: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(17,24,39,0.55)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()}
        style={{ backgroundColor: 'white', borderRadius: 20, maxWidth: 760, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '1.75rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1F2937', margin: '0 0 0.3rem' }}>Join the learning loop</h2>
        <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: '0 0 1.25rem' }}>{CREATOR.proof} Cancel anytime.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.875rem' }}>
          {CREATOR.tiers.map(t => (
            <div key={t.id} style={{ borderRadius: 16, padding: '1.125rem', border: t.highlighted ? `2px solid ${DRILLOOP}` : '1px solid #E5E7EB', backgroundColor: t.highlighted ? DRILLOOP_SOFT : 'white', position: 'relative' }}>
              {t.highlighted && <div style={{ position: 'absolute', top: -10, right: 14, backgroundColor: DRILLOOP, color: 'white', fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Popular</div>}
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F2937' }}>{t.name}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: t.highlighted ? DRILLOOP_DARK : '#1F2937', margin: '0.2rem 0' }}>
                ${t.price}<span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#9CA3AF' }}>/mo</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#6B7280', marginBottom: '0.75rem' }}>{t.blurb}</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                {t.features.map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.75rem', color: '#374151', lineHeight: 1.4 }}>
                    <Check size={13} color={DRILLOOP} style={{ flexShrink: 0, marginTop: 2 }} /> {f}
                  </li>
                ))}
              </ul>
              {t.price === 0 ? (
                <Button variant="outline" fullWidth onClick={onClose} style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>Keep sampling</Button>
              ) : (
                <Button fullWidth onClick={onUpgrade} style={{ backgroundColor: t.highlighted ? DRILLOOP : '#374151', boxShadow: 'none' }}>
                  Subscribe
                </Button>
              )}
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.68rem', color: '#9CA3AF', textAlign: 'center', margin: '1rem 0 0' }}>
          Demo checkout — in production this opens Stripe Checkout; a webhook flips your membership to active.
        </p>
      </motion.div>
    </div>
  );
}
