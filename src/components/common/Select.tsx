import { type SelectHTMLAttributes, forwardRef, type CSSProperties, useState } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, error, options, placeholder, className = '', style, ...props }, ref) => {
  const [focused, setFocused] = useState(false);

  const selectStyle: CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '12px',
    border: `1px solid ${error ? '#F87171' : focused ? 'transparent' : '#E5E7EB'}`,
    backgroundColor: 'white', color: '#1F2937', fontSize: '0.875rem',
    fontFamily: 'inherit', lineHeight: 1.5, outline: 'none',
    transition: 'all 0.2s ease', cursor: 'pointer',
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
      <select
        ref={ref}
        style={selectStyle}
        className={className}
        onFocus={e => { setFocused(true); props.onFocus?.(e); }}
        onBlur={e => { setFocused(false); props.onBlur?.(e); }}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p style={{ fontSize: '0.8125rem', color: '#EF4444' }}>{error}</p>}
    </div>
  );
});

Select.displayName = 'Select';
export default Select;
