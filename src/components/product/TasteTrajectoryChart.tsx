/**
 * TasteTrajectoryChart
 *
 * SVG-based line chart that visualises a user's accuracy growth across
 * Friction Case exercises over time.
 *
 * Features:
 *  - Smooth monotone-cubic interpolation (no spiky jags)
 *  - Overall line + per-theme toggleable lines
 *  - Expert-threshold guide at 60%
 *  - Milestone markers: first attempt, personal best, expert crossing
 *  - Hover tooltip snapping to nearest data point
 *  - Insight cards auto-generated from trajectory data
 *  - Line draw-in animation on mount / data change
 *  - Empty / sparse state handling
 *
 * Usage:
 *   <TasteTrajectoryChart />
 *   <TasteTrajectoryChart useMockData />   ← demo / dev mode
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, TrendingDown, Minus, BarChart3, Target } from 'lucide-react';
import type { FrictionTheme } from '../../data/frictionCases';
import {
  getCachedOrComputeSeries,
  buildTrajectorySeries,
  computeTrajectoryInsights,
  getMockTrajectoryData,
  type TrajectorySeries,
  type TrajectoryInsight,
  type TrajectoryPoint,
} from '../../utils/trajectory';

// ── Theme palette (mirrors THEME_LABELS in frictionCases) ─────────────────────

const THEME_CFG: Record<FrictionTheme, { color: string; label: string; emoji: string }> = {
  pricing:    { color: '#D97706', label: 'Pricing',    emoji: '💰' },
  ux:         { color: '#4A5FC1', label: 'UX',         emoji: '🎨' },
  onboarding: { color: '#10B981', label: 'Onboarding', emoji: '🗺️' },
  value:      { color: '#7C3AED', label: 'Value',      emoji: '🎯' },
  trust:      { color: '#EC4899', label: 'Trust',      emoji: '🔒' },
};

const OVERALL_COLOR  = '#111827';
const EXPERT_COLOR   = '#16A34A';
const GRID_COLOR     = '#F3F4F6';
const AXIS_COLOR     = '#9CA3AF';
const EXPERT_Y       = 60;           // accuracy % that unlocks expert tag

// ── Layout constants ──────────────────────────────────────────────────────────

const H         = 268;               // total SVG height
const PAD_L     = 44;                // room for Y-axis labels
const PAD_R     = 20;
const PAD_T     = 20;
const PAD_B     = 44;                // room for X-axis labels
const PLOT_H    = H - PAD_T - PAD_B; // 204 px plot area height

type SeriesKey = 'overall' | FrictionTheme;

// ── Monotone cubic interpolation ──────────────────────────────────────────────

/**
 * Converts an array of SVG {x,y} points into a smooth cubic Bézier path
 * using the Fritsch–Carlson monotone algorithm. Guarantees the curve passes
 * through every point without overshooting.
 */
