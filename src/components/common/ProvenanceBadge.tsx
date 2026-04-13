/**
 * ProvenanceBadge
 *
 * Renders a small muted label showing which PM Benchmark version produced a
 * given evaluation, e.g. "PM Benchmark v2.1.0 / pm-graph-v2".
 *
 * Renders nothing when `label` is null or undefined — callers do not need to
 * guard the render themselves.  This keeps legacy records (which carry no
 * provenance) from leaving a blank gap in the layout.
 *
 * Usage:
 *
 *   // From a PMGraphEvaluationRecord
 *   import { formatEvalProvenanceLabel } from '…/pmGraph/EvaluationStore';
 *   <ProvenanceBadge label={formatEvalProvenanceLabel(record)} />
 *
 *   // From a VersionMixInfo distinctVersions entry
 *   import { formatVersionKeyLabel } from '…/pmGraph/EvaluationStore';
 *   <ProvenanceBadge label={formatVersionKeyLabel(versionMix.distinctVersions[0])} />
 *
 * The `as` prop switches the root element between 'p' (default, block) and
 * 'span' (inline-block).  Pass `style` to override margins or colour for the
 * local layout context.
 */

import type { CSSProperties } from 'react';

interface ProvenanceBadgeProps {
  /** Pre-formatted provenance label string, e.g. from formatEvalProvenanceLabel(). */
  label: string | null | undefined;
  /** Root element type.  Defaults to 'p' (block).  Use 'span' inside flex rows. */
  as?: 'p' | 'span';
  /** Style overrides — applied on top of the default typography. */
  style?: CSSProperties;
}

const BASE_STYLE: CSSProperties = {
  fontSize:   '0.7rem',
  color:      '#9CA3AF',
  lineHeight: 1.4,
  margin:     0,
};

export default function ProvenanceBadge({ label, as: Tag = 'p', style }: ProvenanceBadgeProps) {
  if (!label) return null;
  return <Tag style={{ ...BASE_STYLE, ...style }}>{label}</Tag>;
}
