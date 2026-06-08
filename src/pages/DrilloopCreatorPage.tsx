import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Sparkles, Loader2, Check, Trash2, Trophy, BarChart3, MessageSquare, Link2, Wand2, Users, Eye } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { DRILLOOP, DRILLOOP_DARK, DRILLOOP_SOFT, Pill, ProgressBar, StatTile, PageHeader, TYPE_META, DIFFICULTY_META } from '../components/drilloop/shared';
import type { DrillDraft, CreatorInsights } from '../types/drilloop';
import { CREATOR } from '../data/drilloopCreator';
import { generateDrills } from '../services/drilloopAuthoring';
import { publishDrafts, getAuthoredDrills, deleteAuthoredDrill } from '../services/drilloopCatalog';
import { computeCreatorInsights } from '../services/drilloopInsights';
import { loadState } from '../services/drilloopStore';
import { PHASE_TITLES } from '../data/drilloopDrills';

type Tab = 'author' | 'insights' | 'shoutouts';

const SAMPLE_TRANSCRIPT = `Everyone calls their feature "an AI agent" the moment it touches an LLM. But most of these are workflows: the control flow is hardcoded and the model just fills a slot. A system is only agentic to the degree the model itself decides what to do next, which tool to call, and when it's done. Autonomy is a spectrum — fixed workflow, LLM-routed workflow, tool-calling agent, autonomous loop — and the honest default is usually a workflow, because autonomy is a cost you pay in non-determinism and debugging, not a feature you get for free.`;