function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${r(pts[0].x)},${r(pts[0].y)}`;
  if (n === 2) return `M${r(pts[0].x)},${r(pts[0].y)} L${r(pts[1].x)},${r(pts[1].y)}`;

  const dx = pts.slice(1).map((p, i) => p.x - pts[i].x);
  const dy = pts.slice(1).map((p, i) => p.y - pts[i].y);
  const s  = dx.map((d, i) => (d === 0 ? 0 : dy[i] / d)); // inter-point slopes

  // Initial tangent estimates (Catmull-Rom–style)
  const m = new Array<number>(n);
  m[0]     = s[0];
  m[n - 1] = s[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2;
  }

  // Fritsch–Carlson: rescale tangents to ensure monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(s[i]) < 1e-9) { m[i] = m[i + 1] = 0; continue; }
    const α = m[i]     / s[i];
    const β = m[i + 1] / s[i];
    const τ = α * α + β * β;
    if (τ > 9) {
      const k = 3 / Math.sqrt(τ);
      m[i]     = k * α * s[i];
      m[i + 1] = k * β * s[i];
    }
  }

  // Assemble cubic Bézier path
  let d = `M${r(pts[0].x)},${r(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h  = dx[i] / 3;
    const cp1x = r(pts[i].x + h);     const cp1y = r(pts[i].y + m[i] * h);
    const cp2x = r(pts[i+1].x - h);   const cp2y = r(pts[i+1].y - m[i+1] * h);
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${r(pts[i+1].x)},${r(pts[i+1].y)}`;
  }
  return d;
}

function r(n: number): string { return n.toFixed(2); }

// ── Date formatting ───────────────────────────────────────────────────────────

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateFull(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Insight text builder ──────────────────────────────────────────────────────

interface InsightCard { emoji: string; text: string; type: 'positive' | 'warning' | 'neutral' }

function buildInsightCards(
  insights: TrajectoryInsight,
  submissionCount: number,
): InsightCard[] {
  const cards: InsightCard[] = [];

  if (submissionCount < 2) return cards;

  // Overall trend
  if (insights.trend === 'up') {
    cards.push({
      emoji: '📈',
      text:  `Overall accuracy up ${Math.abs(insights.delta)}% since your first case`,
      type:  'positive',
    });
  } else if (insights.trend === 'down') {
    cards.push({
      emoji: '⚠️',
      text:  `Accuracy dipped ${Math.abs(insights.delta)}% — keep going, consistency builds judgment`,
      type:  'warning',
    });
  }

  // Best improvement in a single theme
  if (insights.improved.length > 0) {
    const top = insights.improved.reduce((a, b) => (a.delta >= b.delta ? a : b));
    const cfg = THEME_CFG[top.theme];
    cards.push({
      emoji: cfg.emoji,
      text:  `${cfg.label} accuracy improved by +${top.delta}%`,
      type:  'positive',
    });
  }

  // Expert threshold crossings
  if (insights.crossedExpertThreshold.length > 0) {
    const names = insights.crossedExpertThreshold
      .map(t => THEME_CFG[t].label)
      .join(', ');
    cards.push({
      emoji: '🔥',
      text:  `You've crossed 60% in ${names} — expert tag territory`,
      type:  'positive',
    });
  }

  // Plateaued themes
  if (insights.plateaued.length > 0 && cards.length < 3) {
    const names = insights.plateaued.map(t => THEME_CFG[t].label).join(', ');
    cards.push({
      emoji: '⚠️',
      text:  `${names} has plateaued over your last 3 attempts`,
      type:  'warning',
    });
  }

  // Best domain (only if not already mentioned)
  if (
    insights.bestTheme &&
    !insights.improved.some(x => x.theme === insights.bestTheme) &&
    cards.length < 3
  ) {
    const cfg = THEME_CFG[insights.bestTheme];
    cards.push({
      emoji: '🏆',
      text:  `${cfg.label} is your strongest domain`,
      type:  'positive',
    });
  }

  return cards.slice(0, 3);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Pass true to render with mock data (for dev / demos). */
  useMockData?: boolean;
}

interface TooltipState {
  svgX: number;
  svgY: number;
  accuracy: number;
  date: number;
  theme: string;
  attemptIndex: number;
  seriesKey: SeriesKey;
}

