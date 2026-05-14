import { type CSSProperties } from 'react';
import { motion } from 'motion/react';
import Markdown from './Markdown';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatBubble({ role, content }: ChatBubbleProps) {
  const isUser = role === 'user';
  const wrapper: CSSProperties = {
    display: 'flex',
    justifyContent: isUser ? 'flex-end' : 'flex-start',
    width: '100%',
  };
  const bubble: CSSProperties = {
    maxWidth: '88%',
    padding: '0.75rem 1rem',
    borderRadius: '14px',
    backgroundColor: isUser ? '#4A5FC1' : '#FFFFFF',
    color: isUser ? '#FFFFFF' : '#1F2937',
    border: isUser ? 'none' : '1px solid rgba(0,0,0,0.06)',
    boxShadow: isUser ? '0 2px 8px rgba(74,95,193,0.18)' : '0 2px 10px rgba(0,0,0,0.04)',
    fontSize: '0.9375rem',
    lineHeight: 1.55,
    whiteSpace: isUser ? 'pre-wrap' : undefined,
    wordBreak: 'break-word',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={wrapper}
    >
      <div style={bubble}>
        {isUser ? content : <Markdown content={content} variant="chat" />}
      </div>
    </motion.div>
  );
}
