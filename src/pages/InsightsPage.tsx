import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { Calendar, BarChart3, BookOpen, FlaskConical, Star } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmotionCard from '../components/emotions/EmotionCard';
import { useApp } from '../context/AppContext';
import { getEmotionIcon, getEmotionColor, getIntensityColor } from '../utils/emotionHelpers';
import { calculateStreak } from '../utils/dateHelpers';

export default function InsightsPage() {
  const { state } = useApp();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<'dashboard' | 'timeline' | 'reflections'>('dashboard');

  useEffect(() => {
    if (searchParams.get('tab') === 'reflections') setView('reflections');
  }, [searchParams]);
  const { emotions, events } = state;

  const latestEmotion = emotions[0];
  const streak = calculateStreak(emotions.map(e => e.timestamp));
  const recentEmotions = emotions.slice(0, 5);

  // Stats
  const emotionCounts = emotions.reduce(
    (acc, e) => {
      acc[e.emotion] = (acc[e.emotion] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const topEmotions = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const avgIntensity =
    emotions.length > 0
      ? Math.round(emotions.reduce((sum, e) => sum + e.intensity, 0) / emotions.length)
      : 0;

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Header with view toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>
              Your Insights
            </h1>
            <p style={{ color: '#6B7280', marginTop: '0.25rem', margin: 0 }}>
              Understand your emotional patterns and growth
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#F3F4F6', padding: '0.5rem', borderRadius: '10px' }}>
            <Button
              size="sm"
              variant={view === 'dashboard' ? 'primary' : 'ghost'}
              onClick={() => setView('dashboard')}
              style={{ cursor: 'pointer' }}
            >
              <BarChart3 size={16} /> Dashboard
            </Button>
            <Button
              size="sm"
              variant={view === 'timeline' ? 'primary' : 'ghost'}
              onClick={() => setView('timeline')}
              style={{ cursor: 'pointer' }}
            >
              <Calendar size={16} /> Timeline
            </Button>
            <Button
              size="sm"
              variant={view === 'reflections' ? 'primary' : 'ghost'}
              onClick={() => setView('reflections')}
              style={{ cursor: 'pointer' }}
            >
              <BookOpen size={16} /> Reflections
            </Button>
          </div>
        </div>

        {/* Dashboard View */}
        {view === 'dashboard' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          >
            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
              <Card>
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Logged
                </p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937', margin: '0.5rem 0 0 0' }}>
                  {emotions.length}
                </p>
              </Card>
              <Card>
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Current Streak
                </p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10B981', margin: '0.5rem 0 0 0' }}>
                  {streak} days
                </p>
              </Card>
              <Card>
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Avg Intensity
                </p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#F59E0B', margin: '0.5rem 0 0 0' }}>
                  {avgIntensity}/10
                </p>
              </Card>
              <Card>
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Events Tracked
                </p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#4A5FC1', margin: '0.5rem 0 0 0' }}>
                  {events.length}
                </p>
              </Card>
            </div>

            {/* Current Emotion */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                  Current Emotional State
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#FFF7ED', padding: '0.375rem 0.75rem', borderRadius: '999px' }}>
                  <span style={{ fontSize: '1rem' }}>🔥</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#EA580C' }}>{streak} day streak</span>
                </div>
              </div>

              {latestEmotion ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1.25rem',
                    borderRadius: '14px',
                    backgroundColor: `${getEmotionColor(latestEmotion.emotion)}10`,
                  }}
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '14px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.75rem',
                      backgroundColor: `${getEmotionColor(latestEmotion.emotion)}20`,
                    }}
                  >
                    {getEmotionIcon(latestEmotion.emotion)}
                  </div>
                  <div>
                    <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: 0 }}>Most Recent</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', margin: '0.25rem 0 0 0' }}>
                      {latestEmotion.emotion}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.375rem' }}>
                      <div style={{ width: '96px', height: '10px', borderRadius: '999px', backgroundColor: '#E5E7EB' }}>
                        <div
                          style={{
                            height: '100%',
                            borderRadius: '999px',
                            transition: 'all 0.3s',
                            width: `${latestEmotion.intensity * 10}%`,
                            backgroundColor: getIntensityColor(latestEmotion.intensity),
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#9CA3AF' }}>
                        {latestEmotion.intensity}/10
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🌱</div>
                  <p style={{ color: '#6B7280' }}>No emotions logged yet</p>
                </div>
              )}
            </Card>

            {/* Top Emotions */}
            {topEmotions.length > 0 && (
              <Card>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937', marginBottom: '1.25rem', margin: 0 }}>
                  Most Frequent Emotions
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
                  {topEmotions.map(([emotion, count]) => (
                    <div
                      key={emotion}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        backgroundColor: '#F9FAFB',
                        textAlign: 'center',
                        border: '1px solid #E5E7EB',
                      }}
                    >
                      <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
                        {getEmotionIcon(emotion as any)}
                      </div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                        {emotion}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: '0.25rem 0 0 0' }}>
                        {count} time{count > 1 ? 's' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>
        )}

        {/* Timeline View */}
        {view === 'timeline' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            {/* Timeline Header */}
            <Card>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', marginBottom: '1rem', margin: 0 }}>
                Your Emotional Journey
              </h2>
              <p style={{ color: '#6B7280', fontSize: '0.875rem', margin: 0 }}>
                Track how your emotions have evolved over time
              </p>
            </Card>

            {/* Emotions Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentEmotions.length > 0 ? (
                recentEmotions.map((entry) => (
                  <EmotionCard
                    key={entry.id}
                    entry={entry}
                  />
                ))
              ) : (
                <Card>
                  <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                    <p style={{ color: '#6B7280', margin: 0 }}>No emotions logged yet. Start by logging your first emotion!</p>
                  </div>
                </Card>
              )}
            </div>

            {emotions.length > 5 && (
              <Card>
                <p style={{ color: '#6B7280', fontSize: '0.875rem', margin: 0 }}>
                  Showing 5 most recent entries. {emotions.length - 5} more entries available.
                </p>
              </Card>
            )}
          </motion.div>
        )}

        {/* Reflections View */}
        {view === 'reflections' && (() => {
          const approved = state.reflections.filter(r => r.status === 'approved');
          const tasteExercises = state.tasteExercises ?? [];
          const totalCount = approved.length + tasteExercises.length;
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                All Reflections ({totalCount})
              </h2>

              {/* Taste Exercises */}
              {tasteExercises.length > 0 && (
                <>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                    Taste Exercises ({tasteExercises.length})
                  </p>
                  {tasteExercises.map((te, idx) => (
                    <div key={te.id} style={{
                      backgroundColor: 'white', borderRadius: '16px',
                      border: '1px solid rgba(124,58,237,0.15)', padding: '1.25rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                          background: 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <FlaskConical size={18} color="white" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.75rem', fontWeight: 600, color: '#7C3AED',
                              backgroundColor: 'rgba(124,58,237,0.08)',
                              padding: '0.125rem 0.5rem', borderRadius: '999px',
                            }}>
                              Taste Exercise #{tasteExercises.length - idx}
                            </span>
                            <span style={{
                              fontSize: '0.75rem', fontWeight: 600, color: 'white',
                              backgroundColor: '#7C3AED',
                              padding: '0.125rem 0.5rem', borderRadius: '999px',
                              display: 'flex', alignItems: 'center', gap: '0.25rem',
                            }}>
                              <Star size={10} fill="white" />
                              {te.score}/5
                            </span>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937' }}>
                              {te.productName}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#9CA3AF', marginLeft: 'auto' }}>
                              {new Date(te.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: '0 0 0.75rem' }}>
                            {te.scoreComment}
                          </p>

                          {/* Per-question scores — only present for V1 evaluator results */}
                          {te.evaluation && (
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                              {(['q1','q2','q3','q4','q5','q6'] as const).map(q => {
                                const s = te.evaluation!.per_question_scores[q];
                                const bg    = s >= 4 ? '#F0FDF4' : s >= 2 ? '#FFFBEB' : '#FEF2F2';
                                const color = s >= 4 ? '#16A34A' : s >= 2 ? '#D97706' : '#DC2626';
                                return (
                                  <span key={q} style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '6px', background: bg, color }}>
                                    {q.toUpperCase()} {s}/5
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          <p style={{
                            fontSize: '0.875rem', color: '#374151', lineHeight: 1.6,
                            margin: 0, whiteSpace: 'pre-wrap',
                          }}>
                            {te.summary}
                          </p>

                          {/* Full V1 evaluator sections — all 5 list fields */}
                          {te.evaluation && (() => {
                            const ev = te.evaluation!;
                            const sections: Array<{ label: string; color: string; items: string[] }> = [
                              { label: 'Strengths',                     color: '#16A34A', items: ev.strengths },
                              { label: 'Weaknesses',                    color: '#DC2626', items: ev.weaknesses },
                              { label: 'Signals of strong product taste', color: '#0891B2', items: ev.signals_of_strong_product_taste },
                              { label: 'Missing signals',               color: '#D97706', items: ev.missing_signals },
                              { label: 'Coaching to improve',           color: '#7C3AED', items: ev.coaching_to_improve },
                            ].filter(s => s.items.length > 0);
                            if (sections.length === 0) return null;
                            return (
                              <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                {sections.map(({ label, color, items }) => (
                                  <div key={label}>
                                    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.3rem' }}>{label}</p>
                                    <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                      {items.map((item, i) => (
                                        <li key={i} style={{ fontSize: '0.8125rem', color: '#374151', lineHeight: 1.5 }}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}

                          {te.answers.length > 0 && (
                            <details style={{ marginTop: '0.875rem' }}>
                              <summary style={{ fontSize: '0.8125rem', color: '#7C3AED', cursor: 'pointer', fontWeight: 500 }}>
                                View answers ({te.answers.length} question{te.answers.length > 1 ? 's' : ''})
                              </summary>
                              <div style={{ marginTop: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {te.answers.map((a, i) => (
                                  <div key={i} style={{ paddingLeft: '0.75rem', borderLeft: '2px solid rgba(124,58,237,0.2)' }}>
                                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7C3AED', margin: '0 0 0.25rem' }}>Q{i + 1}</p>
                                    <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: '0 0 0.25rem', fontStyle: 'italic' }}>{a.question}</p>
                                    <p style={{ fontSize: '0.875rem', color: '#374151', margin: 0 }}>{a.answer}</p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Journal Reflections */}
              {approved.length > 0 && (
                <>
                  {tasteExercises.length > 0 && (
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                      Journal Reflections ({approved.length})
                    </p>
                  )}
                  {approved.map(r => (
                    <div key={r.id} style={{
                      backgroundColor: 'white', borderRadius: '16px',
                      border: '1px solid #F3F4F6', padding: '1.25rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                          backgroundColor: r.approvedEmotion
                            ? `${getEmotionColor(r.approvedEmotion)}18`
                            : '#F3F4F6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.25rem',
                        }}>
                          {r.approvedEmotion ? getEmotionIcon(r.approvedEmotion) : '📝'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                            {r.approvedEmotion && (
                              <span style={{
                                fontSize: '0.75rem', fontWeight: 600,
                                color: getEmotionColor(r.approvedEmotion),
                                backgroundColor: `${getEmotionColor(r.approvedEmotion)}15`,
                                padding: '0.125rem 0.5rem', borderRadius: '999px',
                              }}>
                                {r.approvedEmotion}
                                {r.approvedIntensity ? ` · ${r.approvedIntensity}/10` : ''}
                              </span>
                            )}
                            {r.approvedEventType && (
                              <span style={{
                                fontSize: '0.75rem', color: '#6B7280',
                                backgroundColor: '#F3F4F6',
                                padding: '0.125rem 0.5rem', borderRadius: '999px',
                              }}>
                                {r.approvedEventType}
                                {r.approvedCompanyName ? ` at ${r.approvedCompanyName}` : ''}
                              </span>
                            )}
                            <span style={{ fontSize: '0.75rem', color: '#9CA3AF', marginLeft: 'auto' }}>
                              {new Date(r.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <p style={{
                            fontSize: '0.875rem', color: '#374151', lineHeight: 1.6,
                            margin: 0, whiteSpace: 'pre-wrap',
                          }}>
                            {r.text}
                          </p>
                          {r.detectedSummary && (
                            <p style={{
                              fontSize: '0.8125rem', color: '#7C3AED', fontStyle: 'italic',
                              marginTop: '0.625rem', lineHeight: 1.5,
                              padding: '0.5rem 0.75rem', borderRadius: '8px',
                              backgroundColor: 'rgba(139,92,246,0.06)',
                            }}>
                              "{r.detectedSummary}"
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

                      {/* Decisions */}
              {state.decisions && state.decisions.length > 0 && (
                <>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                    Decisions ({state.decisions.length})
                  </p>
                  {state.decisions.map(d => (
                    <div key={d.id} style={{
                      backgroundColor: d.status === 'open' ? '#FFFBEB' : '#F9FAFB',
                      borderRadius: '16px',
                      border: `1px solid ${d.status === 'open' ? '#FDE68A' : '#E5E7EB'}`,
                      padding: '1.25rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                          background: d.status === 'open' ? 'linear-gradient(135deg, #B45309 0%, #D97706 100%)' : '#D1D5DB',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.25rem',
                        }}>
                          ⚖️
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.75rem', fontWeight: 700,
                              color: d.status === 'open' ? '#B45309' : '#6B7280',
                              backgroundColor: d.status === 'open' ? '#FEF3C7' : '#F3F4F6',
                              padding: '0.125rem 0.5rem', borderRadius: '999px',
                            }}>
                              {d.status === 'open' ? 'Open' : 'Decided'}
                            </span>
                            {d.deadline && (
                              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Due: {d.deadline}</span>
                            )}
                            <span style={{ fontSize: '0.75rem', color: '#9CA3AF', marginLeft: 'auto' }}>
                              {new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937', margin: '0 0 0.75rem', lineHeight: 1.4 }}>{d.question}</p>
                          {d.aiStructuredBrief && (
                            <pre style={{ fontSize: '0.8125rem', color: '#374151', lineHeight: 1.65, margin: '0 0 0.75rem', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                              {d.aiStructuredBrief}
                            </pre>
                          )}
                          {d.chosenOption && (
                            <div style={{ padding: '0.625rem 0.875rem', backgroundColor: '#F0FDF4', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16A34A', margin: '0 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Chosen</p>
                              <p style={{ fontSize: '0.875rem', color: '#1F2937', margin: 0 }}>{d.chosenOption}{d.chosenReason ? ` — ${d.chosenReason}` : ''}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {totalCount === 0 && (!state.decisions || state.decisions.length === 0) && (
                <Card>
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                    <BookOpen size={36} style={{ color: '#D1D5DB', margin: '0 auto 0.75rem', display: 'block' }} />
                    <p style={{ color: '#6B7280', margin: 0 }}>
                      No reflections yet. Start journaling or try a Product Taste Exercise on the home page.
                    </p>
                  </div>
                </Card>
              )}
            </motion.div>
          );
        })()}
      </div>
    </DashboardLayout>
  );
}
