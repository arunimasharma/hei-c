import { type CSSProperties } from 'react';
import type { ValidatorMode } from '../../types/validator';

interface ModeToggleProps {
  mode: ValidatorMode;
  onChange: (mode: ValidatorMode) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{ value: ValidatorMode; label: string }> = [
  { value: 'quick_prototype', label: 'Quick prototype' },
  { value: 'strategic_bet',   label: 'Strategic bet' },
];

export default function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  const wrapper: CSSProperties = {
    display: 'inline-flex',
    backgroundColor: '#F3F4F6',
    borderRadius: '10px',
    padding: '0.25rem',
    gap: '0.125rem',
  };

  return (
    <div style={wrapper} role="radiogroup" aria-label="Interview mode">
      {OPTIONS.map(opt => {
        const active = mode === opt.value;
        const buttonStyle: CSSProperties = {
          padding: '0.4rem 0.875rem',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: active ? '#FFFFFF' : 'transparent',
          color: active ? '#1F2937' : '#6B7280',
          fontSize: '0.8125rem',
          fontWeight: active ? 600 : 500,
          fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          transition: 'all 0.15s ease',
        };
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            style={buttonStyle}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
