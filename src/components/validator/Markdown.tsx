import { type CSSProperties, type ReactNode, Fragment } from 'react';

// Tiny markdown renderer for the Validator feature. Handles headings (h1–h3),
// bullet lists, numbered lists, paragraphs, bold (**), italic (*), and inline
// `code`. We deliberately avoid pulling in react-markdown to keep the bundle
// lean — these are the only patterns the chat assistant and generation prompt
// are expected to produce.

interface MarkdownProps {
  content: string;
  variant?: 'doc' | 'chat';
}

export default function Markdown({ content, variant = 'chat' }: MarkdownProps) {
  const blocks = parseBlocks(content);
  return (
    <div style={containerStyle(variant)}>
      {blocks.map((block, i) => (
        <Fragment key={i}>{renderBlock(block)}</Fragment>
      ))}
    </div>
  );
}

// ── Parsing ───────────────────────────────────────────────────────────────────

type Block =
  | { kind: 'h1' | 'h2' | 'h3'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'p';  text: string };

function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3;
      blocks.push({ kind: `h${level}` as 'h1' | 'h2' | 'h3', text: heading[2].trim() });
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, '').trim());
        i++;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim());
        i++;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    // Paragraph: consume until blank line or list/heading.
    const paraLines: string[] = [];
    while (i < lines.length
        && lines[i].trim()
        && !/^(#{1,3})\s+/.test(lines[i])
        && !/^\s*[-*]\s+/.test(lines[i])
        && !/^\s*\d+\.\s+/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ kind: 'p', text: paraLines.join(' ').trim() });
  }

  return blocks;
}

// ── Inline rendering (bold, italic, code) ─────────────────────────────────────

function renderInline(text: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  // Order matters: code first (to protect contents), then bold, then italic.
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) tokens.push(text.slice(lastIndex, match.index));
    const m = match[0];
    if (m.startsWith('`') && m.endsWith('`')) {
      tokens.push(<code key={`c${key++}`} style={inlineCodeStyle}>{m.slice(1, -1)}</code>);
    } else if (m.startsWith('**') && m.endsWith('**')) {
      tokens.push(<strong key={`b${key++}`}>{m.slice(2, -2)}</strong>);
    } else if (m.startsWith('*') && m.endsWith('*')) {
      tokens.push(<em key={`i${key++}`}>{m.slice(1, -1)}</em>);
    }
    lastIndex = match.index + m.length;
  }
  if (lastIndex < text.length) tokens.push(text.slice(lastIndex));
  return tokens;
}

// ── Styles ────────────────────────────────────────────────────────────────────

function containerStyle(variant: 'doc' | 'chat'): CSSProperties {
  return {
    color: '#1F2937',
    fontSize: variant === 'doc' ? '0.9375rem' : '0.875rem',
    lineHeight: 1.65,
    display: 'flex',
    flexDirection: 'column',
    gap: variant === 'doc' ? '0.875rem' : '0.625rem',
  };
}

const h1Style: CSSProperties = { fontSize: '1.5rem',  fontWeight: 700, color: '#1F2937', margin: '0.5rem 0 0.25rem', letterSpacing: '-0.01em' };
const h2Style: CSSProperties = { fontSize: '1.125rem', fontWeight: 700, color: '#1F2937', margin: '1rem 0 0.25rem',  letterSpacing: '-0.005em' };
const h3Style: CSSProperties = { fontSize: '1rem',     fontWeight: 600, color: '#374151', margin: '0.75rem 0 0.25rem' };
const pStyle:  CSSProperties = { margin: 0 };
const ulStyle: CSSProperties = { margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' };
const olStyle: CSSProperties = { ...ulStyle, listStyleType: 'decimal' };
const liStyle: CSSProperties = { lineHeight: 1.6 };

const inlineCodeStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '0.85em',
  backgroundColor: '#F3F4F6',
  padding: '0.1em 0.35em',
  borderRadius: '6px',
  color: '#1F2937',
};

function renderBlock(block: Block): ReactNode {
  switch (block.kind) {
    case 'h1': return <h1 style={h1Style}>{renderInline(block.text)}</h1>;
    case 'h2': return <h2 style={h2Style}>{renderInline(block.text)}</h2>;
    case 'h3': return <h3 style={h3Style}>{renderInline(block.text)}</h3>;
    case 'p':  return <p  style={pStyle}>{renderInline(block.text)}</p>;
    case 'ul': return (
      <ul style={ulStyle}>
        {block.items.map((it, i) => <li key={i} style={liStyle}>{renderInline(it)}</li>)}
      </ul>
    );
    case 'ol': return (
      <ol style={olStyle}>
        {block.items.map((it, i) => <li key={i} style={liStyle}>{renderInline(it)}</li>)}
      </ol>
    );
  }
}
