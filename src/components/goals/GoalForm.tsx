import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import TextArea from '../common/TextArea';
import Modal from '../common/Modal';
import type { CareerGoal, EmotionalIntelligenceGoal, GoalType } from '../../types';

interface GoalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (goal: CareerGoal | EmotionalIntelligenceGoal) => void;
  goal?: (CareerGoal | EmotionalIntelligenceGoal) & { type: GoalType };
  userId: string;
}

export default function GoalForm({
  isOpen,
  onClose,
  onSubmit,
  goal,
  userId,
}: GoalFormProps) {
  const [type, setType] = useState<GoalType>(
    goal && 'focusArea' in goal ? 'emotional-intelligence' : 'career'
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'active' | 'completed' | 'paused' | 'archived'>(
    'active'
  );
  const [focusArea, setFocusArea] = useState<
    'self-awareness' | 'self-regulation' | 'empathy' | 'social-skills' | 'motivation'
  >('self-awareness');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (goal) {
      setTitle(goal.title);
      setDescription(goal.description);
      setTargetDate(goal.targetDate);
      setProgress(goal.progress);
      setStatus(goal.status);
      setNotes(goal.notes || '');
      if ('focusArea' in goal) {
        setFocusArea(goal.focusArea);
      }
    } else {
      resetForm();
    }
  }, [goal, isOpen]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTargetDate('');
    setProgress(0);
    setStatus('active');
    setFocusArea('self-awareness');
    setNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !targetDate) {
      alert('Please fill in required fields');
      return;
    }

    const now = new Date().toISOString();

    if (type === 'career') {
      const careerGoal: CareerGoal = {
        id: goal?.id || Math.random().toString(36).substr(2, 9),
        userId,
        title,
        description,
        targetDate,
        status,
        progress,
        notes: notes || undefined,
        relatedEventIds: (goal && 'relatedEventIds' in goal) ? (goal as CareerGoal).relatedEventIds : [],
        createdAt: goal?.createdAt || now,
        updatedAt: now,
      };
      onSubmit(careerGoal);
    } else {
      const eiGoal: EmotionalIntelligenceGoal = {
        id: goal?.id || Math.random().toString(36).substr(2, 9),
        userId,
        title,
        description,
        targetDate,
        status,
        progress,
        focusArea,
        notes: notes || undefined,
        relatedEmotionIds: (goal && 'relatedEmotionIds' in goal) ? (goal as EmotionalIntelligenceGoal).relatedEmotionIds : [],
        createdAt: goal?.createdAt || now,
        updatedAt: now,
      };
      onSubmit(eiGoal);
    }

    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '500px',
          width: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1F2937' }}>
            {goal ? 'Edit Goal' : 'Create New Goal'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.5rem',
              color: '#6B7280',
            }}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Goal Type
            </label>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as GoalType)}
              options={[
                { value: 'career', label: '💼 Career Goal' },
                { value: 'emotional-intelligence', label: '✨ Emotional Intelligence' },
              ]}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Title *
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter goal title"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Description
            </label>
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your goal"
              rows={3}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Target Date *
            </label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Progress: {progress}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Status
            </label>
            <Select
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value as 'active' | 'completed' | 'paused' | 'archived'
                )
              }
              options={[
                { value: 'active', label: 'Active' },
                { value: 'paused', label: 'Paused' },
                { value: 'completed', label: 'Completed' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </div>

          {type === 'emotional-intelligence' && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Focus Area
              </label>
              <Select
                value={focusArea}
                onChange={(e) =>
                  setFocusArea(
                    e.target.value as
                      | 'self-awareness'
                      | 'self-regulation'
                      | 'empathy'
                      | 'social-skills'
                      | 'motivation'
                  )
                }
                options={[
                  { value: 'self-awareness', label: 'Self-Awareness' },
                  { value: 'self-regulation', label: 'Self-Regulation' },
                  { value: 'empathy', label: 'Empathy' },
                  { value: 'social-skills', label: 'Social Skills' },
                  { value: 'motivation', label: 'Motivation' },
                ]}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Notes
            </label>
            <TextArea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes"
              rows={2}
            />
          </div>

          <div
            style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}
          >
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {goal ? 'Update Goal' : 'Create Goal'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
