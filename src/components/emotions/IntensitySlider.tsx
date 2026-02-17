import { getIntensityColor, getIntensityLabel } from '../../utils/emotionHelpers';

interface IntensitySliderProps {
  value: number;
  onChange: (value: number) => void;
}

export default function IntensitySlider({ value, onChange }: IntensitySliderProps) {
  const color = getIntensityColor(value);
  const label = getIntensityLabel(value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1F2937' }}>Intensity</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</span>
          <span style={{ fontSize: '0.875rem', color: '#6B7280' }}>/ 10</span>
          <span style={{
            fontSize: '0.75rem', fontWeight: 500, padding: '0.125rem 0.5rem',
            borderRadius: '999px', backgroundColor: `${color}20`, color,
          }}>
            {label}
          </span>
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0, height: '8px',
          borderRadius: '999px', transform: 'translateY(-50%)',
          background: 'linear-gradient(to right, #34D399, #FCD34D, #FB923C, #EF4444)',
        }} />
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: 'relative', width: '100%', height: '8px',
            backgroundColor: 'transparent', cursor: 'pointer', zIndex: 10,
            accentColor: color,
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9CA3AF' }}>
        <span>Calm</span>
        <span>Moderate</span>
        <span>Intense</span>
      </div>
    </div>
  );
}
