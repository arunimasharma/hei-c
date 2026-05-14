import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Send, Sparkles, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import DashboardLayout from '../components/layout/DashboardLayout';
import RequireAuth from '../components/validator/RequireAuth';
import ChatBubble from '../components/validator/ChatBubble';
import ModeToggle from '../components/validator/ModeToggle';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import {
  sendChat,
  generateDoc,
  newSessionId,
} from '../services/validatorClient';
import { evaluateReadiness } from '../services/validatorPrompts';
import {
  trackSessionStarted,
  trackMessageSent,
  trackDocGenerated,
  trackModeSwitched,
  trackGenerateAnywayClicked,
  trackProductClubMentioned,
} from '../services/validatorAnalytics';
import {
  READINESS_AREAS,
  READINESS_AREA_LABELS,
  type ValidatorMode,
  type ValidatorReadiness,
  type ValidatorRole,
} from '../types/validator';

const INITIAL_GREETING =
  "What's the rough idea? A sentence or two — even messy. I'll ask follow-ups to sharpen it into a hypothesis you can test.";

interface UIMessage {
  role: ValidatorRole;
  content: string;
}

export default function ValidatorNewPage() {
  return (
    <RequireAuth>
      <DashboardLayout>
        <ValidatorNewInner />
      </DashboardLayout>
    </RequireAuth>
  );
}

