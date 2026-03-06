import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import Button from '../common/Button';
import { EMOTIONS, getEmotionIcon } from '../../utils/emotionHelpers';
import type { EmotionType } from '../../types';

interface EmotionGameProps {
  onComplete: () => void;
}

interface Scenario {
  id: number;
  situation: string;
  emoji: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    situation: 'Your presentation goes better than expected',
    emoji: '🎤',
  },
  {
    id: 2,
    situation: 'You get critical feedback on your work',
    emoji: '📝',
  },
  {
    id: 3,
    situation: 'A colleague takes credit for your idea',
    emoji: '💭',
  },
  {
    id: 4,
    situation: 'You land that promotion you wanted',
    emoji: '🚀',
  },
  {
    id: 5,
    situation: 'A meeting gets cancelled last minute',
    emoji: '📅',
  },
];

export default function EmotionGame({ onComplete }: EmotionGameProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedEmotions, setSelectedEmotions] = useState<EmotionType[]>([]);
  const [showResults, setShowResults] = useState(false);

  const currentScenario = SCENARIOS[currentStep];
  const isLastScenario = currentStep === SCENARIOS.length - 1;

  const handleSelectEmotion = (emotionType: EmotionType) => {
    const newEmotions = [...selectedEmotions];
    newEmotions[currentStep] = emotionType;
    setSelectedEmotions(newEmotions);

    // Auto-advance after selection
    setTimeout(() => {
      if (isLastScenario) {
        setShowResults(true);
      } else {
        setCurrentStep(currentStep + 1);
      }
    }, 600);
  };

  const topEmotions = selectedEmotions.length > 0
    ? Object.entries(
        selectedEmotions.filter(Boolean).reduce(
          (counts, emotion) => {
            counts[emotion] = (counts[emotion] || 0) + 1;
            return counts;
          },
          {} as Record<EmotionType, number>
        )
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([emotion]) => emotion)
    : [];

  if (showResults) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          textAlign: 'center',
          padding: '2rem',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ fontSize: '3rem', marginBottom: '1rem' }}
        >
          ✨
        </motion.div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', marginTop: 0 }}>
          You're an Emotional Navigator!
        </h2>

        <p style={{ marginBottom: '1.5rem', opacity: 0.95, fontSize: '0.95rem' }}>
          You just tracked 5 workplace moments and revealed your emotional patterns.
        </p>

        <div
          style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            backdropFilter: 'blur(10px)',
          }}
        >
          <p style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.75rem', marginTop: 0 }}>
            Your dominant emotions:
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {topEmotions.map((emotionType) => (
              <motion.div
                key={emotionType}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  padding: '0.5rem 1rem',
                  borderRadius: '20px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                {emotionType}
              </motion.div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '1.5rem' }}>
          Hello-EQ helps you understand these patterns, build EI, and make smarter career decisions.
        </p>

        <Button
          onClick={onComplete}
          size="lg"
          style={{
            backgroundColor: 'white',
            color: '#667eea',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} /> Ready to Go <ArrowRight size={18} />
        </Button>
      </motion.div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Progress bar */}
      <div style={{ marginBottom: '2rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
          }}
        >
          <h3
            style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#1F2937',
              margin: 0,
            }}
          >
            Feel the Patterns
          </h3>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#9CA3AF' }}>
            {currentStep + 1}/{SCENARIOS.length}
          </span>
        </div>
        <div
          style={{
            width: '100%',
            height: '6px',
            backgroundColor: '#E5E7EB',
            borderRadius: '999px',
            overflow: 'hidden',
          }}
        >
          <motion.div
            layoutId="progress"
            animate={{
              width: `${((currentStep + 1) / SCENARIOS.length) * 100}%`,
            }}
            transition={{ duration: 0.4 }}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            }}
          />
        </div>
      </div>

      {/* Scenario */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <div
            style={{
              textAlign: 'center',
              marginBottom: '2rem',
              padding: '1.5rem',
              backgroundColor: '#F9FAFB',
              borderRadius: '16px',
              border: '2px solid #F3F4F6',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
              {currentScenario.emoji}
            </div>
            <p
              style={{
                fontSize: '1.125rem',
                fontWeight: 500,
                color: '#1F2937',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {currentScenario.situation}
            </p>
          </div>

          {/* Emotion selector */}
          <p
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '1rem',
              marginTop: 0,
            }}
          >
            How do you feel?
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem',
              marginBottom: '1.5rem',
            }}
          >
            {EMOTIONS.slice(0, 6).map((emotionObj) => {
              const isSelected = selectedEmotions[currentStep] === emotionObj.type;
              const color = emotionObj.color;

              return (
                <motion.button
                  key={emotionObj.type}
                  onClick={() => handleSelectEmotion(emotionObj.type)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    padding: '1rem 0.75rem',
                    borderRadius: '12px',
                    border: isSelected ? `2px solid ${color}` : '2px solid #E5E7EB',
                    backgroundColor: isSelected ? `${color}15` : '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>
                    {getEmotionIcon(emotionObj.type)}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: isSelected ? color : '#6B7280',
                    }}
                  >
                    {emotionObj.type}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Selection indicator */}
          {selectedEmotions[currentStep] && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                color: '#10B981',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={16} /> Selection recorded
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
