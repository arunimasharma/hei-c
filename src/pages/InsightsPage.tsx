import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { BarChart3, BookOpen, FlaskConical, Star, ShieldCheck, ArrowRight, Target, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import { useApp } from '../context/AppContext';
import { InsightStore } from '../lib/InsightStore';
import { THEME_LABELS, type FrictionTheme } from '../data/frictionCases';
import type { ThemeStat } from '../lib/credibilityEngine';

export default function InsightsPage() {
  const { state } = useApp();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<'dashboard' | 'exercises' | 'reflections'>('dashboard');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'exercises')   setView('exercises');
    if (tab === 'reflections') setView('reflections');
    if (tab === 'self-evals')  setView('exercises'); // legacy compat
  }, [searchParams]);

  const insight      = useMemo(() => InsightStore.getProfile(), []);
  const submissions  = useMemo(() => InsightStore.getAll(), []);
  const latestSub    = submissions.length > 0 ? submissions[submissions.length - 1] : null;

  const themeEntries = useMemo(() =>
    (Object.entries(insight.domainAccuracy) as [FrictionTheme, ThemeStat][])
      .sort((a, b) => b[1].attempts - a[1].attempts),
    [insight]
  );

  const scoreLabel = (score: number) =>
    score === 1 ? 'Perfect read' : score === 0.5 ? 'Half right' : 'Learning moment';
  const scoreColor = (score: number) =>
    score === 1 ? '#16A34A' : score === 0.5 ? '#D97706' : '#DC2626';

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #7C3AED 0%, #4A5FC1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={18} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.02em' }}>Product Insights</h1>
              <p style={{ fontSize: '0.8rem', color: '#9CA3AF', margin: 0 }}>How your product thinking has developed</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {([
              { id: 'dashboard',   label: 'Overview' },
              { id: 'exercises',   label: 'Exercise Log' },
              { id: 'reflections', label: 'Reflections' },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                style={{ padding: '0.5rem 0.875rem', borderRadius: '999px', border: 'none', backgroundColor: view === t.id ? '#7C3AED' : 'transparent', color: view === t.id ? 'white' : '#6B7280', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── OVERVIEW TAB ── */}
        {view === 'dashboard' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          >
            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
              <Card>
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exercises Done</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#7C3AED', margin: '0.5rem 0 0 0' }}>{insight.totalCases}</p>
              </Card>
              <Card>
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Accuracy</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10B981', margin: '0.5rem 0 0 0' }}>
                  {insight.totalCases > 0 ? `${Math.round(insight.avgAccuracy * 100)}%` : '—'}
                </p>
              </Card>
              <Card>
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Themes Explored</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#4A5FC1', margin: '0.5rem 0 0 0' }}>{themeEntries.length}</p>
              </Card>
              <Card>
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Credibility Score</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#D97706', margin: '0.5rem 0 0 0' }}>{insight.credibilityScore}</p>
              </Card>
            </div>

            {/* Expert tags */}
            {insight.expertTags.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600 }}>Expert in:</span>
                {insight.expertTags.map(tag => {
                  const meta = THEME_LABELS[tag];
                  return (
                    <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', fontWeight: 600, padding: '0.25rem 0.625rem', borderRadius: '999px', backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.color}33` }}>
                      {meta.emoji} {meta.label}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Latest exercise */}
            {latestSub ? (
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>Latest Exercise</h2>
                  <Link to="/signals" style={{ fontSize: '0.8rem', color: '#7C3AED', textDecoration: 'none', fontWeight: 500 }}>
                    View all signals →
                  </Link>
                </div>
                {(() => {
                  const meta = THEME_LABELS[latestSub.theme];
                  const sc = latestSub.score;
                  const scColor = scoreColor(sc);
                  const scLabel = scoreLabel(sc);
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: '12px', backgroundColor: meta.bg, border: `1px solid ${meta.color}22` }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '12px', backgroundColor: meta.bg, border: `1px solid ${meta.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                        {meta.emoji}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1F2937' }}>{meta.label}</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: scColor, padding: '0.125rem 0.5rem', borderRadius: '999px', backgroundColor: 'white', border: `1px solid ${scColor}33` }}>{scLabel}</span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: 0 }}>
                          {latestSub.rootIssueCorrect ? '✓ Root issue' : '✗ Root issue'} · {latestSub.fixCorrect ? '✓ Fix' : '✗ Fix'}
                          <span style={{ marginLeft: '0.5rem', color: '#9CA3AF' }}>
                            · {new Date(latestSub.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: scColor, margin: 0 }}>{Math.round(sc * 100)}%</p>
                        <p style={{ fontSize: '0.65rem', color: '#9CA3AF', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>Accuracy</p>
                      </div>
                    </div>
                  );
                })()}
              </Card>
            ) : (
              <Card>
                <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧪</div>
                  <p style={{ color: '#6B7280', margin: '0 0 1rem' }}>No exercises yet.</p>
                  <Link to="/product" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', borderRadius: '8px', backgroundColor: '#7C3AED', color: 'white', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}>
                    Try a friction case <ArrowRight size={14} />
                  </Link>
                </div>
              </Card>
            )}

            {/* Theme performance */}
            {themeEntries.length > 0 && (
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <TrendingUp size={15} color="#4A5FC1" />
                  <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>Theme Performance</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {themeEntries.map(([theme, { attempts, accuracy }]) => {
                    const meta = THEME_LABELS[theme];
                    const pct = Math.round(accuracy * 100);
                    return (
                      <div key={theme}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <span style={{ fontSize: '0.875rem' }}>{meta.emoji}</span>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>{meta.label}</span>
                            <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{attempts} exercise{attempts !== 1 ? 's' : ''}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: meta.color }}>{pct}%</span>
                        </div>
                        <div style={{ height: '6px', borderRadius: '999px', backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.7, ease: 'easeOut' }}
                            style={{ height: '100%', borderRadius: '999px', backgroundColor: meta.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Recent Product Taste exercises from AppContext */}
            {(state.tasteExercises ?? []).length > 0 && (
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.625rem' }}>
                  Recent Product Taste Exercises
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {(state.tasteExercises ?? []).slice(0, 3).map((te) => (
                    <div key={te.id} style={{ padding: '0.875rem 1rem', borderRadius: '14px', backgroundColor: 'white', border: '1px solid rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FlaskConical size={16} color="white" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{te.productName}</p>
                        <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: '0.125rem 0 0' }}>
                          Score {te.score}/5 · {new Date(te.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                        <Star size={12} color="#7C3AED" fill="#7C3AED" />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#7C3AED' }}>{te.score}/5</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {insight.totalCases === 0 && (state.tasteExercises ?? []).length === 0 && (
              <div style={{ padding: '1rem 1.125rem', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(74,95,193,0.06) 100%)', border: '1px solid rgba(124,58,237,0.14)' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', margin: '0 0 0.375rem' }}>Start building your product insights</p>
                <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: '0 0 0.75rem', lineHeight: 1.6 }}>
                  Every product exercise you complete turns into a structured insight — capturing how you diagnose friction, where you're accurate, and what themes you're developing mastery in.
                </p>
                <Link to="/product" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.45rem 0.875rem', borderRadius: '8px', backgroundColor: '#7C3AED', color: 'white', textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 600 }}>
                  Go to Product Thinking <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </motion.div>
        )}

        {/* ── EXERCISE LOG TAB ── */}
        {view === 'exercises' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
              <Card>
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Friction Cases</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#7C3AED', margin: '0.5rem 0 0' }}>{insight.totalCases}</p>
              </Card>
              <Card>
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Taste Exercises</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#4A5FC1', margin: '0.5rem 0 0' }}>{(state.tasteExercises ?? []).length}</p>
              </Card>
              <Card>
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reflections</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#D97706', margin: '0.5rem 0 0' }}>{state.reflections.filter(r => r.status === 'approved').length}</p>
              </Card>
            </div>

            {/* CTA card — links to full TransparencyHub */}
            <div style={{
              padding: '1.5rem',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(8,145,178,0.07) 0%, rgba(74,95,193,0.07) 100%)',
              border: '1px solid rgba(8,145,178,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #0891B2 0%, #4A5FC1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldCheck size={20} color="white" />
                </div>
                <div>
                  <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Full Exercise Dashboard</p>
                  <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: '0.125rem 0 0' }}>EQ trends, radar charts, batch milestones, anonymized export</p>
                </div>
              </div>
              <Link
                to="/transparency"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.6rem 1.125rem', borderRadius: '999px',
                  backgroundColor: '#0891B2', color: 'white',
                  fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
                  flexShrink: 0,
                }}
              >
                Open <ArrowRight size={15} />
              </Link>
            </div>

            {/* Recent taste exercises preview */}
            {(state.tasteExercises ?? []).length > 0 && (
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem' }}>
                  Product Taste Exercises
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {(state.tasteExercises ?? []).slice(0, 3).map((te) => (
                    <div key={te.id} style={{ padding: '0.875rem 1rem', borderRadius: '14px', backgroundColor: 'white', border: '1px solid rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #7C3AED 0%, #8B7EC8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FlaskConical size={16} color="white" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{te.productName}</p>
                        <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: '0.125rem 0 0' }}>Score {te.score}/5 · {new Date(te.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                        <Star size={12} color="#7C3AED" fill="#7C3AED" />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#7C3AED' }}>{te.score}/5</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friction case submissions */}
            {submissions.length > 0 && (
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem' }}>
                  Friction Case Log
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {submissions.slice().reverse().slice(0, 8).map(sub => {
                    const meta = THEME_LABELS[sub.theme];
                    const sc = sub.score;
                    const scColor = scoreColor(sc);
                    return (
                      <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '12px', backgroundColor: meta.bg, border: `1px solid ${meta.color}22` }}>
                        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{meta.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937' }}>{meta.label}</span>
                          <span style={{ fontSize: '0.75rem', color: '#9CA3AF', marginLeft: '0.5rem' }}>
                            {sub.rootIssueCorrect ? '✓ Root' : '✗ Root'} · {sub.fixCorrect ? '✓ Fix' : '✗ Fix'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: scColor }}>{Math.round(sc * 100)}%</span>
                          <span style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>{new Date(sub.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {insight.totalCases === 0 && (state.tasteExercises ?? []).length === 0 && (
              <Card>
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                  <Target size={36} style={{ color: '#D1D5DB', margin: '0 auto 0.75rem', display: 'block' }} />
                  <p style={{ color: '#6B7280', margin: 0 }}>
                    No exercises yet. Try a Product Taste Exercise or Friction Case on the Product Thinking page.
                  </p>
                </div>
              </Card>
            )}
          </motion.div>
        )}

        {/* ── REFLECTIONS TAB ── */}
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

                          <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                            {te.summary}
                          </p>

                          {te.evaluation && (() => {
                            const ev = te.evaluation!;
                            const sections: Array<{ label: string; color: string; items: string[] }> = [
                              { label: 'Strengths',                       color: '#16A34A', items: ev.strengths },
                              { label: 'Weaknesses',                      color: '#DC2626', items: ev.weaknesses },
                              { label: 'Signals of strong product taste', color: '#0891B2', items: ev.signals_of_strong_product_taste },
                              { label: 'Missing signals',                 color: '#D97706', items: ev.missing_signals },
                              { label: 'Coaching to improve',             color: '#7C3AED', items: ev.coaching_to_improve },
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
                          backgroundColor: '#F3F4F6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.25rem',
                        }}>
                          📝
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                            {r.approvedEventType && (
                              <span style={{ fontSize: '0.75rem', color: '#6B7280', backgroundColor: '#F3F4F6', padding: '0.125rem 0.5rem', borderRadius: '999px' }}>
                                {r.approvedEventType}{r.approvedCompanyName ? ` at ${r.approvedCompanyName}` : ''}
                              </span>
                            )}
                            <span style={{ fontSize: '0.75rem', color: '#9CA3AF', marginLeft: 'auto' }}>
                              {new Date(r.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                            {r.text}
                          </p>
                          {r.detectedSummary && (
                            <p style={{ fontSize: '0.8125rem', color: '#7C3AED', fontStyle: 'italic', marginTop: '0.625rem', lineHeight: 1.5, padding: '0.5rem 0.75rem', borderRadius: '8px', backgroundColor: 'rgba(139,92,246,0.06)' }}>
                              "{r.detectedSummary}"
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {totalCount === 0 && (
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
