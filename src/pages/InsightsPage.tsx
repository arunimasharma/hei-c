import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { Calendar, BarChart3, BookOpen } from 'lucide-react';
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
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                  All Reflections ({approved.length})
                </h2>
              </div>

              {approved.length > 0 ? (
                approved.map(r => (
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
                ))
              ) : (
                <Card>
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                    <BookOpen size={36} style={{ color: '#D1D5DB', margin: '0 auto 0.75rem', display: 'block' }} />
                    <p style={{ color: '#6B7280', margin: 0 }}>
                      No reflections yet. Write your first one on the home page.
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
