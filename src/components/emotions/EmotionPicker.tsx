import { motion } from 'motion/react';
import { EMOTIONS } from '../../utils/emotionHelpers';
import type { EmotionType } from '../../types';

interface EmotionPickerProps {
  selected: EmotionType | null;
  onSelect: (emotion: EmotionType) => void;
  compact?: boolean;
}

export default function EmotionPicker({ selected, onSelect, compact = false }: EmotionPickerProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: compact ? 'repeat(4, 1fr)' : 'repeat(auto-fill, minmax(90px, 1fr))',
      gap: compact ? '0.5rem' : '0.75rem',
    }}>
      {EMOTIONS.map(({ type, icon, color }) => {
        const isSelected = selected === type;
        return (
          <motion.button
            key={type}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(type)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '0.25rem', padding: compact ? '0.5rem' : '0.75rem',
              borderRadius: '12px', border: `2px solid ${isSelected ? color : '#F3F4F6'}`,
              backgroundColor: isSelected ? `${color}15` : 'white',
              cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: compact ? '1.25rem' : '1.5rem' }}>{icon}</span>
            <span style={{
              fontWeight: 500, fontSize: compact ? '0.75rem' : '0.8125rem',
              color: isSelected ? '#1F2937' : '#6B7280',
            }}>
              {type}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
