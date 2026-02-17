import { Trash2, Edit2, CheckCircle2, Pause, Play } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import type { Goal, GoalType } from '../../types';

interface GoalCardProps {
  goal: Goal & { type: GoalType };
  onEdit: (goal: Goal & { type: GoalType }) => void;
  onDelete: (id: string) => void;
  onUpdateProgress: (id: string, progress: number) => void;
  onUpdateStatus: (id: string, status: 'active' | 'completed' | 'paused' | 'archived') => void;
}

export default function GoalCard({
  goal,
  onEdit,
  onDelete,
  onUpdateProgress,
  onUpdateStatus,
}: GoalCardProps) {
  const isCompleted = goal.status === 'completed';
  const isPaused = goal.status === 'paused';
  const isActive = goal.status === 'active';
  const isCareer = goal.type === 'career';

  const statusColor = {
    active: '#10B981',
    completed: '#3B82F6',
    paused: '#F59E0B',
    archived: '#9CA3AF',
  };

  const typeLabel = isCareer ? '💼 Career Goal' : '✨ Emotional Intelligence';
  const focusArea =
    !isCareer && 'focusArea' in goal
      ? goal.focusArea.replace(/-/g, ' ').toUpperCase()
      : null;

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'start',
          marginBottom: '1rem',
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: isCareer ? '#FEF3C7' : '#E0E7FF',
                color: isCareer ? '#92400E' : '#3730A3',
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
              }}
            >
              {typeLabel}
            </span>
            {focusArea && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: '#F3E8FF',
                  color: '#6B21A8',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '999px',
                }}
              >
                {focusArea}
              </span>
            )}
          </div>
          <h3
            style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#1F2937',
              marginBottom: '0.5rem',
            }}
          >
            {goal.title}
          </h3>
          <p style={{ color: '#6B7280', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            {goal.description}
          </p>
          <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '1rem' }}>
            Target: {new Date(goal.targetDate).toLocaleDateString()}
          </div>
        </div>

        {/* Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            paddingLeft: '1rem',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'white',
              backgroundColor: statusColor[goal.status],
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
            }}
          >
            {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
          }}
        >
          <span style={{ color: '#6B7280', fontWeight: 500 }}>Progress</span>
          <span style={{ color: '#1F2937', fontWeight: 600 }}>{goal.progress}%</span>
        </div>
        <div
          style={{
            width: '100%',
            height: '8px',
            borderRadius: '999px',
            backgroundColor: '#E5E7EB',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: isCompleted ? '#3B82F6' : '#10B981',
              width: `${goal.progress}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Control buttons */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isActive && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUpdateStatus(goal.id, 'paused')}
              >
                <Pause size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newProgress = Math.min(goal.progress + 10, 100);
                  onUpdateProgress(goal.id, newProgress);
                  if (newProgress === 100) {
                    onUpdateStatus(goal.id, 'completed');
                  }
                }}
              >
                <CheckCircle2 size={16} />
              </Button>
            </>
          )}
          {isPaused && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdateStatus(goal.id, 'active')}
            >
              <Play size={16} />
            </Button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="ghost" size="sm" onClick={() => onEdit(goal)}>
            <Edit2 size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(goal.id)}
            style={{ color: '#EF4444' }}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {goal.notes && (
        <div
          style={{
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #E5E7EB',
          }}
        >
          <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>
            <strong>Notes:</strong> {goal.notes}
          </p>
        </div>
      )}
    </Card>
  );
}
