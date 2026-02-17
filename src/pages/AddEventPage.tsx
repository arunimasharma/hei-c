import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Save, ArrowLeft } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import EmotionPicker from '../components/emotions/EmotionPicker';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import TextArea from '../components/common/TextArea';
import { useApp } from '../context/AppContext';
import type { CareerEvent, EmotionType, EventType, EmotionEntry } from '../types';

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'Meeting', label: 'Meeting' },
  { value: 'Project', label: 'Project' },
  { value: 'Review', label: 'Performance Review' },
  { value: 'Interview', label: 'Interview' },
  { value: 'Promotion', label: 'Promotion' },
  { value: 'Feedback', label: 'Feedback' },
  { value: 'Presentation', label: 'Presentation' },
  { value: 'Deadline', label: 'Deadline' },
  { value: 'Conflict', label: 'Conflict' },
  { value: 'Achievement', label: 'Achievement' },
  { value: 'Learning', label: 'Learning' },
  { value: 'Other', label: 'Other' },
];

const OUTCOMES: { value: string; label: string }[] = [
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'pending', label: 'Pending' },
];

export default function AddEventPage() {
  const { state, addEvent, addEmotion } = useApp();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<EventType | ''>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [outcome, setOutcome] = useState('');
  const [immediateEmotion, setImmediateEmotion] = useState<EmotionType | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = () => {
    if (!title.trim()) {
      setError('Please enter an event title');
      return;
    }
    if (!eventType) {
      setError('Please select an event type');
      return;
    }

    const eventId = `event_${Date.now()}`;
    const event: CareerEvent = {
      id: eventId,
      userId: state.user?.id || '',
      title: title.trim(),
      type: eventType,
      date: new Date(date).toISOString(),
      description: description.trim() || undefined,
      outcome: outcome as CareerEvent['outcome'] || undefined,
    };

    addEvent(event);

    if (immediateEmotion) {
      const emotionEntry: EmotionEntry = {
        id: `emotion_${Date.now()}`,
        userId: state.user?.id || '',
        emotion: immediateEmotion,
        intensity: 5,
        timestamp: new Date().toISOString(),
        eventId,
      };
      addEmotion(emotionEntry);
    }

    setSaved(true);
    setTimeout(() => navigate('/'), 1500);
  };

  if (saved) {
    return (
      <DashboardLayout>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 0' }}
        >
          <div style={{ fontSize: '3.75rem', marginBottom: '1rem' }}>📋</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.5rem' }}>Event Added!</h2>
          <p style={{ color: '#6B7280' }}>Your career event has been recorded.</p>
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1F2937' }}>Add Career Event</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Input
              label="Event Title"
              placeholder="e.g., Q4 Project Presentation"
              value={title}
              onChange={e => { setTitle(e.target.value); setError(''); }}
              error={error && !title.trim() ? error : undefined}
              autoFocus
            />

            <Select
              label="Event Type"
              options={EVENT_TYPES}
              placeholder="Select event type"
              value={eventType}
              onChange={e => { setEventType(e.target.value as EventType); setError(''); }}
              error={error && !eventType ? error : undefined}
            />

            <Input
              label="Date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />

            <TextArea
              label="Description"
              placeholder="Describe the event in detail..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />

            <Select
              label="Outcome"
              options={OUTCOMES}
              placeholder="Select outcome (optional)"
              value={outcome}
              onChange={e => setOutcome(e.target.value)}
            />
          </div>

          <div style={cardStyle}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1F2937', marginBottom: '1rem' }}>Immediate Emotional Response (Optional)</h3>
            <EmotionPicker selected={immediateEmotion} onSelect={setImmediateEmotion} compact />
          </div>

          <Button size="lg" fullWidth onClick={handleSubmit}>
            <Save size={18} /> Save Event
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
