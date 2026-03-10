import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Send, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, Edit3, ArrowRight, BookOpen,
  Zap, Clock, SkipForward, RefreshCw, TrendingUp,
  FlaskConical, Star, ChevronRight, Copy, Check,
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/common/Button';
import { useApp } from '../context/AppContext';
import { useJournalAnalysis } from '../hooks/useJournalAnalysis';
import { useTasteExercise } from '../hooks/useTasteExercise';
import { callClaudeMessages, parseActionResponse } from '../services/claudeApi';
import { EMOTIONS, getEmotionColor } from '../utils/emotionHelpers';
import type { EmotionType, EventType, JournalReflection, TasteExercise } from '../types';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const INITIAL_CHAT_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: "Hey! I'm here to listen. What's been on your mind at work lately? Share anything — big or small, and we'll make sense of it together.",
};

const CHAT_FOLLOWUP_SYSTEM_PROMPT = `You are Hello-EQ, an empathetic AI journaling coach helping someone reflect on their work emotions and career experiences.

Based on what the user has shared so far in this journaling session, ask ONE thoughtful follow-up question that:
- Helps them go deeper into their emotional experience at work
- Is specific and personal to what they've shared (not generic)
- Is empathetic, curious, and non-judgmental
- Opens up a new dimension of reflection they haven't yet explored
- Is concise (1–2 sentences max)

Respond with ONLY the question text. No preamble, no sign-off, no explanation.`;

const EVENT_TYPES: EventType[] = [
  'Meeting', 'Project', 'Review', 'Interview', 'Promotion',
  'Feedback', 'Presentation', 'Deadline', 'Conflict', 'Achievement', 'Learning', 'Other',
];

const COMPANION_QUESTIONS = [
  "What's been on your mind at work?",
  "How did things go today?",
  "What's been draining your energy lately?",
  "Anything you're proud of recently?",
  "What's making you feel uncertain right now?",
  "How are you really feeling about your work?",
];

const STARTER_PROMPTS = [
  { label: 'Tough meeting', text: 'I had a tough meeting today — ', icon: '📅' },
  { label: 'Feeling proud', text: "I'm feeling proud because ", icon: '🌟' },
  { label: 'Anxious about', text: "I've been anxious about ", icon: '😟' },
  { label: 'Got feedback', text: 'I received feedback today that ', icon: '💬' },
  { label: 'Low energy', text: 'My energy has been low because ', icon: '🔋' },
  { label: 'Big win', text: 'Something went really well — ', icon: '🎉' },
  { label: 'Deadline stress', text: "There's a deadline coming up and ", icon: '⏰' },
  { label: 'Team tension', text: "There's tension with someone at work — ", icon: '🤝' },
];


const CATEGORY_COLORS: Record<string, string> = {
  'Stress Relief': '#34D399',
  'Confidence Building': '#8B5CF6',
  'Energy Boost': '#F59E0B',
  'Reflection': '#3B82F6',
  'Grounding': '#6EE7B7',
  'Gratitude': '#84CC16',
  'Self-Care': '#EC4899',
};

type Phase = 'writing' | 'analyzing' | 'review' | 'success';

