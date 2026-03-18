import { AnimatePresence, motion } from 'motion/react';
import { X, MessageSquare, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { type TriggerName } from '../../lib/FrictionDetector';
import { type FrictionFeedbackState } from '../../hooks/useFrictionFeedback';

// ─── copy ─────────────────────────────────────────────────────────────────────

const TRIGGER_PROMPT: Record<TriggerName, string> = {
  exit_intent:  'Heading out? Did something feel off?',
  time_stall:   'Feeling stuck? What got in the way?',
  scroll_stall: 'Something catch your eye — or lose it?',
  no_action:    'Not sure where to start?',
};

const TRIGGER_OPTIONS: Record<TriggerName, string[]> = {
  exit_intent:  ['Too expensive', 'Not useful yet', 'Confusing', 'Just browsing'],
  time_stall:   ['Lost my flow', 'Confusing UI', 'Not sure what to do', 'Thinking it over'],
  scroll_stall: ['Too much info', 'Looking for something', 'Interesting but unclear', 'Just exploring'],
  no_action:    ['Not sure where to start', 'Just exploring', 'Confusing', 'Too much to take in'],
};

export const SOCIAL_PROOF: Record<string, { pct: number; note: string }> = {
  'Too expensive':           { pct: 71, note: "Pricing is on our roadmap." },
  'Not useful yet':          { pct: 58, note: "We're making value clearer." },
  'Confusing':               { pct: 74, note: "Simplicity is our next focus." },
  'Just browsing':           { pct: 62, note: "Come back anytime — no pressure." },
  'Lost my flow':            { pct: 65, note: "We're smoothing the flow." },
  'Confusing UI':            { pct: 74, note: "Simplicity is our next focus." },
  'Not sure what to do':     { pct: 69, note: "Clearer guidance is coming." },
  'Thinking it over':        { pct: 55, note: "We'll be here when you're ready." },
  'Too much info':           { pct: 67, note: "Better information density is in the works." },
  'Looking for something':   { pct: 61, note: "We'd love to know — you just told us." },
  'Interesting but unclear': { pct: 72, note: "Clearer explanations coming soon." },
  'Just exploring':          { pct: 59, note: "Explore freely — no expectations." },
  'Not sure where to start': { pct: 77, note: "Better onboarding is on the way." },
  'Too much to take in':     { pct: 64, note: "We're simplifying the experience." },
};

const FALLBACK_PROOF = { pct: 65, note: "We're listening and improving." };

// ─── styles ───────────────────────────────────────────────────────────────────

const S = {
  wrapper: {
    position: 'fixed' as const,
    bottom: '1.5rem',
    left: '50%',
    zIndex: 200,
    width: '100%',
    maxWidth: '26rem',
    padding: '0 1rem',
    pointerEvents: 'none' as const,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
    padding: '1.125rem 1.25rem 1rem',
    pointerEvents: 'auto' as const,
    border: '1px solid rgba(74,95,193,0.1)',
  },
  header: {
    display: 'flex' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  promptRow: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '0.5rem',
  },
  prompt: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#1F2937',
    lineHeight: 1.4,
  },
  closeBtn: {
    padding: '0.25rem',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    borderRadius: '6px',
    display: 'flex' as const,
    flexShrink: 0,
    color: '#9CA3AF',
  },
  chips: {
    display: 'flex' as const,
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
  },
  chip: (): React.CSSProperties => ({
    padding: '0.4rem 0.85rem',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 500,
    border: '1.5px solid #E5E7EB',
    backgroundColor: '#F9FAFB',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }),
  trust: {
    marginTop: '0.75rem',
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '0.375rem',
    fontSize: '0.72rem',
    color: '#9CA3AF',
  },
  // ── submitted phase
  validationWrap: {
    display: 'flex' as const,
    alignItems: 'flex-start' as const,
    gap: '0.75rem',
  },
  pctBadge: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: '#4A5FC1',
    lineHeight: 1.2,
  },
  pctLabel: {
    fontSize: '0.82rem',
    color: '#4B5563',
    marginTop: '0.15rem',
    lineHeight: 1.4,
  },
  actionLine: {
    marginTop: '0.25rem',
    fontSize: '0.78rem',
    fontWeight: 500,
    color: '#6B7280',
  },
  ptsBadge: {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: '0.25rem',
    marginTop: '0.5rem',
    padding: '0.25rem 0.6rem',
    borderRadius: '999px',
    backgroundColor: '#FEF3C7',
    border: '1px solid #FDE68A',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#D97706',
  },
};

// ─── component ────────────────────────────────────────────────────────────────

interface Props extends Pick<FrictionFeedbackState, 'status' | 'event' | 'selectedOption' | 'pointsEarned' | 'submit' | 'dismiss'> {}

export default function FrictionFeedbackWidget({ status, event, selectedOption, pointsEarned, submit, dismiss }: Props) {
  const trigger = event?.trigger ?? 'time_stall';
  const options = TRIGGER_OPTIONS[trigger as TriggerName] ?? TRIGGER_OPTIONS.time_stall;
  const proof   = selectedOption ? (SOCIAL_PROOF[selectedOption] ?? FALLBACK_PROOF) : FALLBACK_PROOF;

  return (
    <AnimatePresence>
      {(status === 'visible' || status === 'submitted') && (
        <div style={S.wrapper}>
          <motion.div
            style={{ translateX: '-50%' }}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div style={S.card}>
              <AnimatePresence mode="wait">

                {/* ── Phase 1: prompt + chips ── */}
                {status === 'visible' && (
                  <motion.div
                    key="prompt"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{    opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div style={S.header}>
                      <div style={S.promptRow}>
                        <MessageSquare size={15} color="#4A5FC1" style={{ flexShrink: 0 }} />
                        <span style={S.prompt}>{TRIGGER_PROMPT[trigger as TriggerName]}</span>
                      </div>
                      <button style={S.closeBtn} onClick={dismiss} aria-label="Dismiss">
                        <X size={15} />
                      </button>
                    </div>

                    <div style={S.chips}>
                      {options.map((opt) => {
                        const pct = (SOCIAL_PROOF[opt] ?? FALLBACK_PROOF).pct;
                        return (
                          <motion.button
                            key={opt}
                            style={S.chip()}
                            whileHover={{ scale: 1.03, borderColor: '#4A5FC1', backgroundColor: '#EEF0FB', color: '#4A5FC1' }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => submit(opt, pct)}
                          >
                            {opt}
                          </motion.button>
                        );
                      })}
                    </div>

                    <div style={S.trust}>
                      <ShieldCheck size={12} color="#9CA3AF" />
                      <span>No tracking · Anonymous · You control your data</span>
                    </div>
                  </motion.div>
                )}

                {/* ── Phase 2: instant validation + rep gain ── */}
                {status === 'submitted' && (
                  <motion.div
                    key="validation"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{    opacity: 0      }}
                    transition={{ duration: 0.22 }}
                  >
                    <div style={S.validationWrap}>
                      <div style={{ marginTop: '0.1rem', flexShrink: 0 }}>
                        <CheckCircle2 size={22} color="#4A5FC1" />
                      </div>
                      <div>
                        <div style={S.pctBadge}>{proof.pct}% of users agree</div>
                        <div style={S.pctLabel}>"{selectedOption}"</div>
                        <div style={S.actionLine}>{proof.note} Thanks 💙</div>

                        {/* Reputation gain micro-badge */}
                        <div style={S.ptsBadge}>
                          <Zap size={11} />
                          +{pointsEarned} influence pts · check your Insights
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
