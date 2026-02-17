import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { BarChart3, List, Search, Filter, ArrowLeft, Trash2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import DashboardLayout from '../components/layout/DashboardLayout';
import EmotionCard from '../components/emotions/EmotionCard';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Modal from '../components/common/Modal';
import { useApp } from '../context/AppContext';
import { EMOTIONS } from '../utils/emotionHelpers';
import { formatDate, getDateGroup } from '../utils/dateHelpers';
import type { EmotionType } from '../types';

export default function TimelinePage() {
  const { state, deleteEmotion } = useApp();
  const navigate = useNavigate();
  const [view, setView] = useState<'chart' | 'list'>('chart');
  const [filterEmotion, setFilterEmotion] = useState<EmotionType | ''>('');
  const [filterIntensityMin, setFilterIntensityMin] = useState(1);
  const [filterIntensityMax, setFilterIntensityMax] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filteredEmotions = useMemo(() => {
    let result = [...state.emotions].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (filterEmotion) {
      result = result.filter(e => e.emotion === filterEmotion);
    }
    result = result.filter(e => e.intensity >= filterIntensityMin && e.intensity <= filterIntensityMax);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.emotion.toLowerCase().includes(q) ||
        e.notes?.toLowerCase().includes(q) ||
        e.triggers?.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [state.emotions, filterEmotion, filterIntensityMin, filterIntensityMax, searchQuery]);

  const chartData = useMemo(() => {
    const sorted = [...state.emotions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const byDate = new Map<string, Record<string, number>>();
    sorted.forEach(e => {
      const dateKey = formatDate(e.timestamp);
      if (!byDate.has(dateKey)) byDate.set(dateKey, {});
      const entry = byDate.get(dateKey)!;
      if (!entry[e.emotion] || e.intensity > entry[e.emotion]) {
        entry[e.emotion] = e.intensity;
      }
    });

    return Array.from(byDate.entries()).map(([date, emotions]) => ({
      date,
      ...emotions,
    }));
  }, [state.emotions]);

  const activeEmotionTypes = useMemo(() => {
    const types = new Set(state.emotions.map(e => e.emotion));
    return EMOTIONS.filter(e => types.has(e.type));
  }, [state.emotions]);

  const groupedEmotions = useMemo(() => {
    const groups = new Map<string, typeof filteredEmotions>();
    filteredEmotions.forEach(e => {
      const group = getDateGroup(e.timestamp);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(e);
    });
    return groups;
  }, [filteredEmotions]);

  const handleDelete = (id: string) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteEmotion(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const viewBtnStyle = (active: boolean) => ({
    padding: '0.625rem', borderRadius: '12px', border: active ? 'none' : '1px solid #F3F4F6',
    backgroundColor: active ? '#4A5FC1' : 'white', color: active ? 'white' : '#6B7280',
    cursor: 'pointer' as const, display: 'flex' as const, transition: 'all 0.2s',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
  });

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                padding: '0.5rem', borderRadius: '12px', border: 'none',
                backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
                color: '#6B7280',
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1F2937' }}>Timeline</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => setView('chart')} style={viewBtnStyle(view === 'chart')} aria-label="Chart view">
              <BarChart3 size={18} />
            </button>
            <button onClick={() => setView('list')} style={viewBtnStyle(view === 'list')} aria-label="List view">
              <List size={18} />
            </button>
          </div>
        </div>

        {state.emotions.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1F2937', marginBottom: '0.5rem' }}>No Data Yet</h2>
              <p style={{ color: '#6B7280', marginBottom: '1.25rem' }}>Start logging emotions to see your patterns over time.</p>
              <Button onClick={() => navigate('/add-emotion')}>Log Your First Emotion</Button>
            </div>
          </Card>
        ) : (
          <>
            {view === 'chart' && (
              <Card>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937', marginBottom: '1.25rem' }}>Emotional Intensity Over Time</h2>
                <div style={{ height: '400px', marginLeft: '-0.5rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <defs>
                        {activeEmotionTypes.map(({ type, color }) => (
                          <linearGradient key={type} id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #E5E7EB',
                          borderRadius: '12px',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                          padding: '12px',
                        }}
                      />
                      <Legend />
                      {activeEmotionTypes.map(({ type, color }) => (
                        <Area
                          key={type}
                          type="monotone"
                          dataKey={type}
                          stroke={color}
                          fill={`url(#gradient-${type})`}
                          strokeWidth={2}
                          connectNulls
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {view === 'list' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                    <input
                      type="text"
                      placeholder="Search emotions, notes, triggers..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%', paddingLeft: '2.5rem', paddingRight: '1rem',
                        paddingTop: '0.75rem', paddingBottom: '0.75rem',
                        borderRadius: '12px', border: '1px solid #E5E7EB',
                        backgroundColor: 'white', fontSize: '0.875rem',
                        outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    style={{
                      padding: '0.75rem', borderRadius: '12px', cursor: 'pointer', display: 'flex',
                      border: showFilters ? 'none' : '1px solid #E5E7EB',
                      backgroundColor: showFilters ? '#4A5FC1' : 'white',
                      color: showFilters ? 'white' : '#6B7280',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Filter size={18} />
                  </button>
                </div>

                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{
                      backgroundColor: 'white', borderRadius: '16px', border: '1px solid #F3F4F6',
                      padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div>
                      <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1F2937', display: 'block', marginBottom: '0.375rem' }}>Emotion Type</label>
                      <select
                        value={filterEmotion}
                        onChange={e => setFilterEmotion(e.target.value as EmotionType | '')}
                        style={{
                          width: '100%', padding: '0.625rem 1rem', borderRadius: '12px',
                          border: '1px solid #E5E7EB', fontSize: '0.875rem',
                          outline: 'none', fontFamily: 'inherit', backgroundColor: 'white',
                        }}
                      >
                        <option value="">All Emotions</option>
                        {EMOTIONS.map(e => (
                          <option key={e.type} value={e.type}>{e.icon} {e.type}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1F2937', display: 'block', marginBottom: '0.375rem' }}>
                        Intensity Range: {filterIntensityMin} - {filterIntensityMax}
                      </label>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <input type="range" min={1} max={10} value={filterIntensityMin}
                          onChange={e => setFilterIntensityMin(Math.min(Number(e.target.value), filterIntensityMax))}
                          style={{ flex: 1 }}
                        />
                        <input type="range" min={1} max={10} value={filterIntensityMax}
                          onChange={e => setFilterIntensityMax(Math.max(Number(e.target.value), filterIntensityMin))}
                          style={{ flex: 1 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {Array.from(groupedEmotions.entries()).map(([group, entries]) => (
                    <div key={group}>
                      <h3 style={{
                        fontSize: '0.75rem', fontWeight: 600, color: '#6B7280',
                        marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>{group}</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {entries.map(entry => (
                          <EmotionCard
                            key={entry.id}
                            entry={entry}
                            event={state.events.find(e => e.id === entry.eventId)}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {filteredEmotions.length === 0 && (
                  <Card>
                    <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
                      <Search size={36} style={{ color: '#9CA3AF', margin: '0 auto 0.75rem' }} />
                      <p style={{ color: '#6B7280' }}>No results match your filters</p>
                    </div>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>

      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Entry">
        <p style={{ color: '#6B7280', marginBottom: '1.25rem' }}>Are you sure you want to delete this emotion entry? This cannot be undone.</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)} style={{ flex: 1 }}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete} style={{ flex: 1 }}>
            <Trash2 size={16} /> Delete
          </Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