export default function DrilloopCreatorPage() {
  const [tab, setTab] = useState<Tab>('author');
  const insights = useMemo<CreatorInsights>(() => computeCreatorInsights(loadState()), [tab]);

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <PageHeader
          emoji="🛠️"
          title="Drilloop — Creator Studio"
          subtitle={`${CREATOR.name} · ${CREATOR.topic}`}
          right={
            <Link to="/drilloop" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 600, color: DRILLOOP, textDecoration: 'none', padding: '0.45rem 0.75rem', borderRadius: 10, backgroundColor: DRILLOOP_SOFT }}>
              <Eye size={14} /> Member view
            </Link>
          }
        />

        {/* Top-line funnel metrics */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <StatTile label="Active members" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={16} />{insights.activeMembers}</span>} />
          <StatTile label="Paid" value={insights.paidMembers} sub="subscribers" />
          <StatTile label="Avg completion" value={`${Math.round(insights.avgCompletionRate * 100)}%`} />
          <StatTile label="Avg score" value={insights.avgScore} sub="/ 100" />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid #F3F4F6', flexWrap: 'wrap' }}>
          {([['author', 'Author drills', Wand2], ['insights', 'Insights', BarChart3], ['shoutouts', 'Shoutouts', Trophy]] as [Tab, string, typeof Wand2][]).map(([t, label, Icon]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.875rem', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: tab === t ? 700 : 500, color: tab === t ? DRILLOOP : '#6B7280', borderBottom: tab === t ? `2px solid ${DRILLOOP}` : '2px solid transparent', marginBottom: -1 }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === 'author' && <AuthorTab />}
        {tab === 'insights' && <InsightsTab insights={insights} />}
        {tab === 'shoutouts' && <ShoutoutsTab insights={insights} />}
      </div>
    </DashboardLayout>
  );
}

// ── Authoring tool ──
function AuthorTab() {
  const [transcript, setTranscript] = useState('');
  const [phase, setPhase] = useState(1);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState<boolean | null>(null);
  const [drafts, setDrafts] = useState<DrillDraft[]>([]);
  const [published, setPublished] = useState(false);
  const [authored, setAuthored] = useState(() => getAuthoredDrills());

  const generate = async () => {
    setGenerating(true);
    setPublished(false);
    const { drafts, aiGenerated } = await generateDrills(transcript, 4);
    setDrafts(drafts);
    setAiGenerated(aiGenerated);
    setGenerating(false);
  };

  const updateDraft = (i: number, patch: Partial<DrillDraft>) => {
    setDrafts(ds => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };
  const removeDraft = (i: number) => setDrafts(ds => ds.filter((_, idx) => idx !== i));

  const publish = () => {
    publishDrafts(drafts, { phase, sourceUrl: sourceUrl || undefined, sourceLabel: sourceLabel || undefined, now: new Date() });
    setPublished(true);
    setDrafts([]);
    setTranscript('');
    setAuthored(getAuthoredDrills());
  };

  const remove = (id: string) => { deleteAuthoredDrill(id); setAuthored(getAuthoredDrills()); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <Wand2 size={16} color={DRILLOOP} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Turn your content into drills</h3>
        </div>
        <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: '0 0 0.875rem', lineHeight: 1.5 }}>
          Paste a post or video transcript. Claude drafts judgment drills with rubrics — you edit and publish. This is the loop’s engine: without AI-assisted authoring, drill creation is too much work.
        </p>

        <textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          rows={6}
          placeholder="Paste your LinkedIn post, Substack issue, or video transcript here…"
          style={{ width: '100%', borderRadius: 12, border: '1.5px solid #E5E7EB', padding: '0.875rem 1rem', fontSize: '0.85rem', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', outline: 'none', marginBottom: '0.6rem' }}
        />
        <button onClick={() => setTranscript(SAMPLE_TRANSCRIPT)}
          style={{ background: 'none', border: 'none', color: DRILLOOP, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: '0.875rem', fontFamily: 'inherit' }}>
          ✨ Use a sample transcript
        </button>

        {/* Content linking */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem', marginBottom: '0.875rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 600, color: '#6B7280' }}>
            Phase
            <select value={phase} onChange={e => setPhase(Number(e.target.value))}
              style={{ borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.5rem', fontSize: '0.8125rem', fontFamily: 'inherit', backgroundColor: 'white' }}>
              {Object.entries(PHASE_TITLES).map(([p, title]) => (
                <option key={p} value={p}>P{p} · {title}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 600, color: '#6B7280' }}>
            Source label <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(content linking)</span>
            <input value={sourceLabel} onChange={e => setSourceLabel(e.target.value)} placeholder="e.g. LinkedIn post"
              style={{ borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.5rem 0.65rem', fontSize: '0.8125rem', fontFamily: 'inherit' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 600, color: '#6B7280' }}>
            Source URL
            <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://…"
              style={{ borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.5rem 0.65rem', fontSize: '0.8125rem', fontFamily: 'inherit' }} />
          </label>
        </div>

        <Button onClick={generate} disabled={transcript.trim().length < 40 || generating}
          style={{ backgroundColor: DRILLOOP, boxShadow: '0 2px 8px rgba(13,148,136,0.3)' }}>
          {generating ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Drafting drills…</> : <><Sparkles size={15} /> Draft drills with AI</>}
        </Button>
      </Card>

      {published && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', fontWeight: 600, color: '#10B981', backgroundColor: '#10B98110', padding: '0.6rem 0.875rem', borderRadius: 10 }}>
          <Check size={15} /> Published to the program — members can drill it now.
        </div>
      )}

      {/* Draft editor */}
      {drafts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>
              {drafts.length} draft drills — edit, then publish
            </h3>
            <Pill color={aiGenerated ? DRILLOOP : '#9CA3AF'}>{aiGenerated ? '✦ AI-drafted' : 'Offline template'}</Pill>
          </div>
          {drafts.map((d, i) => (
            <Card key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <input value={d.title} onChange={e => updateDraft(i, { title: e.target.value })}
                  style={{ flex: 1, fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', border: 'none', outline: 'none', borderBottom: '1px dashed #E5E7EB', paddingBottom: '0.25rem', fontFamily: 'inherit' }} />
                <button onClick={() => removeDraft(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 4 }}><Trash2 size={15} /></button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                <select value={d.type} onChange={e => updateDraft(i, { type: e.target.value as DrillDraft['type'] })}
                  style={{ borderRadius: 8, border: '1px solid #E5E7EB', padding: '0.3rem 0.5rem', fontSize: '0.72rem', fontFamily: 'inherit' }}>
                  {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
                <select value={d.difficulty} onChange={e => updateDraft(i, { difficulty: e.target.value as DrillDraft['difficulty'] })}
                  style={{ borderRadius: 8, border: '1px solid #E5E7EB', padding: '0.3rem 0.5rem', fontSize: '0.72rem', fontFamily: 'inherit' }}>
                  {Object.entries(DIFFICULTY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <textarea value={d.prompt} onChange={e => updateDraft(i, { prompt: e.target.value })} rows={3}
                style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.6rem 0.75rem', fontSize: '0.82rem', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', marginBottom: '0.6rem' }} />
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>Rubric</div>
              <textarea
                value={d.keyPoints.join('\n')}
                onChange={e => updateDraft(i, { keyPoints: e.target.value.split('\n').filter(Boolean) })}
                rows={Math.max(3, d.keyPoints.length)}
                style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.6rem 0.75rem', fontSize: '0.8rem', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', marginBottom: '0.6rem' }} />
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>Reference answer</div>
              <textarea value={d.modelAnswer} onChange={e => updateDraft(i, { modelAnswer: e.target.value })} rows={3}
                style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.6rem 0.75rem', fontSize: '0.8rem', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' }} />
            </Card>
          ))}
          <Button fullWidth onClick={publish} style={{ backgroundColor: DRILLOOP, boxShadow: '0 2px 8px rgba(13,148,136,0.3)' }}>
            <Check size={16} /> Publish {drafts.length} drill{drafts.length > 1 ? 's' : ''} to the program
          </Button>
        </div>
      )}

      {/* Already-published authored drills */}
      {authored.length > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Link2 size={15} color={DRILLOOP} />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Your published drills ({authored.length})</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {authored.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem', borderRadius: 10, backgroundColor: '#FAFAFA' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1F2937' }}>{d.title}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>
                    P{d.phase} · {DIFFICULTY_META[d.difficulty].label}{d.sourceLabel ? ` · 🔗 ${d.sourceLabel}` : ''}
                  </div>
                </div>
                <button onClick={() => remove(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 4 }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Insight dashboard ──
function InsightsTab({ insights }: { insights: CreatorInsights }) {
  const sorted = [...insights.drillInsights].sort((a, b) => b.struggleRate - a.struggleRate);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <BarChart3 size={16} color={DRILLOOP} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Where your audience struggles</h3>
        </div>
        <p style={{ fontSize: '0.78rem', color: '#9CA3AF', margin: '0 0 1rem' }}>Sorted by struggle rate — the drills to re-teach or rewrite are at the top.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {sorted.slice(0, 12).map(d => (
            <div key={d.drillId}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>P{d.phase} · {d.title}</span>
                <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{d.attempts} attempts · avg {d.avgScore} · {Math.round(d.struggleRate * 100)}% struggled</span>
              </div>
              <ProgressBar value={d.avgScore} color={d.avgScore >= 70 ? '#10B981' : d.avgScore >= 50 ? DRILLOOP : '#F97316'} />
              {d.commonGaps.length > 0 && (
                <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.68rem', color: '#9CA3AF', fontWeight: 600 }}>Common gaps:</span>
                  {d.commonGaps.map((g, i) => <Pill key={i} color="#F97316">{g}</Pill>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <MessageSquare size={16} color={DRILLOOP} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Member feedback</h3>
        </div>
        {insights.recentFeedback.length === 0 ? (
          <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>No feedback yet. As members rate drills “useful / confusing”, their notes route here.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {insights.recentFeedback.map(f => (
              <div key={f.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.6rem 0.75rem', borderRadius: 10, backgroundColor: '#FAFAFA' }}>
                <Pill color={f.tag === 'useful' ? '#10B981' : f.tag === 'confusing' ? '#F97316' : '#6B7280'}>{f.tag}</Pill>
                <div style={{ flex: 1, fontSize: '0.8rem', color: '#374151' }}>{f.note || <span style={{ color: '#9CA3AF' }}>(no note)</span>}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Shoutouts / leaderboard ──
function ShoutoutsTab({ insights }: { insights: CreatorInsights }) {
  const top = insights.leaderboard;
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Card style={{ background: `linear-gradient(135deg, ${DRILLOOP}, ${DRILLOOP_DARK})`, border: 'none', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
          <Trophy size={18} /> <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Top learners this week</h3>
        </div>
        <p style={{ fontSize: '0.78rem', opacity: 0.9, margin: 0 }}>Screenshot this for your community — recognition is the membership’s status reward.</p>
      </Card>

      <Card style={{ padding: '0.5rem' }}>
        {top.map((row, i) => (
          <motion.div key={row.name + i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.7rem 0.875rem', borderRadius: 12, backgroundColor: row.isYou ? DRILLOOP_SOFT : 'transparent', border: row.isYou ? `1px solid ${DRILLOOP}33` : '1px solid transparent' }}>
            <div style={{ width: 28, textAlign: 'center', fontSize: i < 3 ? '1.2rem' : '0.85rem', fontWeight: 700, color: '#6B7280' }}>{medal(i)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1F2937' }}>
                {row.name}{row.isYou && <span style={{ fontSize: '0.68rem', color: DRILLOOP, fontWeight: 600, marginLeft: 6 }}>(you)</span>}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>{row.drillsCompleted} drills · {Math.round(row.masteryRate * 100)}% mastery</div>
            </div>
            <Pill color="#F97316">🔥 {row.streak}d</Pill>
          </motion.div>
        ))}
      </Card>

      <p style={{ fontSize: '0.7rem', color: '#9CA3AF', textAlign: 'center', margin: 0 }}>
        In production this auto-posts a weekly shoutout to the member space and emails the winners.
      </p>
    </div>
  );
}