export default function TasteTrajectoryChart({ useMockData = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const [width, setWidth]             = useState(600);
  const [tooltip, setTooltip]         = useState<TooltipState | null>(null);
  const [activeKeys, setActiveKeys]   = useState<Set<SeriesKey>>(new Set(['overall']));

  // ── Observe container width ───────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (w > 0) setWidth(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Load data ─────────────────────────────────────────────────────────────
  const { series, insights, submissionCount } = useMemo(() => {
    if (useMockData) {
      const mock = getMockTrajectoryData();
      const s    = buildTrajectorySeries(mock);
      return { series: s, insights: computeTrajectoryInsights(s), submissionCount: mock.length };
    }
    return getCachedOrComputeSeries();
  }, [useMockData]);

  const insightCards = useMemo(
    () => buildInsightCards(insights, submissionCount),
    [insights, submissionCount],
  );

  // ── Coordinate helpers ────────────────────────────────────────────────────
  const plotW = width - PAD_L - PAD_R;

  const allTs = useMemo(() => {
    const ts: number[] = [];
    series.overall.forEach(p => ts.push(p.x));
    Object.values(series.byTheme).forEach(pts => pts?.forEach(p => ts.push(p.x)));
    return ts;
  }, [series]);

  const xMin = allTs.length > 0 ? Math.min(...allTs) : 0;
  const xMax = allTs.length > 0 ? Math.max(...allTs) : 1;
  const xRange = xMax - xMin || 1;

  const toSvgX = useCallback(
    (ts: number) => PAD_L + ((ts - xMin) / xRange) * plotW,
    [xMin, xRange, plotW],
  );
  const toSvgY = useCallback(
    (acc: number) => PAD_T + PLOT_H - (acc / 100) * PLOT_H,
    [],
  );

  // ── All visible series → SVG points ──────────────────────────────────────
  interface SeriesEntry {
    key:    SeriesKey;
    pts:    TrajectoryPoint[];
    color:  string;
    svgPts: { x: number; y: number }[];
    path:   string;
  }

  const seriesEntries = useMemo<SeriesEntry[]>(() => {
    const entries: SeriesEntry[] = [];

    if (activeKeys.has('overall') && series.overall.length > 0) {
      const svgPts = series.overall.map(p => ({ x: toSvgX(p.x), y: toSvgY(p.y) }));
      entries.push({
        key:    'overall',
        pts:    series.overall,
        color:  OVERALL_COLOR,
        svgPts,
        path:   svgPts.length >= 3 ? monotonePath(svgPts) : '',
      });
    }

    for (const theme of Object.keys(THEME_CFG) as FrictionTheme[]) {
      if (!activeKeys.has(theme)) continue;
      const pts = series.byTheme[theme];
      if (!pts || pts.length === 0) continue;
      const svgPts = pts.map(p => ({ x: toSvgX(p.x), y: toSvgY(p.y) }));
      entries.push({
        key:    theme,
        pts,
        color:  THEME_CFG[theme].color,
        svgPts,
        path:   svgPts.length >= 3 ? monotonePath(svgPts) : '',
      });
    }

    return entries;
  }, [series, activeKeys, toSvgX, toSvgY]);

  // ── Milestones ────────────────────────────────────────────────────────────
  const milestones = useMemo(() => {
    const o = series.overall;
    if (o.length === 0) return { first: null, best: null, expertCross: null };

    const first = o[0];
    const best  = o.reduce((a, b) => (b.y > a.y ? b : a));
    const expertCross = o.find(p => p.y >= EXPERT_Y) ?? null;

    return { first, best, expertCross };
  }, [series]);

  // ── X-axis labels ─────────────────────────────────────────────────────────
  const xLabels = useMemo(() => {
    const o = series.overall;
    if (o.length === 0) return [];
    if (o.length === 1) return [{ x: toSvgX(o[0].x), label: fmtDate(o[0].x) }];

    const maxLabels = Math.max(2, Math.floor(plotW / 80));
    const step = Math.ceil((o.length - 1) / (maxLabels - 1));
    const indices = new Set<number>();
    for (let i = 0; i < o.length; i += step) indices.add(i);
    indices.add(o.length - 1);

    return Array.from(indices).map(i => ({
      x:     toSvgX(o[i].x),
      label: fmtDate(o[i].x),
    }));
  }, [series, toSvgX, plotW]);

  // ── Hover handling ────────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect  = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let nearest: TooltipState | null = null;
      let bestDist = Infinity;

      for (const entry of seriesEntries) {
        for (const [i, svgPt] of entry.svgPts.entries()) {
          const dx = svgPt.x - mouseX;
          const dy = svgPt.y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < bestDist) {
            bestDist = dist;
            const dp = entry.pts[i];
            nearest = {
              svgX:         svgPt.x,
              svgY:         svgPt.y,
              accuracy:     dp.y,
              date:         dp.x,
              theme:        entry.key === 'overall' ? 'Overall' : THEME_CFG[dp.theme].label,
              attemptIndex: dp.index,
              seriesKey:    entry.key,
            };
          }
        }
      }

      if (nearest && bestDist < 40) {
        setTooltip(nearest);
      } else {
        setTooltip(null);
      }
    },
    [seriesEntries],
  );

  const toggleKey = (key: SeriesKey) => {
    setActiveKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Always keep at least one active
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // ── Y-axis gridlines ─────────────────────────────────────────────────────
  const yTicks = [0, 20, 40, 60, 80, 100];

  // ── Render helpers ────────────────────────────────────────────────────────

  // Gradient IDs (one per series key)
  const gradId = (key: SeriesKey) => `traj-grad-${key}`;

  const showDots = (pts: { x: number; y: number }[]) => pts.length < 3;

  // ── Empty / sparse states ─────────────────────────────────────────────────

  if (submissionCount === 0) {
    return (
      <div style={{
        background: 'white', borderRadius: '20px',
        border: '1px solid #E5E7EB',
        padding: '3rem 2rem', textAlign: 'center',
      }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '16px',
          background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.25rem',
        }}>
          <BarChart3 size={26} color="white" />
        </div>
        <p style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: '0 0 0.5rem' }}>
          Your Taste Trajectory
        </p>
        <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
          Complete your first Friction Case to see your accuracy grow over time.
        </p>
      </div>
    );
  }

  // ── Full chart ────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        background: 'white', borderRadius: '20px',
        border: '1px solid #E5E7EB',
        boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        padding: '1.25rem 1.375rem 0',
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: '0.75rem',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingUp size={14} color="white" />
            </div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
              Taste Trajectory
            </h3>
            {useMockData && (
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, color: '#D97706',
                background: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: '6px', padding: '0.1rem 0.45rem', letterSpacing: '0.04em',
              }}>
                DEMO
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6B7280' }}>
            {submissionCount} case{submissionCount !== 1 ? 's' : ''} · accuracy over time
          </p>
        </div>

        {/* Trend badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem',
          padding: '0.3rem 0.625rem', borderRadius: '999px',
          background: insights.trend === 'up' ? '#ECFDF5'
            : insights.trend === 'down' ? '#FEF2F2'
            : '#F9FAFB',
          border: `1px solid ${insights.trend === 'up' ? '#D1FAE5'
            : insights.trend === 'down' ? '#FECACA'
            : '#E5E7EB'}`,
          flexShrink: 0,
        }}>
          {insights.trend === 'up'   ? <TrendingUp  size={13} color="#16A34A" /> :
           insights.trend === 'down' ? <TrendingDown size={13} color="#DC2626" /> :
                                       <Minus        size={13} color="#6B7280" />}
          <span style={{
            fontSize: '0.75rem', fontWeight: 600,
            color: insights.trend === 'up' ? '#16A34A'
              : insights.trend === 'down' ? '#DC2626'
              : '#6B7280',
          }}>
            {insights.delta >= 0 ? '+' : ''}{insights.delta}%
          </span>
        </div>
      </div>

      {/* ── Insight cards ── */}
      <AnimatePresence>
        {insightCards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ padding: '0.875rem 1.375rem 0' }}
          >
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {insightCards.map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.07 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    padding: '0.375rem 0.75rem', borderRadius: '999px',
                    background: card.type === 'positive' ? '#F0FDF4' : '#FFFBEB',
                    border: `1px solid ${card.type === 'positive' ? '#D1FAE5' : '#FDE68A'}`,
                    fontSize: '0.78rem', fontWeight: 500,
                    color: card.type === 'positive' ? '#166534' : '#92400E',
                  }}
                >
                  <span>{card.emoji}</span>
                  <span>{card.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Theme toggle chips ── */}
      <div style={{
        padding: '0.875rem 1.375rem 0',
        display: 'flex', gap: '0.375rem', flexWrap: 'wrap',
      }}>
        {/* Overall chip */}
        {(['overall'] as SeriesKey[]).concat(
          (Object.keys(THEME_CFG) as FrictionTheme[]).filter(t => (series.byTheme[t]?.length ?? 0) > 0)
        ).map(key => {
          const isActive  = activeKeys.has(key);
          const color     = key === 'overall' ? OVERALL_COLOR : THEME_CFG[key as FrictionTheme].color;
          const label     = key === 'overall' ? '📊 Overall' : `${THEME_CFG[key as FrictionTheme].emoji} ${THEME_CFG[key as FrictionTheme].label}`;
          return (
            <button
              key={key}
              onClick={() => toggleKey(key)}
              style={{
                padding: '0.3rem 0.7rem', borderRadius: '999px',
                border: `1.5px solid ${isActive ? color : '#E5E7EB'}`,
                background: isActive ? `${color}12` : 'transparent',
                color: isActive ? color : '#9CA3AF',
                fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── SVG Chart ── */}
      <div
        ref={containerRef}
        style={{ padding: '0.875rem 1.375rem 1.25rem', position: 'relative' }}
      >
        <svg
          ref={svgRef}
          width={width}
          height={H}
          style={{ overflow: 'visible', display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* ── Gradient defs ── */}
          <defs>
            {seriesEntries.map(e => (
              <linearGradient
                key={e.key}
                id={gradId(e.key)}
                x1="0" y1="0" x2="0" y2="1"
              >
                <stop offset="0%"   stopColor={e.color} stopOpacity={0.12} />
                <stop offset="100%" stopColor={e.color} stopOpacity={0}    />
              </linearGradient>
            ))}
          </defs>

          {/* ── Y-axis gridlines ── */}
          {yTicks.map(tick => {
            const y    = toSvgY(tick);
            const isExpert = tick === EXPERT_Y;
            return (
              <g key={tick}>
                <line
                  x1={PAD_L} y1={y} x2={width - PAD_R} y2={y}
                  stroke={isExpert ? `${EXPERT_COLOR}40` : GRID_COLOR}
                  strokeWidth={isExpert ? 1.5 : 1}
                  strokeDasharray={isExpert ? '4 4' : undefined}
                />
                <text
                  x={PAD_L - 8} y={y + 4}
                  textAnchor="end"
                  fontSize={10} fill={isExpert ? EXPERT_COLOR : AXIS_COLOR}
                  fontWeight={isExpert ? 600 : 400}
                >
                  {tick}
                </text>
                {/* Expert label */}
                {isExpert && (
                  <text
                    x={width - PAD_R + 4} y={y - 5}
                    fontSize={9} fill={EXPERT_COLOR} fontWeight={600}
                  >
                    Expert ⚡
                  </text>
                )}
              </g>
            );
          })}

          {/* ── X-axis labels ── */}
          {xLabels.map((lbl, i) => (
            <text
              key={i} x={lbl.x} y={H - 10}
              textAnchor="middle"
              fontSize={10} fill={AXIS_COLOR}
            >
              {lbl.label}
            </text>
          ))}

          {/* ── Area fills (below lines) ── */}
          {seriesEntries.map(e => {
            if (e.svgPts.length < 3) return null;
            // Close the path at the bottom
            const lastX = e.svgPts.at(-1)!.x;
            const firstX = e.svgPts[0].x;
            const baseY = toSvgY(0);
            const areaPath = `${e.path} L${r(lastX)},${r(baseY)} L${r(firstX)},${r(baseY)} Z`;
            return (
              <path
                key={`area-${e.key}`}
                d={areaPath}
                fill={`url(#${gradId(e.key)})`}
                stroke="none"
              />
            );
          })}

          {/* ── Series lines ── */}
          {seriesEntries.map(e => (
            <g key={`line-${e.key}`}>
              {e.svgPts.length >= 3 ? (
                // Animated smooth line
                <motion.path
                  key={`${e.key}-${e.path.slice(0, 20)}`}
                  d={e.path}
                  fill="none"
                  stroke={e.color}
                  strokeWidth={e.key === 'overall' ? 2.5 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.1, ease: 'easeOut' }}
                />
              ) : (
                // Straight line for 2 points
                e.svgPts.length === 2 && (
                  <line
                    x1={e.svgPts[0].x} y1={e.svgPts[0].y}
                    x2={e.svgPts[1].x} y2={e.svgPts[1].y}
                    stroke={e.color} strokeWidth={2} strokeLinecap="round"
                  />
                )
              )}

              {/* Dots — always shown for sparse data, end dot otherwise */}
              {(showDots(e.svgPts) ? e.svgPts : [e.svgPts.at(-1)!]).map((pt, i) => (
                <motion.circle
                  key={i}
                  cx={pt.x} cy={pt.y} r={showDots(e.svgPts) ? 5 : 4}
                  fill="white"
                  stroke={e.color}
                  strokeWidth={2}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: showDots(e.svgPts) ? i * 0.07 : 0.9, duration: 0.2 }}
                />
              ))}
            </g>
          ))}

          {/* ── Milestone markers ── */}
          {milestones.first && activeKeys.has('overall') && (() => {
            const x = toSvgX(milestones.first.x);
            const y = toSvgY(milestones.first.y);
            return (
              <g>
                <motion.circle
                  cx={x} cy={y} r={7}
                  fill={OVERALL_COLOR}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.4 }}
                />
                <text x={x} y={y + 4} textAnchor="middle" fontSize={8} fill="white" fontWeight={700}>1</text>
              </g>
            );
          })()}

          {milestones.best && milestones.best !== milestones.first && activeKeys.has('overall') && (() => {
            const x = toSvgX(milestones.best!.x);
            const y = toSvgY(milestones.best!.y);
            return (
              <motion.g
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <text x={x} y={y - 11} textAnchor="middle" fontSize={13}>⭐</text>
              </motion.g>
            );
          })()}

          {milestones.expertCross && activeKeys.has('overall') && (() => {
            const x = toSvgX(milestones.expertCross!.x);
            const yLine = toSvgY(EXPERT_Y);
            return (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
              >
                {/* Diamond marker at the crossing point */}
                <rect
                  x={x - 5} y={yLine - 5}
                  width={10} height={10}
                  transform={`rotate(45, ${x}, ${yLine})`}
                  fill={EXPERT_COLOR}
                />
              </motion.g>
            );
          })()}

          {/* ── Hover indicator ── */}
          <AnimatePresence>
            {tooltip && (
              <>
                {/* Vertical guide line */}
                <motion.line
                  key="guide"
                  x1={tooltip.svgX} y1={PAD_T}
                  x2={tooltip.svgX} y2={H - PAD_B}
                  stroke="#E5E7EB" strokeWidth={1} strokeDasharray="3 3"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                />
                {/* Highlight circle */}
                <motion.circle
                  key="highlight"
                  cx={tooltip.svgX} cy={tooltip.svgY} r={6}
                  fill="white"
                  stroke={tooltip.seriesKey === 'overall' ? OVERALL_COLOR : THEME_CFG[tooltip.seriesKey as FrictionTheme].color}
                  strokeWidth={2.5}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                />
              </>
            )}
          </AnimatePresence>

          {/* ── Invisible hit area ── */}
          <rect
            x={PAD_L} y={PAD_T}
            width={plotW} height={PLOT_H}
            fill="transparent"
          />
        </svg>

        {/* ── Floating tooltip ── */}
        <AnimatePresence>
          {tooltip && (
            <motion.div
              key="tooltip"
              initial={{ opacity: 0, scale: 0.92, y: -4 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.12 }}
              style={{
                position:   'absolute',
                left:       Math.min(
                  tooltip.svgX + 10,
                  width - 160,                // clamp to container
                ),
                top:        Math.max(tooltip.svgY - 76, 8),
                background: 'white',
                border:     '1px solid #E5E7EB',
                borderRadius: '12px',
                padding:    '0.5rem 0.75rem',
                boxShadow:  '0 4px 20px rgba(0,0,0,0.10)',
                pointerEvents: 'none',
                minWidth:   '140px',
                zIndex:     10,
              }}
            >
              <p style={{ margin: '0 0 0.2rem', fontSize: '0.7rem', color: '#9CA3AF', fontWeight: 500 }}>
                {fmtDateFull(tooltip.date)} · #{tooltip.attemptIndex + 1}
              </p>
              <p style={{ margin: '0 0 0.15rem', fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>
                {tooltip.accuracy}% accuracy
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#6B7280' }}>
                {tooltip.theme}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Legend / milestone key ── */}
      {series.overall.length >= 3 && (
        <div style={{
          borderTop: '1px solid #F3F4F6',
          padding: '0.625rem 1.375rem',
          display: 'flex', gap: '1rem', flexWrap: 'wrap',
        }}>
          {[
            { symbol: '1',   color: OVERALL_COLOR, bg: OVERALL_COLOR, text: 'First attempt',       type: 'circle' as const },
            { symbol: '⭐',  color: OVERALL_COLOR, bg: 'transparent', text: 'Personal best',        type: 'emoji' as const },
            { symbol: '◇',   color: EXPERT_COLOR,  bg: 'transparent', text: 'Crossed 60% threshold', type: 'text' as const },
          ].map(item => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ fontSize: item.type === 'emoji' ? '0.875rem' : '0.7rem', color: item.color, fontWeight: 700 }}>
                {item.symbol}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{item.text}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
