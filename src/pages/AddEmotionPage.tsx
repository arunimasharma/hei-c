import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Save, ArrowLeft } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import EmotionPicker from '../components/emotions/EmotionPicker';
import IntensitySlider from '../components/emotions/IntensitySlider';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import TextArea from '../components/common/TextArea';
import Input from '../components/common/Input';
import { useApp } from '../context/AppContext';
import type { EmotionType, EmotionEntry } from '../types';

export default function AddEmotionPage() {
  const { state, addEmotion } = useApp();
  const navigate = useNavigate();
  const [emotion, setEmotion] = useState<EmotionType | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [eventId, setEventId] = useState('');
  const [notes, setNotes] = useState('');
  const [triggers, setTriggers] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = () => {
    if (!emotion) {
      setError('Please select an emotion');
      return;
    }

    const entry: EmotionEntry = {
      id: `emotion_${Date.now()}`,
      userId: state.user?.id || '',
      emotion,
      intensity,
      timestamp: new Date(date).toISOString(),
      eventId: eventId || undefined,
      notes: notes.trim() || undefined,
      triggers: triggers.trim() ? triggers.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    };

    addEmotion(entry);
    setSaved(true);
    setTimeout(() => navigate('/'), 1500);
  };

  const eventOptions = state.events.map(e => ({ value: e.id, label: e.title }));

  if (saved) {
    return (
      <DashboardLayout>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 0' }}
        >
          <div style={{ fontSize: '3.75rem', marginBottom: '1rem' }}>✨</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.5rem' }}>Emotion Logged!</h2>
          <p style={{ color: '#6B7280' }}>Great job tracking your feelings.</p>
        </motion.div>
      </DashboardLayout>
    );
  }

  const cardStyle = {
    backgroundColor: 'white', borderRadius: '16px', border: '1px solid #F3F4F6',
    padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: '42rem', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1F2937' }}>Log an Emotion</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={cardStyle}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1F2937', marginBottom: '1rem' }}>How are you feeling?</h3>
            <EmotionPicker selected={emotion} onSelect={setEmotion} />
            {error && !emotion && <p style={{ fontSize: '0.875rem', color: '#EF4444', marginTop: '0.5rem' }}>{error}</p>}
          </div>

          <div style={cardStyle}>
            <IntensitySlider value={intensity} onChange={setIntensity} />
          </div>

          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Select
              label="Associated Career Event"
              options={eventOptions}
              placeholder="Select an event (optional)"
              value={eventId}
              onChange={e => setEventId(e.target.value)}
            />

            <TextArea
              label="Context Notes"
              placeholder="What's happening? Any additional thoughts..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />

            <Input
              label="Triggers"
              placeholder="e.g., deadline, feedback, meeting (comma-separated)"
              value={triggers}
              onChange={e => setTriggers(e.target.value)}
              helperText="Optional tags for what triggered this emotion"
            />

            <Input
              label="Date & Time"
              type="datetime-local"
              value={date}
              onChange={e => setDate(e.target.value)}
              max={new Date().toISOString().slice(0, 16)}
            />
          </div>

          <Button size="lg" fullWidth onClick={handleSubmit}>
            <Save size={18} /> Save Emotion
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
