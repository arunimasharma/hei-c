import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Copy, Download, RefreshCw, ArrowLeft, Check, Code2 } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ChatBubble from '../components/validator/ChatBubble';
import Markdown from '../components/validator/Markdown';
import { getSession, generateDoc } from '../services/validatorClient';
import {
  trackDocCopied,
  trackDocDownloaded,
  trackBuildPromptCopied,
  trackProductClubMentioned,
} from '../services/validatorAnalytics';
import type { ValidatorMessage, ValidatorSession } from '../types/validator';

type Tab = 'hypothesis' | 'build_prompt';

export default function ValidatorSessionPage() {
  return (
    <DashboardLayout>
      <ValidatorSessionInner />
    </DashboardLayout>
  );
}

function ValidatorSessionInner() {
  const { sessionId = '' } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<ValidatorSession | null>(null);
  const [messages, setMessages] = useState<ValidatorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('build_prompt');
  const [showChat, setShowChat] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'full' | 'build_only' | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSession(sessionId);
      if (!result) {
        setError('Session not found.');
        setSession(null);
        setMessages([]);
      } else {
        setSession(result.session);
        setMessages(result.messages);
        setTab('build_prompt');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load session.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Splits the doc on the first horizontal rule into "hypothesis" framing
  // (above) and the paste-ready Claude Code build prompt (below).
  const { hypothesisDoc, buildPromptDoc } = useMemo(() => {
    if (!session?.generatedDoc) return { hypothesisDoc: null, buildPromptDoc: null };
    return splitOnHorizontalRule(session.generatedDoc);
  }, [session?.generatedDoc]);

  // Fire validator_product_club_mentioned once per generated doc that mentions it.
  useEffect(() => {
    if (!session?.generatedDoc) return;
    if (/product\s*\.?\s*club/i.test(session.generatedDoc)) {
      trackProductClubMentioned({ sessionId: session.id, surface: 'build_prompt' });
    }
    // Only fire on initial doc load, not every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.generatedDoc]);

  const flashCopied = (key: 'full' | 'build_only') => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const handleCopyFull = async () => {
    if (!session?.generatedDoc) return;
    try {
      await navigator.clipboard.writeText(session.generatedDoc);
      trackDocCopied(session.id);
      trackBuildPromptCopied({ sessionId: session.id, mode: session.mode, copiedSection: 'full' });
      flashCopied('full');
    } catch {
      alert('Could not copy to clipboard.');
    }
  };

  const handleCopyBuildOnly = async () => {
    if (!session || !buildPromptDoc) return;
    try {
      await navigator.clipboard.writeText(buildPromptDoc);
      trackBuildPromptCopied({ sessionId: session.id, mode: session.mode, copiedSection: 'build_only' });
      flashCopied('build_only');
    } catch {
      alert('Could not copy to clipboard.');
    }
  };

  const handleDownload = () => {
    if (!session?.generatedDoc) return;
    const safeTitle = (session.title ?? 'build-prompt')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'build-prompt';
    const blob = new Blob([session.generatedDoc], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeTitle}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    trackDocDownloaded(session.id);
  };

  const handleRegenerate = async () => {
    if (!session) return;
    if (!confirm('Regenerate the build prompt using the same chat history?')) return;
    setRegenerating(true);
    try {
      const { doc } = await generateDoc({ sessionId: session.id, generateAnyway: true });
      setSession({ ...session, generatedDoc: doc, docGeneratedAt: new Date().toISOString() });
      setTab('build_prompt');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Regeneration failed.';
      alert(message);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error || !session) {
    return (
      <Card style={{ padding: '1.5rem' }}>
        <p style={{ margin: 0, color: '#B91C1C', fontSize: '0.875rem' }}>{error ?? 'Session not found.'}</p>
        <div style={{ marginTop: '1rem' }}>
          <Link to="/validator" style={{ color: '#4A5FC1', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Idea Validator
          </Link>
        </div>
      </Card>
    );
  }

  const created = new Date(session.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div style={{ maxWidth: '46rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Back link */}
      <Link to="/validator" style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
        color: '#6B7280', fontSize: '0.8125rem', fontWeight: 500,
        textDecoration: 'none', width: 'fit-content',
      }}>
        <ArrowLeft size={14} /> All sessions
      </Link>

      {/* Metadata + top action bar */}
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.01em' }}>
          {session.title || 'Untitled idea'}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#9CA3AF', flexWrap: 'wrap' }}>
          <span style={{
            padding: '0.125rem 0.5rem', borderRadius: '999px', fontWeight: 600,
            backgroundColor: session.mode === 'quick_prototype' ? '#EDE9FE' : '#DBEAFE',
            color:           session.mode === 'quick_prototype' ? '#6D28D9' : '#1D4ED8',
          }}>
            {session.mode === 'quick_prototype' ? 'Quick prototype' : 'Strategic bet'}
          </span>
          <span>Started {created}</span>
        </div>
        {session.generatedDoc && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Button onClick={handleCopyFull} variant="outline" size="sm">
              {copiedKey === 'full' ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy full document</>}
            </Button>
            <Button onClick={handleDownload} variant="outline" size="sm">
              <Download size={14} /> Download .md
            </Button>
            <Button onClick={handleRegenerate} disabled={regenerating} variant="ghost" size="sm">
              <RefreshCw size={14} /> {regenerating ? 'Regenerating…' : 'Regenerate'}
            </Button>
          </div>
        )}
      </header>

      {/* Tabs (chat is a small toggle, not a primary tab) */}
      {session.generatedDoc ? (
        <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #E5E7EB' }}>
          <TabButton active={tab === 'build_prompt'} onClick={() => setTab('build_prompt')} label="Build Prompt" />
          <TabButton active={tab === 'hypothesis'}   onClick={() => setTab('hypothesis')}   label="Hypothesis" />
          <div style={{ flex: 1 }} />
          <TabButton active={showChat} onClick={() => setShowChat(s => !s)} label={showChat ? 'Hide chat' : 'Show chat'} />
        </div>
      ) : null}

      {session.generatedDoc && tab === 'build_prompt' && (
        <BuildPromptPanel
          buildPromptDoc={buildPromptDoc}
          fullDoc={session.generatedDoc}
          copied={copiedKey === 'build_only'}
          onCopyBuildOnly={handleCopyBuildOnly}
        />
      )}

      {session.generatedDoc && tab === 'hypothesis' && (
        <HypothesisPanel hypothesisDoc={hypothesisDoc} fullDoc={session.generatedDoc} />
      )}

      {!session.generatedDoc && (
        <Card style={{ padding: '1.5rem' }}>
          <p style={{ margin: 0, color: '#6B7280', fontSize: '0.875rem' }}>
            No document yet. Continue the chat and click "Generate Build Prompt".
          </p>
          <div style={{ marginTop: '1rem' }}>
            <Link to="/validator/new" style={{ color: '#4A5FC1', fontWeight: 600, textDecoration: 'none', fontSize: '0.875rem' }}>
              Continue chat →
            </Link>
          </div>
        </Card>
      )}

      {showChat && (
        <Card style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.length === 0
              ? <p style={{ margin: 0, color: '#9CA3AF', fontSize: '0.875rem' }}>No messages yet.</p>
              : messages.map(m => <ChatBubble key={m.id} role={m.role} content={m.content} />)}
          </div>
        </Card>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.625rem 0.875rem', border: 'none',
        backgroundColor: 'transparent', cursor: 'pointer',
        fontSize: '0.875rem', fontWeight: active ? 600 : 500,
        color: active ? '#1F2937' : '#6B7280', fontFamily: 'inherit',
        borderBottom: `2px solid ${active ? '#4A5FC1' : 'transparent'}`,
        marginBottom: '-1px',
      }}
    >
      {label}
    </button>
  );
}

interface BuildPromptPanelProps {
  buildPromptDoc: string | null;
  fullDoc: string;
  copied: boolean;
  onCopyBuildOnly: () => void;
}

function BuildPromptPanel({ buildPromptDoc, fullDoc, copied, onCopyBuildOnly }: BuildPromptPanelProps) {
  const content = buildPromptDoc ?? fullDoc;
  const showsOnlyBuild = buildPromptDoc !== null;
  return (
    <Card style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6B7280', maxWidth: '32rem' }}>
          {showsOnlyBuild
            ? 'Paste this directly into Claude Code or another coding agent.'
            : 'No build prompt section was found in this document. Showing the full text.'}
        </p>
        <Button onClick={onCopyBuildOnly} disabled={!showsOnlyBuild} variant="primary" size="sm">
          {copied
            ? <><Check size={14} /> Copied</>
            : <><Code2 size={14} /> Copy Build Prompt only</>}
        </Button>
      </div>
      <div style={{ height: '1px', backgroundColor: '#F3F4F6' }} />
      <Markdown content={content} variant="doc" />
    </Card>
  );
}

interface HypothesisPanelProps {
  hypothesisDoc: string | null;
  fullDoc: string;
}

function HypothesisPanel({ hypothesisDoc, fullDoc }: HypothesisPanelProps) {
  const content = hypothesisDoc ?? fullDoc;
  return (
    <Card style={{ padding: '1.5rem 1.75rem' }}>
      <Markdown content={content} variant="doc" />
    </Card>
  );
}

// ── Doc splitter ──────────────────────────────────────────────────────────────
//
// The generation prompt produces a doc with the structure:
//   <hypothesis framing sections>
//   ---
//   # Claude Code Build Prompt
//   <paste-ready agent prompt>
// Find the first horizontal-rule line and split there. If we can't find one,
// return null for both halves so the panels fall back to the full text.

function splitOnHorizontalRule(doc: string): {
  hypothesisDoc: string | null;
  buildPromptDoc: string | null;
} {
  const lines = doc.replace(/\r\n/g, '\n').split('\n');
  const ruleIdx = lines.findIndex(l => /^\s*-{3,}\s*$/.test(l));
  if (ruleIdx < 0) return { hypothesisDoc: null, buildPromptDoc: null };

  const above = lines.slice(0, ruleIdx).join('\n').trim();
  const below = lines.slice(ruleIdx + 1).join('\n').trim();
  if (!above || !below) return { hypothesisDoc: null, buildPromptDoc: null };
  return { hypothesisDoc: above, buildPromptDoc: below };
}
