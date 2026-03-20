/**
 * InfoTooltip
 * Small ⓘ icon that shows an explanatory tooltip on hover/focus.
 * Uses inline styles + React state — no external deps.
 */

import { useState, useRef, useCallback } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
  /** Optional width override (default: 220px) */
  width?: number;
  /** Tooltip anchor side relative to icon (default: 'right') */
  side?: 'left' | 'right' | 'top' | 'bottom';
  iconSize?: number;
  iconColor?: string;
}

export default function InfoTooltip({
  text,
  width = 220,
  side = 'right',
  iconSize = 14,
  iconColor = '#9CA3AF',
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    hideTimer.current = setTimeout(() => setOpen(false), 100);
  }, []);

  // Tooltip position by side
  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 200,
    width: `${width}px`,
    padding: '0.625rem 0.75rem',
    borderRadius: '10px',
    backgroundColor: '#1F2937',
    color: 'white',
    fontSize: '0.78rem',
    lineHeight: 1.55,
    fontWeight: 400,
    boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
    pointerEvents: 'none',
    whiteSpace: 'normal',
    ...(side === 'right'  && { left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' }),
    ...(side === 'left'   && { right: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' }),
    ...(side === 'top'    && { bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' }),
    ...(side === 'bottom' && { top: 'calc(100% + 8px)',  left: '50%', transform: 'translateX(-50%)' }),
  };

  // Small arrow indicator
  const arrowStyle: React.CSSProperties = {
    position: 'absolute',
    width: '7px',
    height: '7px',
    backgroundColor: '#1F2937',
    transform: 'rotate(45deg)',
    ...(side === 'right'  && { left: '-3px',  top: '50%', marginTop: '-3.5px' }),
    ...(side === 'left'   && { right: '-3px', top: '50%', marginTop: '-3.5px' }),
    ...(side === 'top'    && { bottom: '-3px', left: '50%', marginLeft: '-3.5px' }),
    ...(side === 'bottom' && { top: '-3px',   left: '50%', marginLeft: '-3.5px' }),
  };

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <button
        type="button"
        aria-label="More information"
        style={{
          border: 'none', background: 'none', padding: '1px', cursor: 'help',
          display: 'flex', alignItems: 'center', lineHeight: 0,
          color: iconColor,
        }}
      >
        <Info size={iconSize} />
      </button>

      {open && (
        <span style={tooltipStyle} role="tooltip">
          <span style={arrowStyle} />
          {text}
        </span>
      )}
    </span>
  );
}
