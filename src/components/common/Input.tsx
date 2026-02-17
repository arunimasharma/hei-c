import { type InputHTMLAttributes, forwardRef, type CSSProperties, useState } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, helperText, className = '', style, ...props }, ref) => {
  const [focused, setFocused] = useState(false);

  const inputStyle: CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '12px',
    border: `1px solid ${error ? '#F87171' : focused ? 'transparent' : '#E5E7EB'}`,
    backgroundColor: 'white', color: '#1F2937', fontSize: '0.875rem',
    fontFamily: 'inherit', lineHeight: 1.5, outline: 'none',
    transition: 'all 0.2s ease',
    boxShadow: focused ? `0 0 0 3px ${error ? 'rgba(248,113,113,0.15)' : 'rgba(74,95,193,0.12)'}` : 'none',
    ...style,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {label && (
        <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1F2937' }}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        style={inputStyle}
        className={className}
        onFocus={e => { setFocused(true); props.onFocus?.(e); }}
        onBlur={e => { setFocused(false); props.onBlur?.(e); }}
        {...props}
      />
      {error && <p style={{ fontSize: '0.8125rem', color: '#EF4444' }}>{error}</p>}
      {helperText && !error && <p style={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>{helperText}</p>}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
