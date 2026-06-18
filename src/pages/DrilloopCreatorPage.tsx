import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import {
  Sparkles, Loader2, Check, Trash2, Trophy, BarChart3, MessageSquare, Wand2,
  Users, Eye, Network, Play, AlertCircle, FileText, Pencil, Lock, Unlock, Share2,
  Copy, MapPin, Calendar, Megaphone, Plus, X, ClipboardList, Search, Beaker, Layers, Lightbulb, ArrowLeft, Target,
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { DRILLOOP, DRILLOOP_DARK, DRILLOOP_SOFT, Pill, ProgressBar, StatTile, PageHeader, TYPE_META, DIFFICULTY_META } from '../components/drilloop/shared';
import type { DrillDraft, DrillTier, CreatorInsights } from '../types/drilloop';
import { CREATOR } from '../data/drilloopCreator';
import {
  generateDrills, developFromNotes, researchAndEnhancePost, iteratePost, iterateDrill, suggestNextPost,
  type NotesDevelopment, type NextPostSuggestion,
} from '../services/drilloopAuthoring';
import {
  publishDrafts, getAuthoredDrills, deleteAuthoredDrill, updateAuthoredDrill, setDrillTier, tierOf,
} from '../services/drilloopCatalog';
import { computeCreatorInsights } from '../services/drilloopInsights';
import { loadState } from '../services/drilloopStore';
import { getPhases, createPhase, deletePhase, type Phase } from '../services/drilloopPhases';
import { COLLECTIVE } from '../data/drilloopCommunity';
import {
  getShareConfig, saveShareConfig, buildInviteLink, getGatherings, createGathering,
  cancelGathering, gatheringAnnouncement, type Gathering,
} from '../services/drilloopCreatorStore';
import {
  getCalendarPosts, addCalendarPost, updateCalendarPost, deleteCalendarPost,
  setAuthorSeed, consumeAuthorSeed, type CalendarPost,
} from '../services/drilloopCalendar';
import { getCommunityRoster, summarize, type CommunityMember } from '../services/drilloopCommunityService';
import { getDrillRequests, type DrillRequest } from '../services/drilloopRequests';
import {
  getNetworkInsights, getMatchingRuns, triggerMatchingRun,
  type NetworkInsights,
} from '../services/drilloop/creatorRepo';
import type { MatchingRun } from '../types/connect';

type Tab = 'author' | 'calendar' | 'manage' | 'community' | 'grow' | 'insights' | 'connections' | 'shoutouts';

const TABS: [Tab, string, typeof Wand2][] = [
  ['author', 'Author', Wand2],
  ['calendar', 'Content calendar', Calendar],
  ['manage', 'Manage drills', ClipboardList],
  ['community', 'Community', Users],
  ['grow', 'Grow', Share2],
  ['insights', 'Insights', BarChart3],
  ['connections', 'Connections', Network],
  ['shoutouts', 'Shoutouts', Trophy],
];

const TAB_IDS: Tab[] = ['author', 'calendar', 'manage', 'community', 'grow', 'insights', 'connections', 'shoutouts'];

export default function DrilloopCreatorPage() {
  const [searchParams] = useSearchParams();
  const initialTab = (() => {
    const t = searchParams.get('tab');
    return t && (TAB_IDS as string[]).includes(t) ? (t as Tab) : 'author';
  })();
  const [tab, setTab] = useState<Tab>(initialTab);
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

        <CollectiveBanner />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid #F3F4F6', flexWrap: 'wrap' }}>
          {TABS.map(([t, label, Icon]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.875rem', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: tab === t ? 700 : 500, color: tab === t ? DRILLOOP : '#6B7280', borderBottom: tab === t ? `2px solid ${DRILLOOP}` : '2px solid transparent', marginBottom: -1 }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === 'author' && <AuthorTab />}
        {tab === 'calendar' && <CalendarTab onUseInAuthor={() => setTab('author')} />}
        {tab === 'manage' && <ManageTab />}
        {tab === 'community' && <CommunityTab />}
        {tab === 'grow' && <GrowTab insights={insights} />}
        {tab === 'insights' && <InsightsTab insights={insights} />}
        {tab === 'connections' && <ConnectionsTab />}
        {tab === 'shoutouts' && <ShoutoutsTab insights={insights} />}
      </div>
    </DashboardLayout>
  );
}

// ── Reusable copy-to-clipboard button ──
function CopyButton({ text, label = 'Copy', onCopied }: { text: string; label?: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <Button variant="outline" onClick={copy} style={{ borderColor: copied ? '#10B981' : '#E5E7EB', color: copied ? '#10B981' : DRILLOOP }}>
      {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> {label}</>}
    </Button>
  );
}

function TierPill({ tier }: { tier: DrillTier }) {
  return tier === 'free'
    ? <Pill color="#10B981"><Unlock size={11} /> Free</Pill>
    : <Pill color={DRILLOOP_DARK}><Lock size={11} /> Members</Pill>;
}

// ── Expert Collective — the strategic, multi-expert offering ──
function CollectiveBanner() {
  return (
    <Card style={{ borderLeft: `4px solid ${DRILLOOP}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <Users size={16} color={DRILLOOP} />
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>{COLLECTIVE.name}</h3>
            <Pill color={DRILLOOP}>Collective</Pill>
          </div>
          <p style={{ fontSize: '0.76rem', color: '#6B7280', margin: 0, lineHeight: 1.5, maxWidth: 560 }}>{COLLECTIVE.blurb}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {COLLECTIVE.experts.map((e, i) => (
            <span key={e.name} title={`${e.name} · ${e.specialty} · ${e.followers}`}
              style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: DRILLOOP_SOFT, border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem', marginLeft: i === 0 ? 0 : -10, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              {e.avatar}
            </span>
          ))}
          <Button variant="outline" onClick={() => {}} style={{ borderColor: '#E5E7EB', color: DRILLOOP, marginLeft: '0.75rem' }}>+ Invite expert</Button>
        </div>
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// AUTHOR — develop content from rough notes OR drills from finished content,
// then edit and publish to a tier. (Customer needs #2 + #3.)
// ════════════════════════════════════════════════════════════════════════════

const SAMPLE_NOTES = `rough thoughts: people slap "agent" on anything with an LLM. but most are just workflows — fixed control flow, model fills a slot. real autonomy = model decides next step / which tool / when done. autonomy is a spectrum. it's a cost (non-determinism, debugging) not a free feature. default should usually be a workflow.`;

type Mode = 'notes' | 'content';

function AuthorTab() {
  const [mode, setMode] = useState<Mode>('notes');
  const [input, setInput] = useState('');

  // Pick up a "draft this in Author" seed from the content calendar suggestion.
  useEffect(() => {
    const seed = consumeAuthorSeed();
    if (seed) { setMode('notes'); setInput(seed); }
  }, []);

  const [phase, setPhase] = useState(1);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [defaultTier, setDefaultTier] = useState<DrillTier>('member');
  const [generating, setGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState<boolean | null>(null);
  const [developed, setDeveloped] = useState<NotesDevelopment | null>(null);
  const [post, setPost] = useState('');
  const [drafts, setDrafts] = useState<DrillDraft[]>([]);
  const [published, setPublished] = useState<number | null>(null);
  const [researching, setResearching] = useState(false);
  const [enhancement, setEnhancement] = useState<{ additions: string[]; aiGenerated: boolean } | null>(null);
  const [instruction, setInstruction] = useState('');
  const [iterating, setIterating] = useState(false);
  const [iterateFailed, setIterateFailed] = useState(false);

  const iterate = async () => {
    if (!instruction.trim() || !post) return;
    setIterating(true);
    setIterateFailed(false);
    const res = await iteratePost(post, instruction);
    setPost(res.post);
    if (res.aiGenerated) setInstruction('');
    else setIterateFailed(true);
    setIterating(false);
  };

  const QUICK_EDITS = ['Make the hook punchier', 'Shorten to ~150 words', 'Add bullet points', 'Add a clear call-to-action', 'More conversational tone'];

  const doResearch = async () => {
    if (!developed) return;
    setResearching(true);
    setEnhancement(null);
    const res = await researchAndEnhancePost(post, developed.research);
    setPost(res.post);
    setEnhancement({ additions: res.additions, aiGenerated: res.aiGenerated });
    setResearching(false);
  };

  const run = async () => {
    setGenerating(true);
    setPublished(null);
    setEnhancement(null);
    if (mode === 'notes') {
      const dev = await developFromNotes(input, 3);
      setDeveloped(dev);
      setPost(dev.post);
      setDrafts(dev.drills.map(d => ({ ...d, tier: defaultTier })));
      setAiGenerated(dev.aiGenerated);
    } else {
      const { drafts: ds, aiGenerated: ai } = await generateDrills(input, 4);
      setDeveloped(null);
      setPost('');
      setDrafts(ds.map(d => ({ ...d, tier: defaultTier })));
      setAiGenerated(ai);
    }
    setGenerating(false);
  };

  const updateDraft = (i: number, patch: Partial<DrillDraft>) =>
    setDrafts(ds => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const removeDraft = (i: number) => setDrafts(ds => ds.filter((_, idx) => idx !== i));

  const publish = () => {
    const now = new Date();
    const created = publishDrafts(drafts, {
      phase, sourceUrl: sourceUrl || undefined, sourceLabel: sourceLabel || undefined,
      now, defaultTier,
    });
    // Approving drills from a developed post sends that post to the content calendar.
    if (developed && post.trim()) {
      addCalendarPost(
        { title: developed.postTitle, post, research: developed.research, drillsCount: created.length },
        now,
      );
    }
    setPublished(created.length);
    setDrafts([]);
    setDeveloped(null);
    setPost('');
    setInput('');
  };

  const minLen = mode === 'notes' ? 20 : 40;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Card>
        {/* Mode switch */}
        <div style={{ display: 'inline-flex', gap: '0.25rem', backgroundColor: '#F3F4F6', borderRadius: 10, padding: '0.2rem', marginBottom: '0.875rem' }}>
          {([['notes', 'From rough notes', FileText], ['content', 'From finished content', Wand2]] as [Mode, string, typeof FileText][]).map(([m, label, Icon]) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.7rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600, backgroundColor: mode === m ? 'white' : 'transparent', color: mode === m ? DRILLOOP : '#6B7280', boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: '0 0 0.875rem', lineHeight: 1.5 }}>
          {mode === 'notes'
            ? 'Paste rough, messy notes. Claude develops a publish-ready post, drafts drills from it, and tells you what to research next to go deeper.'
            : 'Paste a finished post or transcript. Claude drafts judgment drills with rubrics — you edit and publish.'}
        </p>

        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={6}
          placeholder={mode === 'notes' ? 'Brain-dump your rough thoughts here — bullet points, half-sentences, whatever…' : 'Paste your LinkedIn post, Substack issue, or video transcript here…'}
          style={{ width: '100%', borderRadius: 12, border: '1.5px solid #E5E7EB', padding: '0.875rem 1rem', fontSize: '0.85rem', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', outline: 'none', marginBottom: '0.6rem' }}
        />
        <button onClick={() => setInput(mode === 'notes' ? SAMPLE_NOTES : SAMPLE_NOTES)}
          style={{ background: 'none', border: 'none', color: DRILLOOP, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: '0.875rem', fontFamily: 'inherit' }}>
          ✨ Use sample {mode === 'notes' ? 'notes' : 'content'}
        </button>

        {/* Content linking + default tier */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '0.875rem' }}>
          <label style={fieldLabel}>
            Phase
            <select value={phase} onChange={e => setPhase(Number(e.target.value))} style={fieldInput}>
              {getPhases().map(p => <option key={p.phase} value={p.phase}>P{p.phase} · {p.title}</option>)}
            </select>
          </label>
          <label style={fieldLabel}>
            Default tier
            <select value={defaultTier} onChange={e => setDefaultTier(e.target.value as DrillTier)} style={fieldInput}>
              <option value="member">🔒 Members only</option>
              <option value="free">🔓 Free preview</option>
            </select>
          </label>
          <label style={fieldLabel}>
            Source label
            <input value={sourceLabel} onChange={e => setSourceLabel(e.target.value)} placeholder="e.g. LinkedIn post" style={fieldInput} />
          </label>
          <label style={fieldLabel}>
            Source URL
            <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://…" style={fieldInput} />
          </label>
        </div>

        <Button onClick={run} disabled={input.trim().length < minLen || generating}
          style={{ backgroundColor: DRILLOOP, boxShadow: '0 2px 8px rgba(13,148,136,0.3)' }}>
          {generating
            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> {mode === 'notes' ? 'Developing…' : 'Drafting drills…'}</>
            : <><Sparkles size={15} /> {mode === 'notes' ? 'Develop post + drills' : 'Draft drills with AI'}</>}
        </Button>
      </Card>

      {published !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', fontWeight: 600, color: '#10B981', backgroundColor: '#10B98110', padding: '0.6rem 0.875rem', borderRadius: 10 }}>
          <Check size={15} /> Published {published} drill{published === 1 ? '' : 's'} — members can drill them now. The post is on your Content calendar; drills are in Manage drills.
        </div>
      )}

      {/* Developed post (notes mode) */}
      {developed && post && (
        <Card style={{ borderLeft: `4px solid ${DRILLOOP}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={16} color={DRILLOOP} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Recommended post</h3>
              <Pill color={aiGenerated ? DRILLOOP : '#9CA3AF'}>{aiGenerated ? '✦ AI-developed' : 'Offline template'}</Pill>
            </div>
            <CopyButton text={post} label="Copy post" />
          </div>
          <input value={developed.postTitle} readOnly
            style={{ width: '100%', fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', border: 'none', outline: 'none', borderBottom: '1px dashed #E5E7EB', paddingBottom: '0.3rem', marginBottom: '0.5rem', fontFamily: 'inherit' }} />
          <textarea value={post} onChange={e => setPost(e.target.value)} rows={8}
            style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.75rem 0.875rem', fontSize: '0.85rem', lineHeight: 1.6, fontFamily: 'inherit', resize: 'vertical' }} />

          {/* Iterate on the post with your own instruction */}
          <div style={{ marginTop: '0.875rem', borderTop: '1px solid #F3F4F6', paddingTop: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem' }}>
              <Pencil size={13} color={DRILLOOP} /> Iterate on this post
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {QUICK_EDITS.map(q => (
                <button key={q} onClick={() => setInstruction(q)} disabled={iterating}
                  style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6B7280', backgroundColor: '#F3F4F6', border: 'none', borderRadius: 999, padding: '0.25rem 0.6rem', cursor: iterating ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                  {q}
                </button>
              ))}
            </div>
            <textarea
              value={instruction}
              onChange={e => { setInstruction(e.target.value); setIterateFailed(false); }}
              rows={2}
              placeholder="Tell AI how to revise — formatting (add bullets, punchier hook, shorten) or content (add a section on X, soften the tone, add a CTA)…"
              style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.6rem 0.75rem', fontSize: '0.82rem', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', marginBottom: '0.5rem' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <Button onClick={iterate} disabled={iterating || !instruction.trim()}
                style={{ backgroundColor: DRILLOOP, boxShadow: '0 2px 8px rgba(13,148,136,0.3)' }}>
                {iterating
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Revising…</>
                  : <><Wand2 size={14} /> Apply edit with AI</>}
              </Button>
              {iterateFailed && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#C2410C' }}>
                  <AlertCircle size={13} /> Couldn’t reach AI — post left unchanged. Try again.
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Research suggestions (notes mode) */}
      {developed && developed.research.length > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={15} color="#7C3AED" />
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Research to go deeper</h3>
            </div>
            <Button onClick={doResearch} disabled={researching || !post}
              style={{ backgroundColor: '#7C3AED', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}>
              {researching
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Researching…</>
                : <><Beaker size={14} /> Research & enhance post</>}
            </Button>
          </div>
          <p style={{ fontSize: '0.76rem', color: '#9CA3AF', margin: '0 0 0.75rem' }}>
            Let AI act on these — it weaves concrete examples, evidence and counter-arguments into the post above, unlocking harder (stretch / mastery) drills.
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {developed.research.map((r, i) => (
              <li key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>
                <Beaker size={14} color="#7C3AED" style={{ flexShrink: 0, marginTop: 2 }} /> {r}
              </li>
            ))}
          </ul>

          {enhancement && (
            <div style={{ marginTop: '0.875rem', padding: '0.7rem 0.875rem', borderRadius: 10, backgroundColor: enhancement.aiGenerated ? '#7C3AED10' : '#FFF7ED', border: `1px solid ${enhancement.aiGenerated ? '#7C3AED22' : '#FED7AA'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: enhancement.aiGenerated ? '#6D28D9' : '#C2410C', marginBottom: enhancement.additions.length ? '0.4rem' : 0 }}>
                <Check size={14} /> {enhancement.aiGenerated ? 'Researched and woven into the post above ↑' : 'Offline — research appended to the post as a checklist'}
              </div>
              {enhancement.additions.length > 0 && (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {enhancement.additions.map((a, i) => (
                    <span key={i} style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6D28D9', backgroundColor: 'white', border: '1px solid #7C3AED33', borderRadius: 999, padding: '0.2rem 0.55rem' }}>+ {a}</span>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Draft editor (shared by both modes) */}
      {drafts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>{drafts.length} draft drills — edit, set tier, publish</h3>
            <Pill color={aiGenerated ? DRILLOOP : '#9CA3AF'}>{aiGenerated ? '✦ AI-drafted' : 'Offline template'}</Pill>
          </div>
          {drafts.map((d, i) => (
            <Card key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <input value={d.title} onChange={e => updateDraft(i, { title: e.target.value })}
                  style={{ flex: 1, fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', border: 'none', outline: 'none', borderBottom: '1px dashed #E5E7EB', paddingBottom: '0.25rem', fontFamily: 'inherit' }} />
                <button onClick={() => removeDraft(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 4 }}><Trash2 size={15} /></button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={d.type} onChange={e => updateDraft(i, { type: e.target.value as DrillDraft['type'] })} style={miniSelect}>
                  {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
                <select value={d.difficulty} onChange={e => updateDraft(i, { difficulty: e.target.value as DrillDraft['difficulty'] })} style={miniSelect}>
                  {Object.entries(DIFFICULTY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                {/* Per-drill tier toggle */}
                <div style={{ display: 'inline-flex', gap: '0.2rem', marginLeft: 'auto', backgroundColor: '#F3F4F6', borderRadius: 8, padding: '0.15rem' }}>
                  {(['free', 'member'] as DrillTier[]).map(t => (
                    <button key={t} onClick={() => updateDraft(i, { tier: t })}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.68rem', fontWeight: 700, backgroundColor: (d.tier ?? defaultTier) === t ? 'white' : 'transparent', color: (d.tier ?? defaultTier) === t ? (t === 'free' ? '#10B981' : DRILLOOP_DARK) : '#9CA3AF' }}>
                      {t === 'free' ? <Unlock size={11} /> : <Lock size={11} />} {t === 'free' ? 'Free' : 'Members'}
                    </button>
                  ))}
                </div>
              </div>
              <textarea value={d.prompt} onChange={e => updateDraft(i, { prompt: e.target.value })} rows={3}
                style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.6rem 0.75rem', fontSize: '0.82rem', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', marginBottom: '0.6rem' }} />
              <div style={uppercaseLabel}>Rubric</div>
              <textarea value={d.keyPoints.join('\n')} onChange={e => updateDraft(i, { keyPoints: e.target.value.split('\n').filter(Boolean) })}
                rows={Math.max(3, d.keyPoints.length)}
                style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.6rem 0.75rem', fontSize: '0.8rem', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', marginBottom: '0.6rem' }} />
              <div style={uppercaseLabel}>Reference answer</div>
              <textarea value={d.modelAnswer} onChange={e => updateDraft(i, { modelAnswer: e.target.value })} rows={3}
                style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.6rem 0.75rem', fontSize: '0.8rem', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' }} />
              <DrillAiIterate
                current={{ title: d.title, type: d.type, difficulty: d.difficulty, prompt: d.prompt, keyPoints: d.keyPoints, modelAnswer: d.modelAnswer }}
                onApply={r => updateDraft(i, r)}
              />
            </Card>
          ))}
          <Button fullWidth onClick={publish} style={{ backgroundColor: DRILLOOP, boxShadow: '0 2px 8px rgba(13,148,136,0.3)' }}>
            <Check size={16} /> Publish {drafts.length} drill{drafts.length > 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CONTENT CALENDAR — every approved post (drills published from it), dated, with
// the full post toolset (research, iterate, copy) available to keep editing.
// ════════════════════════════════════════════════════════════════════════════

function CalendarTab({ onUseInAuthor }: { onUseInAuthor: () => void }) {
  const [posts, setPosts] = useState<CalendarPost[]>(() => getCalendarPosts());
  const [editingId, setEditingId] = useState<string | null>(null);
  const refresh = () => setPosts(getCalendarPosts());

  const editing = editingId ? posts.find(p => p.id === editingId) : null;
  if (editing) {
    return <CalendarPostEditor post={editing} onBack={() => { setEditingId(null); refresh(); }} onChange={refresh} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Card style={{ borderLeft: `4px solid ${DRILLOOP}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
          <Calendar size={16} color={DRILLOOP} />
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Content calendar</h3>
        </div>
        <p style={{ fontSize: '0.78rem', color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
          Every post you develop and approve — by publishing its drills in Author — lands here with a date. Keep editing any post with the full toolset: research, iterate, reschedule, copy.
        </p>
      </Card>

      <NextPostSuggester posts={posts} onUseInAuthor={onUseInAuthor} />

      {posts.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '1.75rem' }}>📅</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1F2937', margin: '0.5rem 0 0.25rem' }}>No posts yet</h3>
          <p style={{ fontSize: '0.82rem', color: '#6B7280', margin: 0 }}>Develop a post from rough notes in Author and publish its drills — it’ll appear here, dated.</p>
        </Card>
      ) : (
        posts.map(p => {
          const d = new Date(p.date);
          return (
            <Card key={p.id}>
              <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ width: 56, flexShrink: 0, textAlign: 'center', borderRadius: 12, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
                  <div style={{ backgroundColor: DRILLOOP, color: 'white', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', padding: '0.2rem 0' }}>{d.toLocaleString([], { month: 'short' })}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1F2937', padding: '0.2rem 0' }}>{d.getDate()}</div>
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1F2937', lineHeight: 1.3 }}>{p.title}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9CA3AF', margin: '0.15rem 0 0.4rem' }}>
                    {d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · {p.drillsCount} drill{p.drillsCount === 1 ? '' : 's'} approved
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6B7280', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.post}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  <CopyButton text={p.post} label="Copy" />
                  <Button onClick={() => setEditingId(p.id)} style={{ backgroundColor: DRILLOOP }}><Pencil size={14} /> Edit</Button>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ── Generate next-post suggestion ──
// Synthesizes member feedback, drill-performance signals, member requests, and
// market research into the best next post for a cohesive thought-leadership brand.
function NextPostSuggester({ posts, onUseInAuthor }: { posts: CalendarPost[]; onUseInAuthor: () => void }) {
  const [loading, setLoading] = useState(false);
  const [s, setS] = useState<NextPostSuggestion | null>(null);
  const [focusTopic, setFocusTopic] = useState('');
  const phases = getPhases();

  const generate = async () => {
    setLoading(true);
    const insights = computeCreatorInsights(loadState());
    const struggles = [...insights.drillInsights]
      .filter(d => d.attempts > 0)
      .sort((a, b) => b.struggleRate - a.struggleRate)
      .slice(0, 6)
      .map(d => ({ title: d.title, avgScore: d.avgScore, struggleRate: d.struggleRate, commonGaps: d.commonGaps }));
    const suggestion = await suggestNextPost({
      creatorName: CREATOR.name,
      topic: CREATOR.topic,
      focusTopic: focusTopic || undefined,
      recentPostTitles: posts.slice(0, 10).map(p => p.title),
      struggles,
      feedback: insights.recentFeedback.map(f => ({ tag: f.tag, note: f.note })),
      requests: getDrillRequests().map(r => ({ topicTitle: r.topicTitle, text: r.text })),
    });
    setS(suggestion);
    setLoading(false);
  };

  const asNotes = (x: NextPostSuggestion): string => [
    x.title,
    x.hook ? `\nHook: ${x.hook}` : '',
    x.angle ? `\nAngle: ${x.angle}` : '',
    x.outline.length ? `\nOutline:\n${x.outline.map(o => `- ${o}`).join('\n')}` : '',
    x.drillIdeas.length ? `\nDrill ideas:\n${x.drillIdeas.map(d => `- ${d}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');

  const draftInAuthor = () => { if (s) { setAuthorSeed(asNotes(s)); onUseInAuthor(); } };

  return (
    <Card style={{ borderLeft: '4px solid #7C3AED' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={16} color="#7C3AED" />
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Generate next post suggestion</h3>
        </div>
        {(s || loading) && (
          <Button onClick={generate} disabled={loading} variant="outline" style={{ borderColor: '#E5E7EB', color: '#7C3AED' }}>
            {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Working…</> : <><Sparkles size={14} /> Regenerate</>}
          </Button>
        )}
      </div>
      <p style={{ fontSize: '0.78rem', color: '#6B7280', margin: '0.4rem 0 0', lineHeight: 1.5 }}>
        Synthesizes member feedback, drill-performance signals, member requests, and live market research into your best next post — to build a cohesive thought-leadership brand and grow on Drilloop and social.
      </p>

      <label style={{ ...fieldLabel, marginTop: '0.875rem', maxWidth: 360 }}>
        Focus topic <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span>
        <select value={focusTopic} onChange={e => setFocusTopic(e.target.value)} style={fieldInput}>
          <option value="">Let AI pick (strongest signal)</option>
          {phases.map(p => <option key={p.phase} value={p.title}>{p.title}</option>)}
        </select>
      </label>

      {!s && !loading && (
        <Button onClick={generate} style={{ backgroundColor: '#7C3AED', boxShadow: '0 2px 8px rgba(124,58,237,0.3)', marginTop: '0.875rem' }}>
          <Sparkles size={15} /> Generate suggestion
        </Button>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.875rem', color: '#7C3AED', fontSize: '0.85rem', fontWeight: 600 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing feedback, drill performance, requests + market…
        </div>
      )}

      {s && !loading && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div style={{ backgroundColor: '#7C3AED0D', border: '1px solid #7C3AED22', borderRadius: 12, padding: '0.875rem 1rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1F2937', lineHeight: 1.3 }}>{s.title}</div>
            {s.hook && <div style={{ fontSize: '0.85rem', color: '#6D28D9', fontStyle: 'italic', marginTop: '0.3rem', lineHeight: 1.5 }}>“{s.hook}”</div>}
            {!s.aiGenerated && <div style={{ fontSize: '0.7rem', color: '#9CA3AF', marginTop: '0.4rem' }}>Offline suggestion (no AI key reachable) — heuristic.</div>}
          </div>

          {s.angle && <Field label="The angle" body={s.angle} />}
          {s.rationale && <Field label="Why this, now" body={s.rationale} />}

          {s.signals.length > 0 && (
            <div>
              <div style={sugLabel}>Drew on these signals</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {s.signals.map((sig, i) => <Pill key={i} color="#7C3AED">{sig}</Pill>)}
              </div>
            </div>
          )}

          {s.outline.length > 0 && (
            <div>
              <div style={sugLabel}>Outline</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {s.outline.map((o, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>
                    <span style={{ color: '#7C3AED', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span> {o}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {s.drillIdeas.length > 0 && (
            <div>
              <div style={sugLabel}>Drills it would spawn</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {s.drillIdeas.map((d, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>
                    <Target size={13} color="#7C3AED" style={{ flexShrink: 0, marginTop: 3 }} /> {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {s.brandNote && (
            <div style={{ fontSize: '0.78rem', color: '#6B7280', fontStyle: 'italic', lineHeight: 1.5, borderLeft: '2px solid #7C3AED33', paddingLeft: '0.6rem' }}>
              {s.brandNote}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button onClick={draftInAuthor} style={{ backgroundColor: '#7C3AED', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}>
              <Wand2 size={15} /> Draft this in Author
            </Button>
            <CopyButton text={asNotes(s)} label="Copy brief" />
          </div>
        </motion.div>
      )}
    </Card>
  );
}

function Field({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div style={sugLabel}>{label}</div>
      <p style={{ fontSize: '0.84rem', color: '#374151', lineHeight: 1.55, margin: 0 }}>{body}</p>
    </div>
  );
}

const sugLabel: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' };

// Full post editor — the same toolset as Author (research, iterate, copy) plus
// rescheduling, on a saved calendar post.
function CalendarPostEditor({ post, onBack, onChange }: { post: CalendarPost; onBack: () => void; onChange: () => void }) {
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.post);
  const [date, setDate] = useState(post.date.slice(0, 10));
  const [researching, setResearching] = useState(false);
  const [enhanced, setEnhanced] = useState<{ additions: string[]; aiGenerated: boolean } | null>(null);
  const [instruction, setInstruction] = useState('');
  const [iterating, setIterating] = useState(false);
  const [iterateFailed, setIterateFailed] = useState(false);
  const [saved, setSaved] = useState(false);

  const QUICK_EDITS = ['Make the hook punchier', 'Shorten to ~150 words', 'Add bullet points', 'Add a clear call-to-action', 'More conversational tone'];

  const touch = () => { setSaved(false); };

  const doResearch = async () => {
    setResearching(true);
    setEnhanced(null);
    const r = await researchAndEnhancePost(body, post.research);
    setBody(r.post);
    setEnhanced({ additions: r.additions, aiGenerated: r.aiGenerated });
    setResearching(false);
    touch();
  };

  const iterate = async () => {
    if (!instruction.trim()) return;
    setIterating(true);
    setIterateFailed(false);
    const r = await iteratePost(body, instruction);
    setBody(r.post);
    if (r.aiGenerated) setInstruction(''); else setIterateFailed(true);
    setIterating(false);
    touch();
  };

  const save = () => {
    updateCalendarPost(post.id, { title, post: body, date: new Date(`${date}T12:00:00`).toISOString() });
    setSaved(true);
    onChange();
  };

  const del = () => {
    deleteCalendarPost(post.id);
    onChange();
    onBack();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <button onClick={onBack}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: 'none', color: '#6B7280', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, alignSelf: 'flex-start' }}>
        <ArrowLeft size={15} /> All posts
      </button>

      <Card style={{ borderLeft: `4px solid ${DRILLOOP}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={16} color={DRILLOOP} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Edit post</h3>
          </div>
          <CopyButton text={body} label="Copy post" />
        </div>

        <input value={title} onChange={e => { setTitle(e.target.value); touch(); }}
          style={{ width: '100%', fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', border: 'none', outline: 'none', borderBottom: '1px dashed #E5E7EB', paddingBottom: '0.3rem', marginBottom: '0.6rem', fontFamily: 'inherit' }} />

        <label style={{ ...fieldLabel, marginBottom: '0.75rem' }}>
          Scheduled date
          <input type="date" value={date} onChange={e => { setDate(e.target.value); touch(); }} style={{ ...fieldInput, maxWidth: 200 }} />
        </label>

        <textarea value={body} onChange={e => { setBody(e.target.value); touch(); }} rows={10}
          style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.75rem 0.875rem', fontSize: '0.85rem', lineHeight: 1.6, fontFamily: 'inherit', resize: 'vertical' }} />

        {/* Iterate */}
        <div style={{ marginTop: '0.875rem', borderTop: '1px solid #F3F4F6', paddingTop: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem' }}>
            <Pencil size={13} color={DRILLOOP} /> Iterate on this post
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            {QUICK_EDITS.map(q => (
              <button key={q} onClick={() => setInstruction(q)} disabled={iterating}
                style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6B7280', backgroundColor: '#F3F4F6', border: 'none', borderRadius: 999, padding: '0.25rem 0.6rem', cursor: iterating ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {q}
              </button>
            ))}
          </div>
          <textarea value={instruction} onChange={e => { setInstruction(e.target.value); setIterateFailed(false); }} rows={2}
            placeholder="Tell AI how to revise — formatting or content…"
            style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.6rem 0.75rem', fontSize: '0.82rem', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', marginBottom: '0.5rem' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <Button onClick={iterate} disabled={iterating || !instruction.trim()} style={{ backgroundColor: DRILLOOP, boxShadow: '0 2px 8px rgba(13,148,136,0.3)' }}>
              {iterating ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Revising…</> : <><Wand2 size={14} /> Apply edit with AI</>}
            </Button>
            {iterateFailed && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#C2410C' }}>
                <AlertCircle size={13} /> Couldn’t reach AI — post left unchanged.
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Research & enhance (if research directions were captured) */}
      {post.research.length > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={15} color="#7C3AED" />
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Research to go deeper</h3>
            </div>
            <Button onClick={doResearch} disabled={researching} style={{ backgroundColor: '#7C3AED', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}>
              {researching ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Researching…</> : <><Beaker size={14} /> Research & enhance post</>}
            </Button>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {post.research.map((r, i) => (
              <li key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>
                <Beaker size={14} color="#7C3AED" style={{ flexShrink: 0, marginTop: 2 }} /> {r}
              </li>
            ))}
          </ul>
          {enhanced && (
            <div style={{ marginTop: '0.875rem', padding: '0.7rem 0.875rem', borderRadius: 10, backgroundColor: enhanced.aiGenerated ? '#7C3AED10' : '#FFF7ED', border: `1px solid ${enhanced.aiGenerated ? '#7C3AED22' : '#FED7AA'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: enhanced.aiGenerated ? '#6D28D9' : '#C2410C', marginBottom: enhanced.additions.length ? '0.4rem' : 0 }}>
                <Check size={14} /> {enhanced.aiGenerated ? 'Researched and woven into the post above ↑' : 'Offline — research appended as a checklist'}
              </div>
              {enhanced.additions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {enhanced.additions.map((a, i) => (
                    <span key={i} style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6D28D9', backgroundColor: 'white', border: '1px solid #7C3AED33', borderRadius: 999, padding: '0.2rem 0.55rem' }}>+ {a}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Save / delete */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <Button onClick={save} style={{ backgroundColor: DRILLOOP, boxShadow: '0 2px 8px rgba(13,148,136,0.3)' }}>
          {saved ? <><Check size={15} /> Saved</> : <><Check size={15} /> Save changes</>}
        </Button>
        <Button variant="outline" onClick={del} style={{ borderColor: '#FECACA', color: '#DC2626' }}><Trash2 size={14} /> Delete post</Button>
        {saved && <span style={{ fontSize: '0.76rem', color: '#10B981', fontWeight: 600 }}>Calendar updated.</span>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MANAGE — full lifecycle: edit, re-tier, re-tag, delete published drills.
// (Customer needs #2 + #3.)
// ════════════════════════════════════════════════════════════════════════════

function ManageTab() {
  const [drills, setDrills] = useState(() => getAuthoredDrills());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [phases, setPhases] = useState<Phase[]>(() => getPhases());

  const refresh = () => { setDrills(getAuthoredDrills()); setPhases(getPhases()); };

  const changeTier = (id: string, _title: string, tier: DrillTier) => {
    setDrillTier(id, tier);
    refresh();
  };
  const remove = (id: string) => {
    deleteAuthoredDrill(id);
    if (editingId === id) setEditingId(null);
    refresh();
  };
  const saveEdit = (id: string, patch: Partial<DrillDraft> & { phase?: number }) => {
    updateAuthoredDrill(id, patch);
    setEditingId(null);
    refresh();
  };
  // Tag a drill to a phase from the list, without opening the full editor.
  const retag = (id: string, phase: number) => {
    updateAuthoredDrill(id, { phase });
    refresh();
  };

  const free = drills.filter(d => tierOf(d) === 'free');
  const paid = drills.filter(d => tierOf(d) === 'member');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <StatTile label="Published drills" value={drills.length} />
        <StatTile label="Free preview" value={free.length} color="#10B981" />
        <StatTile label="Members only" value={paid.length} color={DRILLOOP_DARK} />
        <StatTile label="Phases" value={phases.length} sub="in your program" color="#7C3AED" />
      </div>

      <PhaseManager phases={phases} drills={drills} onChange={refresh} />

      {drills.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '1.75rem' }}>📝</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1F2937', margin: '0.5rem 0 0.25rem' }}>No published drills yet</h3>
          <p style={{ fontSize: '0.82rem', color: '#6B7280', margin: 0 }}>Author drills in the Author tab — they'll appear here to edit, re-tier, and audit.</p>
        </Card>
      ) : (
        [['Free preview', free, '#10B981'], ['Members only', paid, DRILLOOP_DARK]].map(([label, list, color]) => {
          const items = list as typeof drills;
          if (items.length === 0) return null;
          return (
            <Card key={label as string}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {label === 'Free preview' ? <Unlock size={15} color={color as string} /> : <Lock size={15} color={color as string} />}
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>{label as string} ({items.length})</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {items.map(d => editingId === d.id ? (
                  <DrillEditor key={d.id} drill={d} phases={phases} onCancel={() => setEditingId(null)} onSave={patch => saveEdit(d.id, patch)} />
                ) : (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 0.875rem', borderRadius: 10, backgroundColor: '#FAFAFA', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1F2937' }}>{d.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                        <select value={d.phase} onChange={e => retag(d.id, Number(e.target.value))}
                          title="Tag this drill to a phase"
                          style={{ ...miniSelect, color: '#7C3AED', borderColor: '#7C3AED33', fontWeight: 600 }}>
                          {phases.map(p => <option key={p.phase} value={p.phase}>P{p.phase} · {p.title}</option>)}
                        </select>
                        <span>{DIFFICULTY_META[d.difficulty].label} · {TYPE_META[d.type].label}{d.sourceLabel ? ` · 🔗 ${d.sourceLabel}` : ''}</span>
                      </div>
                    </div>
                    <TierPill tier={tierOf(d)} />
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button title="Edit" onClick={() => setEditingId(d.id)} style={iconBtn(DRILLOOP)}><Pencil size={14} /></button>
                      <button title={tierOf(d) === 'free' ? 'Move to Members' : 'Make Free'} onClick={() => changeTier(d.id, d.title, tierOf(d) === 'free' ? 'member' : 'free')} style={iconBtn('#7C3AED')}>
                        {tierOf(d) === 'free' ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>
                      <button title="Delete" onClick={() => remove(d.id)} style={iconBtn('#DC2626')}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ── Iterate a single drill with AI — reused by the Author drafts and Manage editor ──
type DrillFields = { title: string; type: DrillDraft['type']; difficulty: DrillDraft['difficulty']; prompt: string; keyPoints: string[]; modelAnswer: string };

function DrillAiIterate({ current, onApply }: { current: DrillFields; onApply: (r: DrillFields) => void }) {
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const QUICK = ['Make it harder', 'Make it scenario-based', 'Tighten the question', 'Sharpen the rubric', 'Strengthen the reference answer'];

  const run = async () => {
    if (!instruction.trim()) return;
    setBusy(true);
    setFailed(false);
    const r = await iterateDrill(current, instruction);
    if (r.aiGenerated) {
      onApply({ title: r.title, type: r.type, difficulty: r.difficulty, prompt: r.prompt, keyPoints: r.keyPoints, modelAnswer: r.modelAnswer });
      setInstruction('');
    } else {
      setFailed(true);
    }
    setBusy(false);
  };

  return (
    <div style={{ marginTop: '0.75rem', borderTop: '1px solid #F3F4F6', paddingTop: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem' }}>
        <Wand2 size={13} color={DRILLOOP} /> Iterate this drill with AI
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {QUICK.map(q => (
          <button key={q} onClick={() => setInstruction(q)} disabled={busy}
            style={{ fontSize: '0.68rem', fontWeight: 600, color: '#6B7280', backgroundColor: '#F3F4F6', border: 'none', borderRadius: 999, padding: '0.22rem 0.55rem', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {q}
          </button>
        ))}
      </div>
      <textarea value={instruction} onChange={e => { setInstruction(e.target.value); setFailed(false); }} rows={2}
        placeholder="Tell AI how to revise this drill — e.g. ‘set the scenario in a fintech team’, ‘add a rubric point on eval cost’, ‘make the reference answer crisper’…"
        style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.55rem 0.7rem', fontSize: '0.8rem', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', marginBottom: '0.5rem' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <Button onClick={run} disabled={busy || !instruction.trim()} style={{ backgroundColor: DRILLOOP, boxShadow: '0 2px 8px rgba(13,148,136,0.3)' }}>
          {busy ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Revising…</> : <><Wand2 size={14} /> Iterate with AI</>}
        </Button>
        {failed && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.74rem', color: '#C2410C' }}>
            <AlertCircle size={13} /> Couldn’t reach AI — drill left unchanged.
          </span>
        )}
      </div>
    </div>
  );
}

function DrillEditor({ drill, phases, onSave, onCancel }: { drill: ReturnType<typeof getAuthoredDrills>[number]; phases: Phase[]; onSave: (patch: Partial<DrillDraft> & { phase?: number }) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(drill.title);
  const [prompt, setPrompt] = useState(drill.prompt);
  const [keyPoints, setKeyPoints] = useState(drill.keyPoints.join('\n'));
  const [modelAnswer, setModelAnswer] = useState(drill.modelAnswer);
  const [type, setType] = useState(drill.type);
  const [difficulty, setDifficulty] = useState(drill.difficulty);
  const [phase, setPhase] = useState(drill.phase);

  return (
    <div style={{ padding: '0.875rem', borderRadius: 10, border: `1px solid ${DRILLOOP}33`, backgroundColor: 'white' }}>
      <input value={title} onChange={e => setTitle(e.target.value)}
        style={{ width: '100%', fontSize: '0.9rem', fontWeight: 700, color: '#1F2937', border: 'none', outline: 'none', borderBottom: '1px dashed #E5E7EB', paddingBottom: '0.25rem', marginBottom: '0.6rem', fontFamily: 'inherit' }} />
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
        <select value={type} onChange={e => setType(e.target.value as typeof type)} style={miniSelect}>
          {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
        </select>
        <select value={difficulty} onChange={e => setDifficulty(e.target.value as typeof difficulty)} style={miniSelect}>
          {Object.entries(DIFFICULTY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={phase} onChange={e => setPhase(Number(e.target.value))} title="Phase" style={{ ...miniSelect, color: '#7C3AED', borderColor: '#7C3AED33', fontWeight: 600 }}>
          {phases.map(p => <option key={p.phase} value={p.phase}>P{p.phase} · {p.title}</option>)}
        </select>
      </div>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
        style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.6rem 0.75rem', fontSize: '0.82rem', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', marginBottom: '0.6rem' }} />
      <div style={uppercaseLabel}>Rubric</div>
      <textarea value={keyPoints} onChange={e => setKeyPoints(e.target.value)} rows={Math.max(3, drill.keyPoints.length)}
        style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.6rem 0.75rem', fontSize: '0.8rem', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', marginBottom: '0.6rem' }} />
      <div style={uppercaseLabel}>Reference answer</div>
      <textarea value={modelAnswer} onChange={e => setModelAnswer(e.target.value)} rows={3}
        style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.6rem 0.75rem', fontSize: '0.8rem', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' }} />

      <DrillAiIterate
        current={{ title, type, difficulty, prompt, keyPoints: keyPoints.split('\n').filter(Boolean), modelAnswer }}
        onApply={r => { setTitle(r.title); setType(r.type); setDifficulty(r.difficulty); setPrompt(r.prompt); setKeyPoints(r.keyPoints.join('\n')); setModelAnswer(r.modelAnswer); }}
      />

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <Button onClick={() => onSave({ title, prompt, keyPoints: keyPoints.split('\n').filter(Boolean), modelAnswer, type, difficulty, phase })}
          style={{ backgroundColor: DRILLOOP }}><Check size={14} /> Save</Button>
        <Button variant="outline" onClick={onCancel} style={{ borderColor: '#E5E7EB', color: '#6B7280' }}><X size={14} /> Cancel</Button>
      </div>
    </div>
  );
}

// ── Program phases — view all phases and create your own ──
function PhaseManager({ phases, drills, onChange }: { phases: Phase[]; drills: ReturnType<typeof getAuthoredDrills>; onChange: () => void }) {
  const [newTitle, setNewTitle] = useState('');
  const counts = new Map<number, number>();
  drills.forEach(d => counts.set(d.phase, (counts.get(d.phase) ?? 0) + 1));

  const add = () => {
    if (!newTitle.trim()) return;
    createPhase(newTitle);
    setNewTitle('');
    onChange();
  };
  const removePhase = (p: Phase) => {
    deletePhase(p.phase);
    onChange();
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
        <Layers size={16} color="#7C3AED" />
        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Program phases</h3>
      </div>
      <p style={{ fontSize: '0.76rem', color: '#6B7280', margin: '0 0 0.875rem' }}>
        Tag drills to a phase of your learning program (use the phase dropdown on each drill below), or add a new phase of your own.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.875rem' }}>
        {phases.map(p => (
          <span key={p.phase} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.65rem', borderRadius: 999, fontSize: '0.74rem', fontWeight: 600, backgroundColor: p.custom ? '#7C3AED12' : '#F3F4F6', color: p.custom ? '#6D28D9' : '#374151', border: `1px solid ${p.custom ? '#7C3AED33' : 'transparent'}` }}>
            P{p.phase} · {p.title}
            <span style={{ color: '#9CA3AF', fontWeight: 500 }}>· {counts.get(p.phase) ?? 0}</span>
            {p.custom && (counts.get(p.phase) ?? 0) === 0 && (
              <button title="Delete phase" onClick={() => removePhase(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, display: 'inline-flex' }}><X size={12} /></button>
            )}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder="New phase name — e.g. “Prompt engineering”"
          style={{ ...fieldInput, flex: '1 1 220px' }} />
        <Button onClick={add} disabled={!newTitle.trim()} style={{ backgroundColor: '#7C3AED', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}>
          <Plus size={15} /> Add phase
        </Button>
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMMUNITY — manage members (privacy-safe) + host in-person gatherings.
// (Customer need #4.)
// ════════════════════════════════════════════════════════════════════════════

function CommunityTab() {
  const roster = useMemo<CommunityMember[]>(() => getCommunityRoster(loadState()), []);
  const summary = summarize(roster);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [gatherings, setGatherings] = useState<Gathering[]>(() => getGatherings());
  const refreshGatherings = () => setGatherings(getGatherings());

  const shown = roster.filter(m => filter === 'all' || m.status === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <StatTile label="Members" value={summary.total} />
        <StatTile label="Active" value={summary.active} color="#10B981" />
        <StatTile label="Inactive" value={summary.inactive} sub="nudge them" color="#F97316" />
        <StatTile label="Paid / Free" value={`${summary.paid} / ${summary.free}`} />
      </div>

      <HostGathering onCreated={refreshGatherings} />
      <GatheringList gatherings={gatherings} onChange={refreshGatherings} />

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={16} color={DRILLOOP} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Your members</h3>
          </div>
          <div style={{ display: 'inline-flex', gap: '0.2rem', backgroundColor: '#F3F4F6', borderRadius: 8, padding: '0.15rem' }}>
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '0.3rem 0.7rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize', backgroundColor: filter === f ? 'white' : 'transparent', color: filter === f ? DRILLOOP : '#9CA3AF', boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <p style={{ fontSize: '0.74rem', color: '#9CA3AF', margin: '0 0 0.875rem' }}>
          🔒 Privacy-preserving: handles are anonymized and answers are never shown. You see milestones (“wins”), tier, and activity only.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {shown.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 0.875rem', borderRadius: 12, backgroundColor: m.isYou ? DRILLOOP_SOFT : '#FAFAFA', border: m.isYou ? `1px solid ${DRILLOOP}33` : '1px solid rgba(0,0,0,0.04)', flexWrap: 'wrap' }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, backgroundColor: m.status === 'active' ? DRILLOOP_SOFT : '#F3F4F6', color: m.status === 'active' ? DRILLOOP : '#9CA3AF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>{m.initials}</span>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1F2937' }}>{m.handle}</span>
                  {m.isYou && <span style={{ fontSize: '0.66rem', color: DRILLOOP, fontWeight: 600 }}>(you)</span>}
                  <Pill color={m.status === 'active' ? '#10B981' : '#9CA3AF'}>{m.status}</Pill>
                  <TierPill tier={m.tier} />
                </div>
                <div style={{ fontSize: '0.7rem', color: '#9CA3AF', marginTop: 2 }}>{m.drillsCompleted} drills · {m.streak}d streak · {m.lastActive}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {m.wins.map((w, i) => (
                  <span key={i} style={{ fontSize: '0.68rem', fontWeight: 600, color: '#374151', backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: 999, padding: '0.2rem 0.5rem' }}>{w}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function HostGathering({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState('');
  const [venue, setVenue] = useState('');
  const [when, setWhen] = useState('');
  const [capacity, setCapacity] = useState(12);

  const canCreate = city.trim() && venue.trim() && when.trim();

  const create = () => {
    createGathering({ city, venue, when, capacity, note: '' }, new Date());
    setCity(''); setVenue(''); setWhen(''); setCapacity(12); setOpen(false);
    onCreated();
  };

  return (
    <Card style={{ background: open ? 'white' : `linear-gradient(135deg, ${DRILLOOP}, ${DRILLOOP_DARK})`, border: 'none', color: open ? '#1F2937' : 'white' }}>
      {!open ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <MapPin size={17} /> <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0 }}>Host an in-person gathering</h3>
            </div>
            <p style={{ fontSize: '0.78rem', opacity: 0.9, margin: 0, maxWidth: 460 }}>Turn your online cohort into a local community — the part a feed can never give them.</p>
          </div>
          <Button onClick={() => setOpen(true)} style={{ backgroundColor: 'white', color: DRILLOOP_DARK }}><Plus size={15} /> New gathering</Button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
            <MapPin size={16} color={DRILLOOP} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Host an in-person gathering</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '0.875rem' }}>
            <label style={fieldLabel}>City <input value={city} onChange={e => setCity(e.target.value)} placeholder="San Francisco" style={fieldInput} /></label>
            <label style={fieldLabel}>Venue <input value={venue} onChange={e => setVenue(e.target.value)} placeholder="Sightglass Coffee, SoMa" style={fieldInput} /></label>
            <label style={fieldLabel}>When <input value={when} onChange={e => setWhen(e.target.value)} placeholder="Thu, Jul 3 · 6:30pm" style={fieldInput} /></label>
            <label style={fieldLabel}>Capacity <input type="number" value={capacity} min={2} onChange={e => setCapacity(Number(e.target.value))} style={fieldInput} /></label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button onClick={create} disabled={!canCreate} style={{ backgroundColor: DRILLOOP }}><Calendar size={15} /> Schedule gathering</Button>
            <Button variant="outline" onClick={() => setOpen(false)} style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function GatheringList({ gatherings, onChange }: { gatherings: Gathering[]; onChange: () => void }) {
  if (gatherings.length === 0) return null;
  const cancel = (id: string) => { cancelGathering(id, new Date()); onChange(); };
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Calendar size={15} color={DRILLOOP} />
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Your gatherings</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {gatherings.map(g => (
          <div key={g.id} style={{ padding: '0.75rem 0.875rem', borderRadius: 12, backgroundColor: '#FAFAFA', border: '1px solid rgba(0,0,0,0.04)', opacity: g.status === 'cancelled' ? 0.55 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1F2937' }}>{g.city}</span>
                  <Pill color={g.status === 'scheduled' ? '#10B981' : '#9CA3AF'}>{g.status === 'scheduled' ? `${g.rsvps} RSVPs · ${g.capacity} cap` : 'Cancelled'}</Pill>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.74rem', color: '#6B7280', marginTop: 2 }}>
                  <Calendar size={12} /> {g.when} · {g.venue}
                </div>
              </div>
              {g.status === 'scheduled' && (
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <CopyButton text={gatheringAnnouncement(g, CREATOR.name)} label="Announcement" />
                  <button title="Cancel" onClick={() => cancel(g.id)} style={iconBtn('#DC2626')}><X size={15} /></button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '0.68rem', color: '#9CA3AF', margin: '0.75rem 0 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        <Megaphone size={12} /> “Announcement” copies a ready-to-paste invite for your community channels.
      </p>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// GROW — shareable free→paid onboarding link + social copy. (Customer need #1.)
// ════════════════════════════════════════════════════════════════════════════

function GrowTab({ insights }: { insights: CreatorInsights }) {
  const [cfg, setCfg] = useState(() => getShareConfig());
  const link = buildInviteLink(cfg.handle);

  const update = (patch: Partial<typeof cfg>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    saveShareConfig(next);
  };

  const linkedInPost = [
    `I'm opening up my ${CREATOR.topic} learning loop on Drilloop. 🔁`,
    '',
    `Not another course you'll never finish — short daily drills that test your judgment, AI-graded, with a community that drills together.`,
    '',
    `Join free to start, upgrade when you're hooked:`,
    link,
  ].join('\n');

  const dmCopy = `Hey! I started a Drilloop where I drill ${CREATOR.topic} with a small group — free to join, takes 15 min a day. Thought you'd like it: ${link}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Funnel */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <StatTile label="Joined" value={insights.activeMembers} sub="free + paid" />
        <StatTile label="Upgraded" value={insights.paidMembers} sub="to paid" color={DRILLOOP_DARK} />
        <StatTile label="Free → paid" value={insights.activeMembers ? `${Math.round((insights.paidMembers / insights.activeMembers) * 100)}%` : '—'} color="#10B981" />
      </div>

      {/* Invite link */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <Share2 size={16} color={DRILLOOP} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Your invite link</h3>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: '0 0 0.875rem', lineHeight: 1.5 }}>
          Share this anywhere. Anyone who opens it joins <strong>free</strong> and is welcomed by name; they're prompted to upgrade once they're hooked.
        </p>

        <label style={{ ...fieldLabel, marginBottom: '0.75rem' }}>
          Handle (your referral code)
          <input value={cfg.handle} onChange={e => update({ handle: e.target.value.replace(/\s+/g, '').toLowerCase() })} style={fieldInput} />
        </label>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
          <div style={{ flex: '1 1 240px', minWidth: 0, fontSize: '0.82rem', color: '#374151', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '0.6rem 0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'ui-monospace, monospace' }}>{link}</div>
          <CopyButton text={link} label="Copy link" />
          <Link to={`/drilloop?ref=${encodeURIComponent(cfg.handle)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 600, color: DRILLOOP, textDecoration: 'none', padding: '0.55rem 0.75rem', borderRadius: 10, backgroundColor: DRILLOOP_SOFT }}>
            <Eye size={14} /> Preview
          </Link>
        </div>

        <label style={fieldLabel}>
          Invite headline (shown on the join page)
          <input value={cfg.headline} onChange={e => update({ headline: e.target.value })} style={fieldInput} />
        </label>
      </Card>

      {/* Ready-to-share copy */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
          <Megaphone size={16} color={DRILLOOP} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Ready-to-post copy</h3>
        </div>
        <ShareSnippet title="LinkedIn / Substack post" text={linkedInPost} />
        <div style={{ height: '0.75rem' }} />
        <ShareSnippet title="Direct message" text={dmCopy} />
      </Card>
    </div>
  );
}

function ShareSnippet({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#6B7280' }}>{title}</span>
        <CopyButton text={text} />
      </div>
      <div style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.55, backgroundColor: '#FAFAFA', border: '1px solid #F3F4F6', borderRadius: 10, padding: '0.75rem 0.875rem', whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  );
}

// ── Insight dashboard ──
function InsightsTab({ insights }: { insights: CreatorInsights }) {
  const sorted = [...insights.drillInsights].sort((a, b) => b.struggleRate - a.struggleRate);
  const requests: DrillRequest[] = getDrillRequests();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Card style={{ borderLeft: '4px solid #D97706' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <Lightbulb size={16} color="#D97706" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Drill requests</h3>
          {requests.length > 0 && <Pill color="#D97706">{requests.length}</Pill>}
        </div>
        <p style={{ fontSize: '0.78rem', color: '#9CA3AF', margin: '0 0 0.75rem' }}>What members are asking for more drills on — your authoring backlog, straight from demand.</p>
        {requests.length === 0 ? (
          <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>No requests yet. Members can request more drills from any topic in the member app.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {requests.map(r => (
              <div key={r.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.6rem 0.75rem', borderRadius: 10, backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <Pill color="#D97706">{r.topicTitle}</Pill>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>{r.text}</div>
                  <div style={{ fontSize: '0.68rem', color: '#9CA3AF', marginTop: 2 }}>{new Date(r.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

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

// ── Connections — aggregate network health (server-computed, anonymized) ──
const MATCH_TYPE_LABEL: Record<string, string> = {
  knowledge_complement: 'Complementary strengths',
  goal_aligned: 'Aligned goals',
  mixed: 'Strengths + goals',
};

function ConnectionsTab() {
  const [net, setNet] = useState<NetworkInsights | null>(null);
  const [runs, setRuns] = useState<MatchingRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [n, r] = await Promise.all([getNetworkInsights(), getMatchingRuns()]);
      setNet(n);
      setRuns(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load network health.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const run = async () => {
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const res = await triggerMatchingRun();
      setNotice(`Run complete — ${res.matchesGenerated} matches generated across ${res.membersConsidered} members.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Matching run failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#B91C1C', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '0.6rem 0.875rem' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}
      {notice && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#10B981', backgroundColor: '#10B98110', borderRadius: 10, padding: '0.6rem 0.875rem' }}>
          <Check size={15} /> {notice}
        </div>
      )}

      <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Network size={16} color={DRILLOOP} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Matching engine</h3>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#6B7280', margin: '0.3rem 0 0' }}>
            Generate a fresh round of 1:1 suggestions across the member base from drill performance + profiles.
          </p>
        </div>
        <Button onClick={run} disabled={running} style={{ backgroundColor: DRILLOOP, boxShadow: '0 2px 8px rgba(13,148,136,0.3)' }}>
          {running ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Running…</> : <><Play size={15} /> Run matching</>}
        </Button>
      </Card>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6B7280', fontSize: '0.85rem' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading network health…</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <StatTile label="In matching pool" value={net?.poolSize ?? 0} sub="opted-in" />
            <StatTile label="Matches generated" value={net?.totalMatches ?? 0} />
            <StatTile label="Connections" value={net?.totalConnections ?? 0} sub="mutual accepts" />
            <StatTile label="Acceptance rate" value={net?.acceptanceRate != null ? `${Math.round(net.acceptanceRate * 100)}%` : '—'} />
          </div>

          <Card>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F2937', margin: '0 0 0.5rem' }}>Most common match type</h3>
            <p style={{ fontSize: '0.85rem', color: '#374151', margin: 0 }}>
              {net?.topMatchType ? (MATCH_TYPE_LABEL[net.topMatchType] ?? net.topMatchType) : 'No matches yet — run the engine to start.'}
            </p>
          </Card>

          <Card>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F2937', margin: '0 0 0.75rem' }}>Recent matching runs</h3>
            {runs.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: '#9CA3AF', margin: 0 }}>No runs yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {runs.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.55rem 0.75rem', borderRadius: 10, backgroundColor: '#FAFAFA' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1F2937' }}>
                        {new Date(r.startedAt).toLocaleString()} · {r.triggerType}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>
                        {r.matchesGenerated} matches · {r.membersConsidered} members · ${r.costUsd.toFixed(4)}
                        {r.error ? ` · ${r.error}` : ''}
                      </div>
                    </div>
                    <Pill color={r.status === 'success' ? '#10B981' : r.status === 'failed' ? '#DC2626' : '#9CA3AF'}>{r.status}</Pill>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
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

// ── Shared style tokens ──
const fieldLabel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 600, color: '#6B7280' };
const fieldInput: React.CSSProperties = { borderRadius: 10, border: '1px solid #E5E7EB', padding: '0.5rem 0.65rem', fontSize: '0.8125rem', fontFamily: 'inherit', backgroundColor: 'white' };
const miniSelect: React.CSSProperties = { borderRadius: 8, border: '1px solid #E5E7EB', padding: '0.3rem 0.5rem', fontSize: '0.72rem', fontFamily: 'inherit' };
const uppercaseLabel: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' };
function iconBtn(color: string): React.CSSProperties {
  return { background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', color, padding: '0.4rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
}
