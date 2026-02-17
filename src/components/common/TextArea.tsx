import { type TextareaHTMLAttributes, forwardRef, type CSSProperties, useState } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({ label, error, className = '', style, ...props }, ref) => {
  const [focused, setFocused] = useState(false);

  const textareaStyle: CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '12px',
    border: `1px solid ${error ? '#F87171' : focused ? 'transparent' : '#E5E7EB'}`,
    backgroundColor: 'white', color: '#1F2937', fontSize: '0.875rem',
    fontFamily: 'inherit', lineHeight: 1.6, outline: 'none', resize: 'none',
    transition: 'all 0.2s ease',
    boxShadow: focused ? '0 0 0 3px rgba(74,95,193,0.12)' : 'none',
    ...style,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {label && (
        <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1F2937' }}>
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        style={textareaStyle}
        className={className}
        rows={4}
        onFocus={e => { setFocused(true); props.onFocus?.(e); }}
        onBlur={e => { setFocused(false); props.onBlur?.(e); }}
        {...props}
      />
      {error && <p style={{ fontSize: '0.8125rem', color: '#EF4444' }}>{error}</p>}
    </div>
  );
});

TextArea.displayName = 'TextArea';
export default TextArea;
