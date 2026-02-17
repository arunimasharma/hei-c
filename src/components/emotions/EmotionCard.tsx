import { motion } from 'motion/react';
import { Clock, Tag, Trash2, Edit2 } from 'lucide-react';
import type { EmotionEntry, CareerEvent } from '../../types';
import { getEmotionColor, getEmotionIcon, getIntensityColor } from '../../utils/emotionHelpers';
import { formatDateTime } from '../../utils/dateHelpers';

interface EmotionCardProps {
  entry: EmotionEntry;
  event?: CareerEvent;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  compact?: boolean;
}

export default function EmotionCard({ entry, event, onDelete, onEdit, compact = false }: EmotionCardProps) {
  const emotionColor = getEmotionColor(entry.emotion);
  const intensityColor = getIntensityColor(entry.intensity);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        backgroundColor: 'white', borderRadius: '16px', border: '1px solid #F3F4F6',
        padding: compact ? '0.875rem' : '1.25rem', transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '40px', height: '40px', borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.25rem', backgroundColor: `${emotionColor}15`,
            }}
          >
            {getEmotionIcon(entry.emotion)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 600, color: '#1F2937', fontSize: '0.9375rem' }}>{entry.emotion}</span>
              <span
                style={{
                  fontSize: '0.75rem', fontWeight: 500, padding: '0.125rem 0.5rem',
                  borderRadius: '999px', backgroundColor: `${intensityColor}20`, color: intensityColor,
                }}
              >
                {entry.intensity}/10
              </span>
            </div>
            {event && (
              <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.125rem' }}>{event.title}</p>
            )}
          </div>
        </div>

        {(onEdit || onDelete) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {onEdit && (
              <button
                onClick={() => onEdit(entry.id)}
                style={{
                  padding: '0.375rem', borderRadius: '8px', border: 'none',
                  backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
                  color: '#9CA3AF', transition: 'all 0.2s',
                }}
                aria-label="Edit"
              >
                <Edit2 size={14} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(entry.id)}
                style={{
                  padding: '0.375rem', borderRadius: '8px', border: 'none',
                  backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
                  color: '#9CA3AF', transition: 'all 0.2s',
                }}
                aria-label="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {!compact && entry.notes && (
        <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.5rem' }}>{entry.notes}</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#9CA3AF' }}>
          <Clock size={12} />
          {formatDateTime(entry.timestamp)}
        </span>
        {entry.triggers && entry.triggers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Tag size={12} color="#9CA3AF" />
            {entry.triggers.map(t => (
              <span key={t} style={{
                fontSize: '0.75rem', backgroundColor: '#F3F4F6', color: '#6B7280',
                padding: '0.125rem 0.375rem', borderRadius: '4px',
              }}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