export default function HomePage() {
  const { state, addEmotion, addEvent, addReflection, updateReflection, completeAction, skipAction, dismissAction, refreshActions, addTasteExercise, llmState, checkAndUseAi } = useApp();
  const { analysisState, analyzeJournal, resetAnalysis } = useJournalAnalysis();
  const te = useTasteExercise();

  const [phase, setPhase] = useState<Phase>('writing');
  const [journalText, setJournalText] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [skipConfirmId, setSkipConfirmId] = useState<string | null>(null);

  // Growth pillar state (Product Taste + EI + AI/Tech)
  const [productTarget, setProductTarget] = useState('');
  const [productTargetDraft, setProductTargetDraft] = useState('');
  const [productTargetEditing, setProductTargetEditing] = useState(false);
  const [coworkerTargetDraft, setCoworkerTargetDraft] = useState('');
  const [coworkerTargetEditing, setCoworkerTargetEditing] = useState(false);
  const [careerTargetDraft, setCareerTargetDraft] = useState('');
  const [careerTargetEditing, setCareerTargetEditing] = useState(false);
  const [productFitSummary, setProductFitSummary] = useState('');
  const [productRecs, setProductRecs] = useState<string[]>([]);
  const [productRecsLoading, setProductRecsLoading] = useState(false);
  const [coworkerTarget, setCoworkerTarget] = useState('');
  const [eiSummary, setEiSummary] = useState('');
  const [careerTarget, setCareerTarget] = useState('');
  const [aiProjectSummary, setAiProjectSummary] = useState('');
  const [selectedPillar, setSelectedPillar] = useState<'product' | 'eq' | 'ai' | null>(null);

  // LinkedIn post generator state
  const [linkedInModalOpen, setLinkedInModalOpen] = useState(false);
  const [linkedInPostType, setLinkedInPostType] = useState<'emotional' | 'product' | 'mixed'>('mixed');
  const [linkedInPrompt, setLinkedInPrompt] = useState('');
  const [linkedInPost, setLinkedInPost] = useState('');
  const [linkedInLoading, setLinkedInLoading] = useState(false);
  const [linkedInCopied, setLinkedInCopied] = useState(false);

  // Taste Exercise local state
  const [teOpen, setTeOpen] = useState(false);
  const [teProductInput, setTeProductInput] = useState('');
  const [teCurrentAnswer, setTeCurrentAnswer] = useState('');

  // Chat journal state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([INITIAL_CHAT_MESSAGE]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const toggleReasoning = (id: string) => {
    setExpandedReasoning(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (journalText) return;
    const timer = setInterval(() => {
      setQuestionIdx(i => (i + 1) % COMPANION_QUESTIONS.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [journalText]);

  // Load growth pillar data from localStorage
  useEffect(() => {
    try {
      const focusRaw = localStorage.getItem('heq_control_focus');
      if (focusRaw) {
        const f = JSON.parse(focusRaw);
        setProductTarget(f.product || '');
        setCoworkerTarget(f.coworker || '');
        setCareerTarget(f.career || '');
      }
    } catch { /* ignore */ }
    try {
      const scenarioRaw = localStorage.getItem('heq_ideal_scenario');
      if (scenarioRaw) {
        const s = JSON.parse(scenarioRaw);
        setProductFitSummary(s.productProfile?.headline || '');
        setEiSummary(s.coworkerProfile?.headline || '');
        setAiProjectSummary(s.automationProjects?.[0]?.title || '');
      }
    } catch { /* ignore */ }
  }, []);

  const saveProductTarget = (val: string) => {
    try {
      const raw = localStorage.getItem('heq_control_focus');
      const existing = raw ? JSON.parse(raw) : {};
      localStorage.setItem('heq_control_focus', JSON.stringify({ ...existing, product: val }));
      setProductTarget(val);
    } catch { /* ignore */ }
  };

  const saveCoworkerTarget = (val: string) => {
    try {
      const raw = localStorage.getItem('heq_control_focus');
      const existing = raw ? JSON.parse(raw) : {};
      localStorage.setItem('heq_control_focus', JSON.stringify({ ...existing, coworker: val }));
      setCoworkerTarget(val);
    } catch { /* ignore */ }
  };

  const saveCareerTarget = (val: string) => {
    try {
      const raw = localStorage.getItem('heq_control_focus');
      const existing = raw ? JSON.parse(raw) : {};
      localStorage.setItem('heq_control_focus', JSON.stringify({ ...existing, career: val }));
      setCareerTarget(val);
    } catch { /* ignore */ }
  };

  const handleGetProductRecs = async () => {
    if (!checkAndUseAi()) return;
    setProductRecsLoading(true);
    try {
      const systemPrompt = `You are a product career advisor. Based on a user's current product fit profile and their target product direction, suggest 5 specific products or product categories they should analyze next to build relevant taste and intuition. Return ONLY a JSON array of 5 strings, each a concise product name. Example: ["Figma","Linear","Notion AI","Vercel","Supabase"]`;
      const userMsg = `Current product fit: ${productFitSummary || 'Not yet analyzed'}\nTarget direction: ${productTarget || 'Not set yet'}\nPast exercises: ${state.tasteExercises.slice(0, 5).map(e => e.productName).join(', ') || 'None yet'}`;
      const resp = await callClaudeMessages(systemPrompt, [{ role: 'user', content: userMsg }], 200);
      const text = parseActionResponse(resp);
      const match = text.match(/\[[\s\S]*\]/);
      if (match) setProductRecs(JSON.parse(match[0]));
    } catch { /* ignore */ } finally {
      setProductRecsLoading(false);
    }
  };

  // Manual overrides
  const [manualEmotion, setManualEmotion] = useState<EmotionType | null>(null);
  const [manualEventType, setManualEventType] = useState<EventType | null>(null);
  const [manualCompany, setManualCompany] = useState('');

  // Review editable fields
  const [reviewEmotion, setReviewEmotion] = useState<EmotionType>('Stress');
  const [reviewIntensity, setReviewIntensity] = useState(5);
  const [reviewEventType, setReviewEventType] = useState<EventType | null>(null);
  const [reviewCompany, setReviewCompany] = useState('');
  const [reflectionId, setReflectionId] = useState('');

  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const handleAnalyze = async (textOverride?: string) => {
    const text = textOverride ?? journalText;
    if (!text.trim()) return;
    if (!checkAndUseAi()) return;
    if (textOverride) setJournalText(textOverride);
    setPhase('analyzing');

    const id = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setReflectionId(id);

    // Save draft reflection
    const draft: JournalReflection = {
      id,
      text,
      timestamp: new Date().toISOString(),
      status: 'draft',
    };
    addReflection(draft);

    const approvedReflections = state.reflections.filter(r => r.status === 'approved');
    const result = await analyzeJournal(text, state.user, approvedReflections);

    if (result) {
      // Use manual overrides if provided, otherwise use detected
      const emotion = (manualEmotion || result.emotion) as EmotionType;
      const eventType = manualEventType || (result.eventType as EventType | null);
      const company = manualCompany || result.companyName || '';

      setReviewEmotion(emotion);
      setReviewIntensity(result.intensity);
      setReviewEventType(eventType);
      setReviewCompany(company);

      updateReflection(id, {
        status: 'analyzed',
        detectedEmotion: result.emotion as EmotionType,
        detectedIntensity: result.intensity,
        detectedEventType: result.eventType as EventType | undefined,
        detectedCompanyName: result.companyName || undefined,
        detectedTriggers: result.triggers,
        detectedSummary: result.summary,
      });

      setPhase('review');
    } else {
      // Error occurred — go back to writing
      setPhase('writing');
    }
  };

  const handleApprove = () => {
    const emotionId = `emo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const userId = state.user?.id || 'anonymous';

    // Create EmotionEntry
    addEmotion({
      id: emotionId,
      userId,
      emotion: reviewEmotion,
      intensity: reviewIntensity,
      timestamp: new Date().toISOString(),
      notes: journalText,
      triggers: analysisState.result?.triggers,
    });

    let eventId: string | undefined;

    // Create CareerEvent if event type is present
    if (reviewEventType) {
      eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      addEvent({
        id: eventId,
        userId,
        title: reviewCompany
          ? `${reviewEventType} at ${reviewCompany}`
          : reviewEventType,
        type: reviewEventType,
        date: new Date().toISOString(),
        description: analysisState.result?.summary,
        emotionIds: [emotionId],
      });
    }

    // Update reflection as approved
    updateReflection(reflectionId, {
      status: 'approved',
      approvedEmotion: reviewEmotion,
      approvedIntensity: reviewIntensity,
      approvedEventType: reviewEventType || undefined,
      approvedCompanyName: reviewCompany || undefined,
      createdEmotionId: emotionId,
      createdEventId: eventId,
    });

    setPhase('success');
  };

  const handleWriteAnother = () => {
    setJournalText('');
    setManualEmotion(null);
    setManualEventType(null);
    setManualCompany('');
    setShowManual(false);
    setChatMessages([INITIAL_CHAT_MESSAGE]);
    setChatInput('');
    setChatLoading(false);
    resetAnalysis();
    setPhase('writing');
  };

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    if (!checkAndUseAi()) return;
    const updatedMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      const response = await callClaudeMessages(
        CHAT_FOLLOWUP_SYSTEM_PROMPT,
        updatedMessages.map(m => ({ role: m.role, content: m.content })),
        180,
      );
      const question = parseActionResponse(response).trim();
      setChatMessages(prev => [...prev, { role: 'assistant', content: question }]);
    } catch {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: "What else is on your mind about this?",
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleFinishEntry = () => {
    const allUserText = chatMessages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n\n');
    if (!allUserText.trim()) return;
    handleAnalyze(allUserText);
  };

  const handleTeStart = () => {
    if (!teProductInput.trim()) return;
    te.startExercise(teProductInput);
    setTeCurrentAnswer('');
  };

  const handleTeNext = () => {
    if (te.nextQuestion(teCurrentAnswer)) {
      setTeCurrentAnswer('');
    }
  };

  const handleTeFinish = async () => {
    const data = await te.finishEntry(teCurrentAnswer);
    if (data) setTeCurrentAnswer('');
  };

  const handleTeSave = () => {
    if (!te.result) return;
    const exercise: TasteExercise = {
      id: `te_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: state.user?.id || 'anonymous',
      productName: te.productName,
      answers: te.answers,
      summary: te.result.summary,
      score: te.result.score,
      scoreComment: te.result.scoreComment,
      timestamp: new Date().toISOString(),
      status: 'completed',
    };
    addTasteExercise(exercise);
    te.reset();
    setTeOpen(false);
    setTeProductInput('');
    setTeCurrentAnswer('');
  };

  const handleTeClose = () => {
    te.reset();
    setTeOpen(false);
    setTeProductInput('');
    setTeCurrentAnswer('');
  };

  const handleGenerateLinkedIn = async () => {
    if (!checkAndUseAi()) return;
    setLinkedInLoading(true);
    setLinkedInPost('');

    const reflectionsContext = state.reflections
      .filter(r => r.status === 'approved')
      .slice(-5)
      .map(r => `Reflection (${new Date(r.timestamp).toLocaleDateString()}): ${r.text}\nEmotion: ${r.approvedEmotion || r.detectedEmotion || 'unknown'}, Intensity: ${r.approvedIntensity || r.detectedIntensity || '?'}/10\nSummary: ${r.detectedSummary || ''}`)
      .join('\n\n');

    const tasteContext = state.tasteExercises
      .filter(te => te.status === 'completed')
      .slice(-3)
      .map(te => `Product: ${te.productName}\nInsights: ${te.answers.map((a, i) => `Q${i + 1}: ${a}`).join(' | ')}\nSummary: ${te.summary || ''}\nScore: ${te.score}/10 — ${te.scoreComment || ''}`)
      .join('\n\n');

    const BASE_RULES = `Rules:
- Every paragraph is 1–3 lines max. No walls of text.
- Use line breaks generously for readability.
- Avoid corporate jargon, buzzwords, and clichés.
- Never use hashtags or emojis.
- Write exactly as the person would — raw, real, reflective.
- Total post length: 200–350 words.`;

    const systemPrompts: Record<typeof linkedInPostType, string> = {
      emotional: `You are a master LinkedIn ghostwriter for people navigating the messy emotional reality of work. You write in a raw, vulnerable, first-person voice that makes readers feel deeply seen.

Your posts follow this format:
1. HOOK (1–2 lines): A relatable struggle, quiet truth, or moment most people feel but rarely say out loud. No "I" as the first word.
2. THE MOMENT (2–3 short paragraphs): A specific, personal story. What happened. How it felt. The turning point.
3. WHAT IT TAUGHT ME (1–2 paragraphs): The insight — about work, growth, self-awareness, or what it means to show up.
4. THE FEELING UNDERNEATH (1 paragraph): Name the emotion directly. Makes readers feel understood.
5. CTA (1 line): A question that opens a real conversation.

${BASE_RULES}`,

      product: `You are a master LinkedIn ghostwriter for sharp product thinkers — PMs, founders, designers. You write opinionated, specific posts about product craft that make people think differently.

Your posts follow this format:
1. HOOK (1–2 lines): A surprising observation, a contrarian take, or a product truth that stops the scroll. No "I" as the first word.
2. THE OBSERVATION (2–3 short paragraphs): What you noticed. A specific product, interaction, or design decision. Concrete details.
3. THE INSIGHT (1–2 paragraphs): What it reveals about how great products are built. Opinionated and specific — no generic advice.
4. WHY IT MATTERS (1 paragraph): The principle behind the observation. What separates good from great.
5. CTA (1 line): A question that invites other product thinkers to weigh in.

${BASE_RULES}`,

      mixed: `You are a master LinkedIn ghostwriter who crafts posts that go viral among product managers, founders, and builders. You write in an authentic, emotionally resonant first-person voice.

Your posts follow the format of the highest-performing LinkedIn posts:
1. HOOK (1–2 lines): Bold, scroll-stopping opening. A surprising insight, a relatable struggle, or a provocative truth. No "I" as the first word.
2. STORY (3–5 short paragraphs): Personal, specific, human. Show vulnerability or hard-won insight. Short sentences. White space between paragraphs.
3. PRODUCT INSIGHT (1–2 paragraphs): A concrete takeaway about product thinking, design, or building. Specific and opinionated — not generic.
4. EMOTIONAL TRUTH (1 paragraph): The real feeling underneath. Makes readers feel seen.
5. CTA (1 line): A question that invites genuine conversation.

${BASE_RULES}`,
    };

    const contextByType = {
      emotional: reflectionsContext ? `## My recent work reflections:\n${reflectionsContext}` : '',
      product: tasteContext ? `## My recent product taste exercises:\n${tasteContext}` : '',
      mixed: [
        reflectionsContext ? `## My recent work reflections:\n${reflectionsContext}` : '',
        tasteContext ? `## My recent product taste exercises:\n${tasteContext}` : '',
      ].filter(Boolean).join('\n\n'),
    };

    const instructionByType = {
      emotional: 'Write a LinkedIn post that draws entirely from these emotional work reflections. Make it deeply personal, vulnerable, and relatable — like something only I could have written.',
      product: 'Write a LinkedIn post that draws entirely from these product taste observations. Make it sharp, opinionated, and specific — the kind of post that makes product thinkers nod and share.',
      mixed: 'Write a LinkedIn post that weaves together the emotional depth from my reflections and the product sharpness from my taste exercises. Make it feel authentic — like something only I could have written.',
    };

    const userMessage = `${contextByType[linkedInPostType]}

${linkedInPrompt ? `## Additional direction:\n${linkedInPrompt}` : ''}

${instructionByType[linkedInPostType]}`;

    try {
      const response = await callClaudeMessages(
        systemPrompts[linkedInPostType],
        [{ role: 'user', content: userMessage }],
        600,
      );
      setLinkedInPost(parseActionResponse(response).trim());
    } catch {
      setLinkedInPost('Something went wrong generating your post. Please try again.');
    } finally {
      setLinkedInLoading(false);
    }
  };

  const handleCopyLinkedIn = async () => {
    if (!linkedInPost) return;
    await navigator.clipboard.writeText(linkedInPost);
    setLinkedInCopied(true);
    setTimeout(() => setLinkedInCopied(false), 2000);
  };

  const sentimentBadge = (sentiment: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      positive: { bg: '#F0FDF4', color: '#16A34A', label: 'Positive' },
      negative: { bg: '#FEF2F2', color: '#DC2626', label: 'Negative' },
      mixed: { bg: '#FFFBEB', color: '#D97706', label: 'Mixed' },
      neutral: { bg: '#F9FAFB', color: '#6B7280', label: 'Neutral' },
    };
    const s = map[sentiment] || map.neutral;
    return (
      <span style={{
        fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.75rem',
        borderRadius: '999px', backgroundColor: s.bg, color: s.color,
      }}>
        {s.label}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: '48rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* ── GREETING ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', fontWeight: 500, letterSpacing: '0.02em', marginBottom: '0.375rem' }}>
            {dateStr}
          </p>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1F2937', letterSpacing: '-0.025em', lineHeight: 1.2, margin: '0 0 0.875rem' }}>
            {greeting},{' '}
            {(!state.user?.name || state.user.name === 'Friend')
              ? <><a href="https://www.linkedin.com/in/arunimasharma/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: '#D1D5DB' }}>Arunima</a>'s Friend</>
              : state.user.name}
          </h1>
          <p style={{ fontSize: '0.6875rem', color: '#D1D5DB', margin: '0 0 0.75rem', lineHeight: 1.55 }}>
            Private &amp; on-device.{' '}
            <a
              href="https://docs.google.com/forms/d/1_0dV6E4GZ6ZsMYsH31m74liednuy2D6J8U2JJ45L7Oc/edit"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#D1D5DB', textDecoration: 'underline', textUnderlineOffset: '2px' }}
            >
              Share feedback
            </a>
          </p>
          {(state.reflections.filter(r => r.status === 'approved').length > 0 || state.actions.filter(a => a.completed).length > 0) && (
            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
              {state.reflections.filter(r => r.status === 'approved').length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.25rem 0.75rem', borderRadius: '999px',
                  backgroundColor: 'rgba(74,95,193,0.07)', border: '1px solid rgba(74,95,193,0.12)',
                }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#4A5FC1' }} />
                  <span style={{ fontSize: '0.75rem', color: '#4A5FC1', fontWeight: 500 }}>
                    {state.reflections.filter(r => r.status === 'approved').length} reflection{state.reflections.filter(r => r.status === 'approved').length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {state.actions.filter(a => a.completed).length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.25rem 0.75rem', borderRadius: '999px',
                  backgroundColor: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.12)',
                }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
                  <span style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 500 }}>
                    {state.actions.filter(a => a.completed).length} action{state.actions.filter(a => a.completed).length !== 1 ? 's' : ''} done
                  </span>
                </div>
              )}
            </div>
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ---- WRITING PHASE ---- */}
          {phase === 'writing' && (
            <motion.div
              key="writing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              {/* ── THREE GROWTH PILLARS ── */}
              {(() => {
                const teCount = state.tasteExercises.length;
                const approved = state.reflections.filter(r => r.status === 'approved');
                const lastEmotion = approved[0]?.approvedEmotion;
                const pillars = [
                  { dot: '#7C3AED', label: 'Product Taste', stat: teCount > 0 ? `${teCount} exercise${teCount !== 1 ? 's' : ''}` : 'No exercises yet', target: productTarget, targetColor: '#4F46E5', targetPlaceholder: 'Set a direction below ↓' },
                  { dot: '#4A5FC1', label: 'Emotional IQ (EQ)', stat: approved.length > 0 ? `${approved.length} reflection${approved.length !== 1 ? 's' : ''}${lastEmotion ? ` · ${lastEmotion}` : ''}` : 'Start journaling', target: coworkerTarget, targetColor: '#4A5FC1', targetPlaceholder: eiSummary || 'Set focus below ↓' },
                  { dot: '#059669', label: 'AI & Tech Edge', stat: aiProjectSummary || (careerTarget ? 'Focus set' : 'Not started'), target: careerTarget, targetColor: '#059669', targetPlaceholder: 'Set focus below ↓' },
                ];
                return (
                  <div style={{ display: 'flex', backgroundColor: '#FAFAFA', borderRadius: '16px', border: '1px solid #F0F0F0', overflow: 'hidden' }}>
                    {pillars.map((p, i) => (
                      <div key={p.label} style={{ flex: 1, padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', borderRight: i < 2 ? '1px solid #F0F0F0' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: p.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.label}</span>
                        </div>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937', lineHeight: 1.3 }}>{p.stat}</span>
                        <span style={{ fontSize: '0.6875rem', color: p.target ? p.targetColor : '#C4C9D4', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.target ? `↗ ${p.target.length > 32 ? p.target.slice(0, 32) + '…' : p.target}` : p.targetPlaceholder}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ── PILLAR PICKER ── */}
              {selectedPillar === null && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}
                >
                  <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', fontWeight: 500, margin: 0 }}>
                    What would you like to work on today?
                  </p>
                  {([
                    { id: 'product' as const, emoji: '🧪', gradient: 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)', title: 'Product Taste', desc: 'Analyze a product and sharpen your intuition', accent: '#7C3AED', bg: '#F5F3FF' },
                    { id: 'eq' as const, emoji: '🧠', gradient: 'linear-gradient(135deg, #4A5FC1 0%, #8B7EC8 100%)', title: 'Emotional IQ (EQ)', desc: 'Journal your work emotions and grow self-awareness', accent: '#4A5FC1', bg: '#EFF6FF' },
                    { id: 'ai' as const, emoji: '🤖', gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', title: 'AI & Tech Edge', desc: 'Take action on your AI and tech skill-building', accent: '#059669', bg: '#F0FDF4' },
                  ] as const).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedPillar(opt.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid #F3F4F6', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', transition: 'background-color 0.15s, border-color 0.15s', boxSizing: 'border-box' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = opt.bg; e.currentTarget.style.borderColor = opt.accent + '30'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#F3F4F6'; }}
                    >
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: opt.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.125rem' }}>
                        {opt.emoji}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937', margin: '0 0 0.15rem' }}>{opt.title}</p>
                        <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>{opt.desc}</p>
                      </div>
                      <ChevronRight size={16} color="#D1D5DB" style={{ flexShrink: 0 }} />
                    </button>
                  ))}
                </motion.div>
              )}


              {selectedPillar === 'product' && (
                <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #EDE9FE', overflow: 'hidden', boxShadow: '0 2px 12px rgba(124,58,237,0.06)' }}>

                {/* Header row */}
                <div style={{ padding: '0.875rem 1.25rem', borderBottom: teOpen ? '1px solid #F3F4F6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FlaskConical size={14} color="white" />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1F2937' }}>Product Taste</span>
                      {state.tasteExercises.length > 0 && (
                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: '#F5F3FF', color: '#7C3AED', marginLeft: '0.4rem' }}>
                          {state.tasteExercises.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Link to="/growth" style={{ fontSize: '0.6875rem', color: '#C4B5FD', textDecoration: 'none', fontWeight: 500 }}>Goals →</Link>
                    {teOpen && te.tePhase !== 'analyzing' && (
                      <button onClick={handleTeClose} style={{ fontSize: '0.8125rem', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        Close
                      </button>
                    )}
                    {!teOpen && (
                      <button
                        onClick={() => setTeOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.875rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)', color: 'white', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Start <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Direction + progress + history — shown when exercise is NOT open */}
                {!teOpen && (
                  <div style={{ padding: '0.875rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                    {/* Working toward row */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Working toward</span>
                      {productTargetEditing ? (
                        <textarea
                          autoFocus
                          value={productTargetDraft}
                          onChange={e => setProductTargetDraft(e.target.value)}
                          onBlur={() => { saveProductTarget(productTargetDraft); setProductTargetEditing(false); }}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveProductTarget(productTargetDraft); setProductTargetEditing(false); } }}
                          style={{ width: '100%', boxSizing: 'border-box', resize: 'none', padding: '0.625rem 0.75rem', borderRadius: '10px', border: '1.5px solid #DDD6FE', fontSize: '0.8125rem', color: '#374151', fontFamily: 'inherit', outline: 'none', lineHeight: 1.45, minHeight: '52px', backgroundColor: '#FAFAFA' }}
                        />
                      ) : (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => { setProductTargetDraft(productTarget); setProductTargetEditing(true); }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setProductTargetDraft(productTarget); setProductTargetEditing(true); } }}
                          style={{ cursor: 'text', padding: '0.625rem 0.75rem', borderRadius: '10px', border: '1.5px dashed #DDD6FE', backgroundColor: '#FAFAFA', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}
                        >
                          <span style={{ fontSize: '0.875rem', color: productTarget ? '#4F46E5' : '#C4B5FD', fontStyle: productTarget ? 'normal' : 'italic', fontWeight: productTarget ? 500 : 400, lineHeight: 1.45, flex: 1 }}>
                            {productTarget || 'What type of products do you want to master?'}
                          </span>
                          <Edit3 size={13} color="#C4B5FD" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                        </div>
                      )}
                    </div>

                    {/* Progress dots */}
                    {(() => {
                      const count = state.tasteExercises.length;
                      const milestone = 5;
                      const filled = Math.min(count, milestone);
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          {Array.from({ length: milestone }, (_, i) => (
                            <div key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: i < filled ? '#7C3AED' : '#EDE9FE', transition: 'background-color 0.3s ease', flexShrink: 0 }} />
                          ))}
                          <span style={{ fontSize: '0.6875rem', color: '#8B5CF6', marginLeft: '0.25rem' }}>
                            {count < milestone ? `${milestone - count} more to full profile` : 'Profile ready ✓'}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Recent exercises inline */}
                    {state.tasteExercises.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recent</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                          {state.tasteExercises.slice(0, 4).map(ex => {
                            const scoreColor = ex.score >= 8 ? '#16A34A' : ex.score >= 6 ? '#D97706' : '#DC2626';
                            const scoreBg = ex.score >= 8 ? '#F0FDF4' : ex.score >= 6 ? '#FFFBEB' : '#FEF2F2';
                            return (
                              <span key={ex.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.25rem 0.625rem', backgroundColor: '#FAFAFA', border: '1px solid #F3F4F6', borderRadius: '999px', color: '#374151' }}>
                                {ex.productName}
                                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: scoreColor, backgroundColor: scoreBg, padding: '0.05rem 0.3rem', borderRadius: '4px' }}>{ex.score}/10</span>
                              </span>
                            );
                          })}
                          {state.tasteExercises.length > 4 && (
                            <Link to="/insights" style={{ fontSize: '0.75rem', color: '#7C3AED', textDecoration: 'none', padding: '0.25rem 0.5rem', alignSelf: 'center' }}>
                              +{state.tasteExercises.length - 4} more →
                            </Link>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Recommended products */}
                    {productRecs.length > 0 ? (
                      <div>
                        <span style={{ fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Explore next</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.3rem' }}>
                          {productRecs.map((rec, i) => (
                            <span key={i} style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem', backgroundColor: '#EEF2FF', color: '#4F46E5', borderRadius: '999px', fontWeight: 500 }}>
                              {rec}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleGetProductRecs}
                        disabled={productRecsLoading}
                        style={{ alignSelf: 'flex-start', border: '1px dashed #DDD6FE', backgroundColor: 'transparent', color: '#7C3AED', fontSize: '0.75rem', padding: '0.375rem 0.75rem', borderRadius: '8px', cursor: productRecsLoading ? 'default' : 'pointer', fontFamily: 'inherit', opacity: productRecsLoading ? 0.6 : 1 }}
                      >
                        {productRecsLoading ? 'Generating…' : '✦ Suggest products to explore next'}
                      </button>
                    )}
                  </div>
                )}

                {/* Exercise phases — shown when teOpen */}
                <AnimatePresence mode="wait">
                  {/* Product select */}
                  {teOpen && te.tePhase === 'product-select' && (
                    <motion.div
                      key="te-product-select"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid #F3F4F6' }}
                    >
                      <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0.875rem 0' }}>
                        What product or service would you like to analyze?
                      </p>
                      <div style={{ display: 'flex', gap: '0.625rem' }}>
                        <input
                          type="text"
                          value={teProductInput}
                          onChange={e => setTeProductInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleTeStart(); }}
                          placeholder="e.g. Notion, Spotify, Apple Maps..."
                          autoFocus
                          style={{ flex: 1, padding: '0.625rem 0.875rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.875rem', fontFamily: 'inherit', color: '#1F2937', outline: 'none' }}
                        />
                        <button
                          onClick={handleTeStart}
                          disabled={!teProductInput.trim()}
                          style={{ padding: '0.625rem 1.125rem', borderRadius: '10px', border: 'none', background: teProductInput.trim() ? 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)' : '#E5E7EB', color: teProductInput.trim() ? 'white' : '#9CA3AF', fontSize: '0.875rem', fontWeight: 600, cursor: teProductInput.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}
                        >
                          Start
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Questioning */}
                  {teOpen && te.tePhase === 'questioning' && (
                    <motion.div
                      key="te-questioning"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid rgba(124,58,237,0.15)', overflow: 'hidden' }}
                    >
                      <div style={{ padding: '0.875rem 1.25rem', background: 'linear-gradient(135deg, rgba(124,58,237,0.05) 0%, rgba(139,126,200,0.08) 100%)', borderBottom: '1px solid rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <FlaskConical size={14} color="#7C3AED" />
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#7C3AED' }}>{te.productName}</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Q{te.questionIdx + 1} of {te.totalQuestions}</span>
                      </div>
                      <div style={{ height: '2px', backgroundColor: '#F3F4F6' }}>
                        <div style={{ height: '100%', backgroundColor: '#7C3AED', width: `${((te.questionIdx) / te.totalQuestions) * 100}%`, transition: 'width 0.3s ease' }} />
                      </div>
                      <div style={{ padding: '1.25rem' }}>
                        <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: '#1F2937', lineHeight: 1.5, margin: '0 0 0.875rem' }}>{te.currentQuestion}</p>
                        <textarea
                          value={teCurrentAnswer}
                          onChange={e => setTeCurrentAnswer(e.target.value)}
                          placeholder="Type your answer here..."
                          autoFocus
                          style={{ width: '100%', minHeight: '90px', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '0.75rem', fontSize: '0.875rem', lineHeight: 1.6, color: '#1F2937', resize: 'none', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                        />
                        {te.error && <p style={{ fontSize: '0.8125rem', color: '#DC2626', margin: '0.5rem 0 0' }}>{te.error}</p>}
                        <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.875rem', justifyContent: 'flex-end' }}>
                          {!te.isLastQuestion && (
                            <button onClick={handleTeNext} disabled={!teCurrentAnswer.trim()} style={{ padding: '0.5rem 1.125rem', borderRadius: '10px', border: 'none', backgroundColor: teCurrentAnswer.trim() ? '#7C3AED' : '#E5E7EB', color: teCurrentAnswer.trim() ? 'white' : '#9CA3AF', fontSize: '0.875rem', fontWeight: 600, cursor: teCurrentAnswer.trim() ? 'pointer' : 'default', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              Next <ChevronRight size={14} />
                            </button>
                          )}
                          <button onClick={handleTeFinish} disabled={te.answers.length === 0 && !teCurrentAnswer.trim()} style={{ padding: '0.5rem 1.125rem', borderRadius: '10px', border: 'none', background: (te.answers.length > 0 || teCurrentAnswer.trim()) ? 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)' : '#E5E7EB', color: (te.answers.length > 0 || teCurrentAnswer.trim()) ? 'white' : '#9CA3AF', fontSize: '0.875rem', fontWeight: 600, cursor: (te.answers.length > 0 || teCurrentAnswer.trim()) ? 'pointer' : 'default', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <Sparkles size={14} /> Analyze
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Analyzing */}
                  {teOpen && te.tePhase === 'analyzing' && (
                    <motion.div key="te-analyzing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid rgba(124,58,237,0.15)', padding: '2rem 1.25rem', textAlign: 'center' }}>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }} style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                        <FlaskConical size={22} color="white" />
                      </motion.div>
                      <p style={{ fontWeight: 600, color: '#1F2937', margin: '0 0 0.25rem' }}>Analyzing your product take...</p>
                      <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>Evaluating depth, specificity, and product intuition</p>
                    </motion.div>
                  )}

                  {/* Done */}
                  {teOpen && te.tePhase === 'done' && te.result && (
                    <motion.div key="te-done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid rgba(124,58,237,0.2)', overflow: 'hidden' }}>
                      <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(139,126,200,0.1) 100%)', borderBottom: '1px solid rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0, background: 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '1.375rem', fontWeight: 800, color: 'white' }}>{te.result.score}</span>
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star key={i} size={14} fill={i < te.result!.score ? '#7C3AED' : 'none'} color={i < te.result!.score ? '#7C3AED' : '#E5E7EB'} />
                            ))}
                          </div>
                          <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0 }}>{te.result.scoreComment}</p>
                        </div>
                      </div>
                      <div style={{ padding: '1.25rem' }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#7C3AED', margin: '0 0 0.625rem' }}>{te.productName} — Analysis</p>
                        <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.65, margin: '0 0 1.125rem', whiteSpace: 'pre-wrap' }}>{te.result.summary}</p>
                        <div style={{ display: 'flex', gap: '0.625rem', paddingTop: '0.875rem', borderTop: '1px solid #F3F4F6' }}>
                          <button onClick={handleTeSave} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.625rem 1.125rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)', color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            <CheckCircle2 size={15} /> Save to Profile
                          </button>
                          <button onClick={handleTeClose} style={{ padding: '0.625rem 1.125rem', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: 'white', color: '#6B7280', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Try Another
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              )}

              {selectedPillar === 'eq' && (
                <>
              {/* ── UNIFIED EMOTIONAL IQ CARD ── */}
              <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #DBEAFE', overflow: 'hidden', boxShadow: '0 2px 12px rgba(74,95,193,0.06)' }}>

                {/* Single continuous body — no internal section breaks */}
                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

                  {/* Title row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #4A5FC1 0%, #8B7EC8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Sparkles size={14} color="white" />
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1F2937' }}>Emotional IQ (EQ)</span>
                      {state.reflections.filter(r => r.status === 'approved').length > 0 && (
                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: '#EFF6FF', color: '#4A5FC1' }}>
                          {state.reflections.filter(r => r.status === 'approved').length}
                        </span>
                      )}
                    </div>
                    <Link to="/insights" style={{ fontSize: '0.6875rem', color: '#BFDBFE', textDecoration: 'none', fontWeight: 500 }}>Insights →</Link>
                  </div>

                  {/* Rotating companion question — flows naturally after the title */}
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={questionIdx}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.3 }}
                      style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: 0, lineHeight: 1.4 }}
                    >
                      {COMPANION_QUESTIONS[questionIdx]}
                    </motion.p>
                  </AnimatePresence>

                  {/* Working toward */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.6875rem', color: '#93C5FD', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Working toward</span>
                      <Link to="/growth" style={{ fontSize: '0.6875rem', color: '#BFDBFE', textDecoration: 'none' }}>Goals →</Link>
                    </div>
                    {coworkerTargetEditing ? (
                      <textarea
                        autoFocus
                        value={coworkerTargetDraft}
                        onChange={e => setCoworkerTargetDraft(e.target.value)}
                        onBlur={() => { saveCoworkerTarget(coworkerTargetDraft); setCoworkerTargetEditing(false); }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveCoworkerTarget(coworkerTargetDraft); setCoworkerTargetEditing(false); } }}
                        style={{ width: '100%', boxSizing: 'border-box', resize: 'none', padding: '0.625rem 0.75rem', borderRadius: '10px', border: '1.5px solid #BFDBFE', fontSize: '0.8125rem', color: '#374151', fontFamily: 'inherit', outline: 'none', lineHeight: 1.45, minHeight: '52px', backgroundColor: '#F8FAFF' }}
                      />
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => { setCoworkerTargetDraft(coworkerTarget); setCoworkerTargetEditing(true); }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setCoworkerTargetDraft(coworkerTarget); setCoworkerTargetEditing(true); } }}
                        style={{ cursor: 'text', padding: '0.625rem 0.75rem', borderRadius: '10px', border: '1.5px dashed #BFDBFE', backgroundColor: '#F8FAFF', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}
                      >
                        <span style={{ fontSize: '0.875rem', color: coworkerTarget ? '#3B82F6' : '#BFDBFE', fontStyle: coworkerTarget ? 'normal' : 'italic', fontWeight: coworkerTarget ? 500 : 400, lineHeight: 1.45, flex: 1 }}>
                          {coworkerTarget || 'What emotional dynamics and culture do you want to grow into?'}
                        </span>
                        <Edit3 size={13} color="#BFDBFE" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                      </div>
                    )}
                  </div>

                  {/* Progress dots + emotion pills in one compact band */}
                  {(() => {
                    const approved = state.reflections.filter(r => r.status === 'approved');
                    const count = approved.length;
                    const milestone = 5;
                    const filled = Math.min(count, milestone);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          {Array.from({ length: milestone }, (_, i) => (
                            <div key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: i < filled ? '#4A5FC1' : '#DBEAFE', transition: 'background-color 0.3s ease', flexShrink: 0 }} />
                          ))}
                          <span style={{ fontSize: '0.6875rem', color: '#93C5FD', marginLeft: '0.25rem', whiteSpace: 'nowrap' }}>
                            {count < milestone ? `${milestone - count} more to full profile` : `${count} reflections ✓`}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Starter prompt chips — only before first user message */}
                  {!chatMessages.some(m => m.role === 'user') && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '2px' }}>
                      {STARTER_PROMPTS.slice(0, 4).map((prompt) => (
                        <button
                          key={prompt.label}
                          onClick={() => setChatInput(chatInput ? chatInput : prompt.text)}
                          style={{ padding: '0.375rem 0.75rem', borderRadius: '999px', border: '1.5px solid #E5E7EB', backgroundColor: 'white', fontSize: '0.8125rem', color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#8B7EC8'; e.currentTarget.style.color = '#4A5FC1'; e.currentTarget.style.backgroundColor = 'rgba(74,95,193,0.04)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.backgroundColor = 'white'; }}
                        >
                          <span>{prompt.icon}</span> {prompt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Chat messages */}
                  {chatMessages.length > 0 && (
                    <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <AnimatePresence initial={false}>
                        {chatMessages.map((msg, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '0.5rem' }}
                          >
                            {msg.role === 'assistant' && (
                              <img src="/logo.svg" alt="Hello-EQ" style={{ width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0, objectFit: 'cover' }} />
                            )}
                            <div style={{ maxWidth: '78%', padding: '0.625rem 0.875rem', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', backgroundColor: msg.role === 'user' ? '#4A5FC1' : '#F3F4F6', color: msg.role === 'user' ? 'white' : '#1F2937', fontSize: '0.9rem', lineHeight: 1.55 }}>
                              {msg.content}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {chatLoading && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                          <img src="/logo.svg" alt="Hello-EQ" style={{ width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0, objectFit: 'cover' }} />
                          <div style={{ padding: '0.625rem 0.875rem', borderRadius: '14px 14px 14px 4px', backgroundColor: '#F3F4F6', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            {[0, 1, 2].map(d => (
                              <motion.span key={d} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.2 }} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#9CA3AF', display: 'inline-block' }} />
                            ))}
                          </div>
                        </motion.div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  {/* Input row */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <textarea
                      ref={textareaRef}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                      placeholder="Share what's on your mind…"
                      rows={2}
                      style={{ flex: 1, border: '1px solid #E5E7EB', borderRadius: '12px', padding: '0.625rem 0.875rem', fontSize: '0.9375rem', lineHeight: 1.6, color: '#1F2937', resize: 'none', fontFamily: 'inherit', outline: 'none', backgroundColor: 'white' }}
                    />
                    <button
                      onClick={handleChatSend}
                      disabled={!chatInput.trim() || chatLoading}
                      style={{ width: '40px', height: '40px', borderRadius: '12px', border: 'none', background: chatInput.trim() && !chatLoading ? 'linear-gradient(135deg, #4A5FC1 0%, #8B7EC8 100%)' : '#E5E7EB', cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <Send size={16} color={chatInput.trim() && !chatLoading ? 'white' : '#9CA3AF'} />
                    </button>
                  </div>

                  {/* Finish Entry */}
                  {chatMessages.some(m => m.role === 'user') && (
                    <div style={{ display: 'flex', gap: '0.625rem' }}>
                      <button
                        onClick={handleFinishEntry}
                        disabled={chatLoading}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #4A5FC1 0%, #8B7EC8 100%)', color: 'white', fontSize: '0.8125rem', fontWeight: 600, cursor: chatLoading ? 'default' : 'pointer', fontFamily: 'inherit', opacity: chatLoading ? 0.6 : 1 }}
                      >
                        <CheckCircle2 size={14} /> Finish Entry
                      </button>
                    </div>
                  )}

                </div>
              </div>

              {/* Error banner */}
              {analysisState.error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.875rem 1.25rem', borderRadius: '14px',
                    backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
                  }}
                >
                  <AlertTriangle size={18} style={{ color: '#D97706', flexShrink: 0 }} />
                  <p style={{ fontSize: '0.875rem', color: '#92400E' }}>{analysisState.error}</p>
                </motion.div>
              )}

              {/* ── CUSTOMIZE DETECTION (collapsible) ── */}
              <div style={{
                backgroundColor: 'white', borderRadius: '16px', border: '1px solid #F3F4F6',
                overflow: 'hidden',
              }}>
                <button
                  onClick={() => setShowManual(!showManual)}
                  style={{
                    width: '100%', padding: '0.875rem 1.25rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#9CA3AF' }}>
                    Customize detection
                  </span>
                  {showManual ? <ChevronUp size={15} color="#D1D5DB" /> : <ChevronDown size={15} color="#D1D5DB" />}
                </button>

                {showManual && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
                  >
                    {/* Emotion picker */}
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.5rem', display: 'block' }}>
                        Emotion (override AI detection)
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                        {EMOTIONS.map(e => (
                          <button
                            key={e.type}
                            onClick={() => setManualEmotion(manualEmotion === e.type ? null : e.type)}
                            style={{
                              padding: '0.375rem 0.75rem', borderRadius: '999px', border: '2px solid',
                              borderColor: manualEmotion === e.type ? e.color : '#E5E7EB',
                              backgroundColor: manualEmotion === e.type ? `${e.color}15` : 'white',
                              cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit',
                              color: manualEmotion === e.type ? e.color : '#6B7280',
                              fontWeight: manualEmotion === e.type ? 600 : 400,
                              transition: 'all 0.2s',
                            }}
                          >
                            {e.icon} {e.type}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Event type */}
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.5rem', display: 'block' }}>
                        Career Event Type
                      </label>
                      <select
                        value={manualEventType || ''}
                        onChange={(e) => setManualEventType(e.target.value ? e.target.value as EventType : null)}
                        style={{
                          width: '100%', padding: '0.625rem 0.875rem', borderRadius: '10px',
                          border: '1px solid #E5E7EB', fontSize: '0.875rem', fontFamily: 'inherit',
                          color: '#1F2937', backgroundColor: 'white', outline: 'none',
                        }}
                      >
                        <option value="">Let AI detect</option>
                        {EVENT_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* Company */}
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.5rem', display: 'block' }}>
                        Company / Organization
                      </label>
                      <input
                        type="text"
                        value={manualCompany}
                        onChange={(e) => setManualCompany(e.target.value)}
                        placeholder="Let AI detect or type here"
                        style={{
                          width: '100%', padding: '0.625rem 0.875rem', borderRadius: '10px',
                          border: '1px solid #E5E7EB', fontSize: '0.875rem', fontFamily: 'inherit',
                          color: '#1F2937', outline: 'none',
                        }}
                      />
                    </div>
                  </motion.div>
                )}
              </div>

                </>
              )}

              {selectedPillar === 'ai' && (
                <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #D1FAE5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(16,185,129,0.06)' }}>
                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

                  {/* Title row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Zap size={14} color="white" />
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1F2937' }}>AI &amp; Tech Edge</span>
                      {state.actions.filter(a => !a.completed && !a.skipped).length > 0 && (
                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: '#ECFDF5', color: '#059669' }}>
                          {state.actions.filter(a => !a.completed && !a.skipped).length}
                        </span>
                      )}
                      {llmState.isAiGenerated && (
                        <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: 'rgba(139,92,246,0.1)', color: '#7C3AED' }}>AI</span>
                      )}
                    </div>
                    <Link to="/growth" style={{ fontSize: '0.6875rem', color: '#059669', textDecoration: 'none', fontWeight: 500 }}>Growth →</Link>
                  </div>

                  {/* Working toward */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Working toward</span>
                    {careerTargetEditing ? (
                      <textarea
                        autoFocus
                        value={careerTargetDraft}
                        onChange={e => setCareerTargetDraft(e.target.value)}
                        onBlur={() => { saveCareerTarget(careerTargetDraft); setCareerTargetEditing(false); }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveCareerTarget(careerTargetDraft); setCareerTargetEditing(false); } }}
                        style={{ width: '100%', boxSizing: 'border-box', resize: 'none', padding: '0.625rem 0.75rem', borderRadius: '10px', border: '1.5px solid #6EE7B7', fontSize: '0.8125rem', color: '#374151', fontFamily: 'inherit', outline: 'none', lineHeight: 1.45, minHeight: '52px', backgroundColor: '#F0FDF4' }}
                      />
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => { setCareerTargetDraft(careerTarget); setCareerTargetEditing(true); }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setCareerTargetDraft(careerTarget); setCareerTargetEditing(true); } }}
                        style={{ cursor: 'text', padding: '0.625rem 0.75rem', borderRadius: '10px', border: '1.5px dashed #6EE7B7', backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}
                      >
                        <span style={{ fontSize: '0.875rem', color: careerTarget ? '#059669' : '#34D399', fontStyle: careerTarget ? 'normal' : 'italic', fontWeight: careerTarget ? 500 : 400, lineHeight: 1.45, flex: 1 }}>
                          {careerTarget || 'What AI tools and technical skills are you building?'}
                        </span>
                        <Edit3 size={13} color="#6EE7B7" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                      </div>
                    )}
                  </div>

                  {/* AI profile + progress dots */}
                  {(() => {
                    const completed = state.actions.filter(a => a.completed).length;
                    const milestone = 5;
                    const filled = Math.min(completed, milestone);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          {Array.from({ length: milestone }, (_, i) => (
                            <div key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: i < filled ? '#10B981' : '#D1FAE5', transition: 'background-color 0.3s ease', flexShrink: 0 }} />
                          ))}
                          <span style={{ fontSize: '0.6875rem', color: '#059669', marginLeft: '0.25rem', whiteSpace: 'nowrap' }}>
                            {completed > 0 ? `${completed} action${completed !== 1 ? 's' : ''} done` : 'Start completing actions'}
                          </span>
                        </div>
                        {aiProjectSummary && completed === 0 && (
                          <span style={{ fontSize: '0.75rem', color: '#6B7280', fontStyle: 'italic' }}>{aiProjectSummary}</span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Actions label + refresh */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Suggested Actions</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {state.actions.filter(a => !a.completed && !a.skipped).length > 3 && (
                        <Link to="/growth" style={{ fontSize: '0.75rem', color: '#059669', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>
                      )}
                      <button
                        onClick={refreshActions}
                        disabled={llmState.isLoading}
                        style={{ padding: '0.2rem', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: llmState.isLoading ? 'default' : 'pointer', color: '#9CA3AF', display: 'flex' }}
                        title="Refresh actions"
                      >
                        <RefreshCw size={13} style={{ animation: llmState.isLoading ? 'spin 1s linear infinite' : 'none' }} />
                      </button>
                    </div>
                  </div>

                  {/* Actions list — always visible, no accordion */}
                  {llmState.isLoading && (
                    <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: '#F0FDF4', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>Generating personalized suggestions…</p>
                    </div>
                  )}

                  {!llmState.isLoading && state.actions.filter(a => !a.completed && !a.skipped).length === 0 && (
                    <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: '#F9FAFB', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: '0 0 0.5rem' }}>Log a reflection to get personalized action suggestions.</p>
                      <button onClick={refreshActions} style={{ fontSize: '0.8125rem', color: '#059669', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        Generate suggestions →
                      </button>
                    </div>
                  )}

                  {!llmState.isLoading && state.actions.filter(a => !a.completed && !a.skipped).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {state.actions.filter(a => !a.completed && !a.skipped).slice(0, 3).map(action => {
                        const catColor = CATEGORY_COLORS[action.category] || '#6B7280';
                        const isExpanded = expandedReasoning.has(action.id);
                        return (
                          <motion.div
                            key={action.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{ backgroundColor: '#FAFAFA', borderRadius: '12px', border: '1px solid #F3F4F6', overflow: 'hidden' }}
                          >
                            <div style={{ padding: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0, backgroundColor: `${catColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Zap size={14} style={{ color: catColor }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', margin: '0 0 0.3rem' }}>{action.title}</p>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.6875rem', fontWeight: 500, padding: '0.125rem 0.5rem', borderRadius: '999px', backgroundColor: `${catColor}15`, color: catColor }}>{action.category}</span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.6875rem', color: '#9CA3AF' }}>
                                    <Clock size={11} /> {action.estimatedMinutes} min
                                  </span>
                                  {(action.description || action.reasoning) && (
                                    <button
                                      onClick={() => toggleReasoning(action.id)}
                                      style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                                    >
                                      {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />} Details
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                <button onClick={() => completeAction(action.id)} style={{ padding: '0.4rem', borderRadius: '8px', border: 'none', backgroundColor: '#F0FDF4', color: '#16A34A', cursor: 'pointer', display: 'flex' }} title="Mark done">
                                  <CheckCircle2 size={15} />
                                </button>
                                <button onClick={() => setSkipConfirmId(action.id)} title="Skip" style={{ padding: '0.4rem', borderRadius: '8px', border: 'none', backgroundColor: skipConfirmId === action.id ? '#FEF3C7' : '#F9FAFB', color: skipConfirmId === action.id ? '#D97706' : '#9CA3AF', cursor: 'pointer', display: 'flex' }}>
                                  <SkipForward size={15} />
                                </button>
                              </div>
                            </div>

                            {/* Skip confirmation */}
                            <AnimatePresence>
                              {skipConfirmId === action.id && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} style={{ overflow: 'hidden' }}>
                                  <div style={{ padding: '0.625rem 1.125rem 0.75rem', borderTop: '1px solid #FDE68A', backgroundColor: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                                    <p style={{ fontSize: '0.8125rem', color: '#92400E', margin: 0 }}>Skip this action?</p>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                      <button onClick={() => { dismissAction(action.id); setSkipConfirmId(null); }} style={{ fontSize: '0.75rem', fontWeight: 500, padding: '0.3rem 0.625rem', borderRadius: '6px', border: '1px solid #FCD34D', backgroundColor: 'white', color: '#92400E', cursor: 'pointer', fontFamily: 'inherit' }}>Skip for now</button>
                                      <button onClick={() => { skipAction(action.id); setSkipConfirmId(null); }} style={{ fontSize: '0.75rem', fontWeight: 500, padding: '0.3rem 0.625rem', borderRadius: '6px', border: 'none', backgroundColor: '#F59E0B', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Skip forever</button>
                                      <button onClick={() => setSkipConfirmId(null)} style={{ fontSize: '0.75rem', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem 0.25rem', fontFamily: 'inherit' }}>Cancel</button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Details panel — description + reasoning */}
                            <AnimatePresence>
                              {isExpanded && (action.description || action.reasoning) && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} style={{ overflow: 'hidden' }}>
                                  <div style={{ padding: '0.625rem 1rem 0.75rem', borderTop: `1px solid ${catColor}20`, backgroundColor: `${catColor}06`, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                    {action.description && (
                                      <p style={{ fontSize: '0.8125rem', color: '#374151', lineHeight: 1.55, margin: 0 }}>{action.description}</p>
                                    )}
                                    {action.reasoning && (
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                                        <TrendingUp size={11} style={{ color: catColor, flexShrink: 0, marginTop: '0.2rem' }} />
                                        <p style={{ fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.5, margin: 0 }}>{action.reasoning}</p>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                </div>
              </div>

              )}

              {/* ── PILLAR SWITCHER ── */}
              {selectedPillar !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setSelectedPillar(null)}
                    style={{ padding: '0.375rem 0.75rem', borderRadius: '999px', border: '1px solid #E5E7EB', backgroundColor: 'white', fontSize: '0.75rem', color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.25rem', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
                  >
                    ← All
                  </button>
                  <span style={{ fontSize: '0.6875rem', color: '#E5E7EB', fontWeight: 500, flexShrink: 0 }}>|</span>
                  {([
                    { id: 'product' as const, label: '🧪 Product Taste', color: '#7C3AED' },
                    { id: 'eq' as const, label: '🧠 Emotional IQ', color: '#4A5FC1' },
                    { id: 'ai' as const, label: '🤖 AI & Tech Edge', color: '#059669' },
                  ] as const).filter(p => p.id !== selectedPillar).map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPillar(p.id)}
                      style={{ padding: '0.375rem 0.875rem', borderRadius: '999px', border: '1px solid #F0F0F0', backgroundColor: 'white', fontSize: '0.75rem', color: '#9CA3AF', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = p.color; e.currentTarget.style.borderColor = p.color + '40'; e.currentTarget.style.backgroundColor = p.color + '08'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.borderColor = '#F0F0F0'; e.currentTarget.style.backgroundColor = 'white'; }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}

              {selectedPillar !== null && (
                <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #F3F4F6', overflow: 'hidden' }}>
                {/* Header — always visible, no expand needed */}
                <div style={{
                  padding: '0.875rem 1.25rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem' }}>💼</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937' }}>
                      Draft a LinkedIn Post
                    </span>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 600, padding: '0.125rem 0.5rem',
                      borderRadius: '999px', backgroundColor: '#EFF6FF', color: '#2563EB', letterSpacing: '0.02em',
                    }}>
                      AI
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {linkedInPost && !linkedInLoading && (
                      <button
                        onClick={() => { setLinkedInPost(''); setLinkedInPrompt(''); }}
                        style={{ fontSize: '0.8125rem', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Clear
                      </button>
                    )}
                    {!linkedInLoading && (
                      <button
                        onClick={() => setLinkedInModalOpen(true)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.375rem',
                          padding: '0.375rem 0.875rem', borderRadius: '8px', border: 'none',
                          background: 'linear-gradient(135deg, #0A66C2 0%, #1e88e5 100%)',
                          color: 'white', fontSize: '0.8125rem', fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {linkedInPost ? 'Regenerate' : 'Generate'} <ChevronRight size={13} />
                      </button>
                    )}
                    {linkedInLoading && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#6B7280', fontSize: '0.8125rem' }}>
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          style={{ display: 'inline-flex' }}
                        >
                          <RefreshCw size={13} color="#0A66C2" />
                        </motion.span>
                        <span style={{ color: '#0A66C2', fontWeight: 500 }}>Generating…</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Subtext when idle and no post yet */}
                {!linkedInPost && !linkedInLoading && (
                  <div style={{ padding: '0 1.25rem 1rem' }}>
                    <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>
                      Turn your reflections and product instincts into a post worth reading.
                    </p>
                  </div>
                )}

                {/* Generated post output */}
                <AnimatePresence>
                  {linkedInPost && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid #F3F4F6' }}
                    >
                      <div style={{
                        backgroundColor: '#F8FAFF', borderRadius: '12px',
                        border: '1px solid #DBEAFE', padding: '1rem 1.125rem', marginTop: '0.875rem',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563EB', letterSpacing: '0.04em' }}>
                            DRAFT POST
                          </span>
                          <button
                            onClick={handleCopyLinkedIn}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.375rem',
                              padding: '0.3125rem 0.75rem', borderRadius: '8px', border: '1px solid #BFDBFE',
                              background: linkedInCopied ? '#EFF6FF' : 'white',
                              color: linkedInCopied ? '#2563EB' : '#6B7280',
                              fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            {linkedInCopied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                          </button>
                        </div>
                        <p style={{
                          fontSize: '0.875rem', color: '#1F2937', lineHeight: 1.7,
                          whiteSpace: 'pre-wrap', margin: 0,
                        }}>
                          {linkedInPost}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              )}

              {/* ── LINKEDIN DIRECTION MODAL ── */}
              <AnimatePresence>
                {linkedInModalOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      zIndex: 1000, padding: '1rem',
                    }}
                    onClick={e => { if (e.target === e.currentTarget) setLinkedInModalOpen(false); }}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 12 }}
                      transition={{ duration: 0.18 }}
                      style={{
                        backgroundColor: 'white', borderRadius: '20px',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
                        padding: '1.75rem', width: '100%', maxWidth: '30rem',
                      }}
                    >
                      <div style={{ marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#1F2937', margin: '0 0 0.25rem' }}>
                          What kind of post?
                        </h3>
                        <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>
                          Pick a focus — we'll pull the right context from your history.
                        </p>
                      </div>

                      {/* Post type selector */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                        {([
                          {
                            type: 'emotional' as const,
                            icon: '💭',
                            label: 'Emotionally reflective',
                            sub: 'Draws from your journal entries',
                          },
                          {
                            type: 'product' as const,
                            icon: '🧪',
                            label: 'Product taste',
                            sub: 'Draws from your taste exercises',
                          },
                          {
                            type: 'mixed' as const,
                            icon: '✨',
                            label: 'Best of both',
                            sub: 'Weaves reflections + product insights',
                          },
                        ] as const).map(opt => {
                          const selected = linkedInPostType === opt.type;
                          return (
                            <button
                              key={opt.type}
                              onClick={() => setLinkedInPostType(opt.type)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '0.875rem',
                                padding: '0.75rem 1rem', borderRadius: '12px', border: 'none',
                                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                                backgroundColor: selected ? '#EFF6FF' : '#F9FAFB',
                                outline: selected ? '2px solid #0A66C2' : '2px solid transparent',
                                transition: 'all 0.12s',
                              }}
                            >
                              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{opt.icon}</span>
                              <div>
                                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: selected ? '#0A66C2' : '#1F2937', margin: 0 }}>
                                  {opt.label}
                                </p>
                                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: 0 }}>
                                  {opt.sub}
                                </p>
                              </div>
                              {selected && (
                                <span style={{ marginLeft: 'auto', color: '#0A66C2', flexShrink: 0 }}>
                                  <Check size={15} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Optional direction */}
                      <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: '0.375rem' }}>
                        Any specific angle? <span style={{ color: '#D1D5DB', fontWeight: 400 }}>optional</span>
                      </label>
                      <textarea
                        value={linkedInPrompt}
                        onChange={e => setLinkedInPrompt(e.target.value)}
                        placeholder="e.g. the onboarding friction I noticed in Notion, how anxiety before a big presentation taught me something..."
                        rows={2}
                        style={{
                          width: '100%', padding: '0.75rem 1rem', borderRadius: '12px',
                          border: '1.5px solid #E5E7EB', fontSize: '0.875rem', fontFamily: 'inherit',
                          color: '#1F2937', outline: 'none', resize: 'none', boxSizing: 'border-box',
                          lineHeight: 1.6,
                        }}
                        onFocus={e => { e.target.style.borderColor = '#0A66C2'; }}
                        onBlur={e => { e.target.style.borderColor = '#E5E7EB'; }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            setLinkedInModalOpen(false);
                            handleGenerateLinkedIn();
                          }
                        }}
                      />

                      <button
                        onClick={() => { setLinkedInModalOpen(false); handleGenerateLinkedIn(); }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                          padding: '0.75rem 1rem', borderRadius: '10px', border: 'none', marginTop: '1rem',
                          background: 'linear-gradient(135deg, #0A66C2 0%, #1e88e5 100%)',
                          color: 'white', fontSize: '0.875rem', fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <Sparkles size={14} /> Generate post
                      </button>
                      <p style={{ fontSize: '0.75rem', color: '#D1D5DB', textAlign: 'center', marginTop: '0.625rem', marginBottom: 0 }}>
                        ⌘ Enter to generate
                      </p>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          )}

          {/* ---- ANALYZING PHASE ---- */}
          {phase === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '4rem 1rem', gap: '1.5rem',
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: '72px', height: '72px', borderRadius: '20px',
                  background: 'linear-gradient(135deg, #4A5FC1 0%, #7C3AED 50%, #8B7EC8 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(74,95,193,0.3)',
                }}
              >
                <Sparkles size={32} color="white" />
              </motion.div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 600, color: '#1F2937', fontSize: '1.125rem', marginBottom: '0.375rem' }}>
                  Analyzing your reflection...
                </p>
                <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                  Understanding emotions, events, and context
                </p>
              </div>
              {/* Show the journal text being analyzed */}
              <div style={{
                maxWidth: '100%', backgroundColor: 'white', borderRadius: '14px',
                border: '1px solid #F3F4F6', padding: '1rem 1.25rem', marginTop: '0.5rem',
              }}>
                <p style={{
                  fontSize: '0.875rem', color: '#6B7280', fontStyle: 'italic',
                  lineHeight: 1.6, maxHeight: '4.8em', overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  "{journalText.length > 200 ? journalText.slice(0, 200) + '...' : journalText}"
                </p>
              </div>
            </motion.div>
          )}

          {/* ---- REVIEW PHASE ---- */}
          {phase === 'review' && analysisState.result && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              {/* AI Summary Card */}
              <div style={{
                backgroundColor: 'white', borderRadius: '20px', border: '1px solid #E5E7EB',
                padding: '1.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
                  <Sparkles size={18} color="#7C3AED" />
                  <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937' }}>AI Analysis</h2>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {sentimentBadge(analysisState.result.sentiment)}
                    <span style={{
                      fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 500,
                    }}>
                      {Math.round(analysisState.result.confidence * 100)}% confident
                    </span>
                  </div>
                </div>

                {/* Empathetic summary */}
                <div style={{
                  padding: '1rem 1.25rem', borderRadius: '14px',
                  backgroundColor: 'rgba(139,126,200,0.06)', border: '1px solid rgba(139,126,200,0.12)',
                  marginBottom: '1.25rem',
                }}>
                  <p style={{ fontSize: '0.9375rem', color: '#4C1D95', lineHeight: 1.6, fontStyle: 'italic' }}>
                    "{analysisState.result.summary}"
                  </p>
                </div>

                {/* Detected Emotion */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.625rem', display: 'block' }}>
                    Detected Emotion
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {EMOTIONS.map(e => (
                      <button
                        key={e.type}
                        onClick={() => setReviewEmotion(e.type)}
                        style={{
                          padding: '0.5rem 0.875rem', borderRadius: '999px',
                          border: '2px solid',
                          borderColor: reviewEmotion === e.type ? e.color : '#E5E7EB',
                          backgroundColor: reviewEmotion === e.type ? `${e.color}15` : 'white',
                          cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit',
                          color: reviewEmotion === e.type ? e.color : '#6B7280',
                          fontWeight: reviewEmotion === e.type ? 600 : 400,
                          transition: 'all 0.15s',
                        }}
                      >
                        {e.icon} {e.type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Intensity */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.5rem', display: 'block' }}>
                    Intensity: {reviewIntensity}/10
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={reviewIntensity}
                    onChange={(e) => setReviewIntensity(Number(e.target.value))}
                    style={{
                      width: '100%', accentColor: getEmotionColor(reviewEmotion),
                    }}
                  />
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.25rem',
                  }}>
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>

                {/* Event Type */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.5rem', display: 'block' }}>
                    Career Event Type
                  </label>
                  <select
                    value={reviewEventType || ''}
                    onChange={(e) => setReviewEventType(e.target.value ? e.target.value as EventType : null)}
                    style={{
                      width: '100%', padding: '0.625rem 0.875rem', borderRadius: '10px',
                      border: '1px solid #E5E7EB', fontSize: '0.875rem', fontFamily: 'inherit',
                      color: '#1F2937', backgroundColor: 'white', outline: 'none',
                    }}
                  >
                    <option value="">No career event</option>
                    {EVENT_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Company */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.5rem', display: 'block' }}>
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    value={reviewCompany}
                    onChange={(e) => setReviewCompany(e.target.value)}
                    placeholder="None detected"
                    style={{
                      width: '100%', padding: '0.625rem 0.875rem', borderRadius: '10px',
                      border: '1px solid #E5E7EB', fontSize: '0.875rem', fontFamily: 'inherit',
                      color: '#1F2937', outline: 'none',
                    }}
                  />
                </div>

                {/* Triggers */}
                {analysisState.result.triggers.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.5rem', display: 'block' }}>
                      Triggers Identified
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                      {analysisState.result.triggers.map((trigger, i) => (
                        <span key={i} style={{
                          fontSize: '0.8125rem', padding: '0.375rem 0.75rem', borderRadius: '999px',
                          backgroundColor: '#F3F4F6', color: '#4B5563', fontWeight: 500,
                        }}>
                          {trigger}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{
                  display: 'flex', gap: '0.75rem', paddingTop: '0.75rem',
                  borderTop: '1px solid #F3F4F6',
                }}>
                  <Button onClick={handleApprove} size="md">
                    <CheckCircle2 size={16} /> Approve & Save
                  </Button>
                  <Button variant="outline" size="md" onClick={() => setPhase('writing')}>
                    <Edit3 size={16} /> Edit Entry
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ---- SUCCESS PHASE ---- */}
          {phase === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '4rem 1rem', gap: '1.5rem',
              }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                style={{
                  width: '80px', height: '80px', borderRadius: '50%',
                  backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '3px solid #86EFAC',
                }}
              >
                <CheckCircle2 size={40} color="#22C55E" />
              </motion.div>

              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.375rem' }}>
                  Reflection Saved
                </h2>
                <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.5 }}>
                  Your emotion and {reviewEventType ? 'career event have' : 'reflection has'} been recorded.
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
                <Button onClick={handleWriteAnother} size="md">
                  <BookOpen size={16} /> Write Another
                </Button>
                <Link to="/dashboard">
                  <Button variant="outline" size="md">
                    Dashboard <ArrowRight size={14} />
                  </Button>
                </Link>
                <Link to="/timeline">
                  <Button variant="ghost" size="md">
                    View Timeline <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