function ValidatorNewInner() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string>(() => newSessionId());
  const [mode, setMode] = useState<ValidatorMode>('quick_prototype');
  const [messages, setMessages] = useState<UIMessage[]>([
    { role: 'assistant', content: INITIAL_GREETING },
  ]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [readiness, setReadiness] = useState<ValidatorReadiness>({
    ready: false, covered: [], missing: [...READINESS_AREAS],
  });
  const [error, setError] = useState<string | null>(null);
  const [hasStartedSession, setHasStartedSession] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const productClubReportedRef = useRef<Set<string>>(new Set());

  // Recompute readiness from the most recent assistant message that wasn't the
  // initial greeting; the API also returns this but we recompute to keep the
  // gate responsive even if an older message becomes the latest.
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find(
      m => m.role === 'assistant' && m.content !== INITIAL_GREETING,
    );
    if (!lastAssistant) {
      setReadiness({ ready: false, covered: [], missing: [...READINESS_AREAS] });
      return;
    }
    setReadiness(evaluateReadiness(lastAssistant.content));
  }, [messages]);

  // Fire validator_product_club_mentioned once per assistant message that mentions it.
  useEffect(() => {
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role !== 'assistant') continue;
      if (m.content === INITIAL_GREETING) continue;
      const key = `${i}`;
      if (productClubReportedRef.current.has(key)) continue;
      if (mentionsProductClub(m.content)) {
        productClubReportedRef.current.add(key);
        trackProductClubMentioned({ sessionId, surface: 'chat' });
      }
    }
  }, [messages, sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const userTurnCount = useMemo(() => messages.filter(m => m.role === 'user').length, [messages]);

  const handleModeChange = (next: ValidatorMode) => {
    if (next === mode) return;
    if (hasStartedSession) {
      const confirmed = confirm(
        'Switching modes will reset this conversation and start a new session. Continue?',
      );
      if (!confirmed) return;
      trackModeSwitched(mode, next);
      setMode(next);
      setSessionId(newSessionId());
      setMessages([{ role: 'assistant', content: INITIAL_GREETING }]);
      setReadiness({ ready: false, covered: [], missing: [...READINESS_AREAS] });
      setError(null);
      setHasStartedSession(false);
      productClubReportedRef.current = new Set();
    } else {
      trackModeSwitched(mode, next);
      setMode(next);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending || generating) return;

    setError(null);
    const nextMessages: UIMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setDraft('');
    setSending(true);

    if (!hasStartedSession) {
      trackSessionStarted(mode);
      setHasStartedSession(true);
    }
    trackMessageSent({ sessionId, mode, turnNumber: userTurnCount + 1 });

    try {
      // Send only the post-greeting transcript to the API; the greeting is UI-only.
      const apiMessages = nextMessages
        .filter(m => !(m.role === 'assistant' && m.content === INITIAL_GREETING))
        .map(m => ({ role: m.role, content: m.content }));

      const { message, readiness: r } = await sendChat({
        sessionId,
        mode,
        messages: apiMessages,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
      setReadiness(r);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      setError(message);
      // Restore the user's draft so they don't lose it on a recoverable error.
      setDraft(text);
      setMessages(prev => prev.slice(0, prev.length - 1));
    } finally {
      setSending(false);
    }
  };

  const runGenerate = async (generateAnyway: boolean) => {
    if (generating) return;
    setError(null);
    setGenerating(true);
    setShowGenerateModal(false);
    if (generateAnyway) {
      trackGenerateAnywayClicked({ sessionId, areasMissing: readiness.missing });
    }
    try {
      await generateDoc({ sessionId, generateAnyway });
      trackDocGenerated({ sessionId, mode, chatTurns: userTurnCount });
      navigate(`/validator/${sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed.');
      setGenerating(false);
    }
  };

  const handleGenerateClick = () => {
    if (generating) return;
    if (readiness.ready) {
      void runGenerate(false);
      return;
    }
    setShowGenerateModal(true);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '1rem',
      maxWidth: '46rem', margin: '0 auto', minHeight: 'calc(100vh - 12rem)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>
            New validation
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: '0.125rem 0 0' }}>
            One question at a time. Aim for ~5–7 messages, then generate.
          </p>
        </div>
        <ModeToggle mode={mode} onChange={handleModeChange} disabled={sending || generating} />
      </div>

      {/* Progress indicator */}
      <ProgressIndicator readiness={readiness} />

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          padding: '0.5rem 0.25rem 1rem',
          minHeight: '20rem',
        }}
      >
        {messages.map((m, i) => <ChatBubble key={i} role={m.role} content={m.content} />)}
        {sending && <TypingIndicator />}
      </div>

      {error && (
        <div style={{
          backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5',
          borderRadius: '12px', padding: '0.75rem 1rem',
          color: '#B91C1C', fontSize: '0.875rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        }}>
          <span>{error}</span>
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            style={{
              padding: '0.375rem 0.75rem', borderRadius: '8px', border: '1px solid #B91C1C',
              backgroundColor: 'transparent', color: '#B91C1C', cursor: 'pointer',
              fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Generate gate — always clickable */}
      <GenerateGate
        ready={readiness.ready}
        loading={generating}
        onClick={handleGenerateClick}
      />

      {/* Composer */}
      <div style={{
        position: 'sticky', bottom: 0, backgroundColor: '#F8F9FE',
        paddingTop: '0.5rem',
      }}>
        <div style={{
          display: 'flex', gap: '0.5rem', alignItems: 'flex-end',
          backgroundColor: 'white', borderRadius: '14px',
          border: '1px solid #E5E7EB', padding: '0.5rem 0.5rem 0.5rem 0.875rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
        }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder={sending ? 'Waiting…' : 'Type your answer. Cmd/Ctrl+Enter to send.'}
            rows={2}
            disabled={sending || generating}
            style={{
              flex: 1, border: 'none', outline: 'none', resize: 'none',
              fontFamily: 'inherit', fontSize: '0.9375rem', color: '#1F2937',
              backgroundColor: 'transparent', padding: '0.5rem 0', lineHeight: 1.5,
              minHeight: '2.5rem', maxHeight: '12rem',
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || generating || !draft.trim()}
            aria-label="Send"
            style={{
              padding: '0.625rem', borderRadius: '10px', border: 'none',
              backgroundColor: !draft.trim() || sending || generating ? '#D1D5DB' : '#4A5FC1',
              color: 'white', cursor: !draft.trim() || sending || generating ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Soft-confirm modal for "generate anyway" */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Generate before you're done?"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
            <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
            <p style={{ margin: 0, fontSize: '0.9375rem', color: '#374151', lineHeight: 1.55 }}>
              You have <strong>{readiness.covered.length} of {READINESS_AREAS.length}</strong> areas covered.
              The build prompt will include assumptions for the gaps and flag them so you can fix them later.
            </p>
          </div>

          {readiness.missing.length > 0 && (
            <div>
              <p style={{ margin: '0 0 0.375rem', fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Missing
              </p>
              <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {readiness.missing.map(m => (
                  <li key={m} style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                    {READINESS_AREA_LABELS[m]}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
            <Button variant="ghost" size="sm" onClick={() => setShowGenerateModal(false)}>
              Keep talking
            </Button>
            <Button size="sm" onClick={() => void runGenerate(true)} disabled={generating}>
              {generating ? 'Generating…' : 'Generate anyway'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function mentionsProductClub(text: string): boolean {
  return /product\s*\.?\s*club/i.test(text);
}

function ProgressIndicator({ readiness }: { readiness: ValidatorReadiness }) {
  const total = READINESS_AREAS.length;
  const done  = readiness.covered.length;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.625rem 0.875rem', borderRadius: '10px',
      backgroundColor: 'white', border: '1px solid #E5E7EB',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937' }}>
            {done} of {total} areas covered
          </span>
          {readiness.missing.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
              Missing: {readiness.missing.map(a => READINESS_AREA_LABELS[a]).join(' · ')}
            </span>
          )}
        </div>
        <div style={{
          height: 4, borderRadius: 999, backgroundColor: '#F3F4F6', overflow: 'hidden',
        }}>
          <motion.div
            initial={false}
            animate={{ width: `${(done / total) * 100}%` }}
            transition={{ duration: 0.3 }}
            style={{
              height: '100%',
              backgroundColor: readiness.ready ? '#10B981' : '#4A5FC1',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: '14px', padding: '0.75rem 1rem',
        display: 'flex', gap: '0.25rem', alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
            style={{
              width: 6, height: 6, borderRadius: '50%', backgroundColor: '#9CA3AF',
              display: 'inline-block',
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface GenerateGateProps {
  ready: boolean;
  loading: boolean;
  onClick: () => void;
}

function GenerateGate({ ready, loading, onClick }: GenerateGateProps) {
  const wrapper = {
    display: 'flex', alignItems: 'center', gap: '0.625rem',
    padding: '0.875rem 1rem', borderRadius: '12px',
    backgroundColor: ready ? '#ECFDF5' : '#F9FAFB',
    border: `1px solid ${ready ? '#A7F3D0' : '#E5E7EB'}`,
  };

  return (
    <div style={wrapper}>
      <Sparkles size={18} color={ready ? '#047857' : '#9CA3AF'} />
      <div style={{ flex: 1 }}>
        <p style={{
          margin: 0, fontSize: '0.875rem', fontWeight: 600,
          color: ready ? '#065F46' : '#374151',
        }}>
          {ready
            ? "Ready when you are — I'll write the hypothesis and the build prompt."
            : "Generate Build Prompt"}
        </p>
        {!ready && (
          <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#9CA3AF' }}>
            You can generate any time. Gaps will be flagged as assumptions.
          </p>
        )}
      </div>
      <Button onClick={onClick} disabled={loading} variant={ready ? 'primary' : 'outline'} size="sm">
        {loading ? 'Generating…' : 'Generate Build Prompt'}
      </Button>
    </div>
  );
}
