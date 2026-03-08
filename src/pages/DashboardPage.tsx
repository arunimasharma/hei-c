import { useEffect } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import {
  Heart, Calendar, Zap, TrendingUp,
  Flame, ArrowRight, Clock, CheckCircle2
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmotionCard from '../components/emotions/EmotionCard';
import { useApp } from '../context/AppContext';
import { getEmotionIcon, getEmotionColor, getIntensityColor } from '../utils/emotionHelpers';
import { calculateStreak } from '../utils/dateHelpers';

export default function DashboardPage() {
  const { state, completeAction, refreshActions } = useApp();
  const { emotions, events, actions, user } = state;

  useEffect(() => {
    if (actions.filter(a => !a.completed && !a.skipped).length === 0) {
      refreshActions();
    }
  }, []);

  const latestEmotion = emotions[0];
  const streak = calculateStreak(emotions.map(e => e.timestamp));
  const recentEmotions = emotions.slice(0, 5);
  const activeActions = actions.filter(a => !a.completed && !a.skipped).slice(0, 4);

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Welcome */}
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937' }}>
            Welcome back,{' '}
            {(!user?.name || user.name === 'Friend')
              ? <><a href="https://www.linkedin.com/in/arunimasharma/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: '#D1D5DB' }}>Arunima</a>'s Friend</>
              : user.name}
          </h1>
          <p style={{ color: '#6B7280', marginTop: '0.25rem' }}>Here's your emotional wellness overview</p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Link to="/add-emotion"><Button size="md"><Heart size={16} /> Log Emotion</Button></Link>
          <Link to="/add-event"><Button variant="outline" size="md"><Calendar size={16} /> Add Event</Button></Link>
          <Link to="/timeline"><Button variant="ghost" size="md"><TrendingUp size={16} /> View Timeline</Button></Link>
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }} className="lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937' }}>Emotional Overview</h2>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                backgroundColor: '#FFF7ED', padding: '0.375rem 0.75rem', borderRadius: '999px',
              }}>
                <Flame size={16} color="#FB923C" />
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#EA580C' }}>{streak} day streak</span>
              </div>
            </div>

            {latestEmotion ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem',
                borderRadius: '14px', backgroundColor: `${getEmotionColor(latestEmotion.emotion)}10`,
              }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '14px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem',
                  backgroundColor: `${getEmotionColor(latestEmotion.emotion)}20`,
                }}>
                  {getEmotionIcon(latestEmotion.emotion)}
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>Current State</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937' }}>{latestEmotion.emotion}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.375rem' }}>
                    <div style={{ width: '96px', height: '10px', borderRadius: '999px', backgroundColor: '#E5E7EB' }}>
                      <div style={{
                        height: '100%', borderRadius: '999px', transition: 'all 0.3s',
                        width: `${latestEmotion.intensity * 10}%`,
                        backgroundColor: getIntensityColor(latestEmotion.intensity),
                      }} />
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#9CA3AF' }}>{latestEmotion.intensity}/10</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🌱</div>
                <p style={{ color: '#6B7280', marginBottom: '1rem' }}>No emotions logged yet</p>
                <Link to="/add-emotion"><Button size="sm">Log Your First Emotion</Button></Link>
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937', marginBottom: '1.25rem' }}>Quick Stats</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { label: 'Emotions Logged', value: emotions.length, color: '#4A5FC1' },
                { label: 'Career Events', value: events.length, color: '#8B7EC8' },
                { label: 'Actions Completed', value: actions.filter(a => a.completed).length, color: '#10B981' },
              ].map((stat, i) => (
                <div key={stat.label}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', color: '#6B7280' }}>{stat.label}</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: stat.color }}>{stat.value}</span>
                  </div>
                  {i < 2 && <div style={{ borderTop: '1px solid #F9FAFB', marginTop: '1rem' }} />}
                </div>
              ))}
              <div style={{ borderTop: '1px solid #F9FAFB', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6B7280' }}>Current Streak</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Flame size={18} color="#FB923C" />
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F97316' }}>{streak} days</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Activity */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937' }}>Recent Activity</h2>
            <Link to="/timeline" style={{ fontSize: '0.875rem', color: '#4A5FC1', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}>
              View All <ArrowRight size={14} />
            </Link>
          </div>
          {recentEmotions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentEmotions.map(entry => (
                <EmotionCard key={entry.id} entry={entry} event={events.find(e => e.id === entry.eventId)} compact />
              ))}
            </div>
          ) : (
            <Card>
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <Clock size={36} color="#9CA3AF" style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ color: '#6B7280' }}>Your activity will appear here</p>
              </div>
            </Card>
          )}
        </section>

        {/* Suggested Actions */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937' }}>Suggested Actions</h2>
            <Link to="/actions" style={{ fontSize: '0.875rem', color: '#4A5FC1', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}>
              See All <ArrowRight size={14} />
            </Link>
          </div>
          {activeActions.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {activeActions.map(action => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    backgroundColor: 'white', borderRadius: '16px', border: '1px solid #F3F4F6',
                    padding: '1.25rem', transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontWeight: 500, color: '#1F2937', fontSize: '0.875rem', lineHeight: 1.4 }}>{action.title}</h3>
                      <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.375rem' }}>{action.description}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <span style={{
                          fontSize: '0.75rem', backgroundColor: 'rgba(74,95,193,0.08)', color: '#4A5FC1',
                          padding: '0.125rem 0.625rem', borderRadius: '999px', fontWeight: 500,
                        }}>{action.category}</span>
                        <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{action.estimatedMinutes} min</span>
                      </div>
                    </div>
                    <button
                      onClick={() => completeAction(action.id)}
                      style={{
                        padding: '0.5rem', borderRadius: '12px', border: 'none',
                        backgroundColor: 'transparent', cursor: 'pointer', color: '#9CA3AF',
                        flexShrink: 0, display: 'flex', transition: 'all 0.2s',
                      }}
                      aria-label="Complete action"
                    >
                      <CheckCircle2 size={22} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card>
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <Zap size={36} color="#9CA3AF" style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ color: '#6B7280' }}>Actions will be suggested based on your emotional patterns</p>
              </div>
            </Card>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
