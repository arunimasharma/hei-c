import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Sparkles, Trash2, FileText, MessageSquare } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import RequireAuth from '../components/validator/RequireAuth';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { listSessions, softDeleteSession } from '../services/validatorClient';
import type { ValidatorSession } from '../types/validator';

export default function ValidatorIndexPage() {
  return (
    <RequireAuth>
      <DashboardLayout>
        <ValidatorIndexInner />
      </DashboardLayout>
    </RequireAuth>
  );
}

function ValidatorIndexInner() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ValidatorSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSessions()
      .then(s => { if (!cancelled) setSessions(s); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load sessions.'); });
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    try {
      await softDeleteSession(id);
      setSessions(prev => (prev ?? []).filter(s => s.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.01em' }}>
          Idea Validator
        </h1>
        <p style={{ fontSize: '0.9375rem', color: '#6B7280', margin: 0, lineHeight: 1.6, maxWidth: '46rem' }}>
          Turn a rough idea into a hypothesis and a paste-ready build prompt for a coding agent.
          Pick <strong>Quick prototype</strong> if you want the smallest testable thing fast, or <strong>Strategic bet</strong> if
          stakeholders or budget are on the line.
        </p>
      </header>

      <Card style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Sparkles size={20} color="#4A5FC1" />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>
            Start a new validation
          </h2>
        </div>
        <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
          One question at a time. After 5–7 messages you can generate a hypothesis summary plus a
          paste-ready Claude Code build prompt for the smallest version that would test it.
        </p>
        <div>
          <Button onClick={() => navigate('/validator/new')}>
            Start interview
          </Button>
        </div>
      </Card>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#374151', margin: 0 }}>
          Recent sessions
        </h2>

        {error && (
          <Card style={{ padding: '1rem', borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }}>
            <p style={{ margin: 0, color: '#B91C1C', fontSize: '0.875rem' }}>{error}</p>
          </Card>
        )}

        {sessions === null && !error && <LoadingSpinner />}

        {sessions !== null && sessions.length === 0 && (
          <Card style={{ padding: '1.25rem' }}>
            <p style={{ margin: 0, color: '#6B7280', fontSize: '0.875rem' }}>
              No sessions yet. Start one above.
            </p>
          </Card>
        )}

        {sessions !== null && sessions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {sessions.map(s => (
              <SessionRow key={s.id} session={s} onDelete={() => handleDelete(s.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface SessionRowProps {
  session: ValidatorSession;
  onDelete: () => void;
}

function SessionRow({ session, onDelete }: SessionRowProps) {
  const date = new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const hasDoc = session.generatedDoc !== null;

  return (
    <Card style={{ padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            to={`/validator/${session.id}`}
            style={{
              display: 'block', textDecoration: 'none', color: '#1F2937',
              fontWeight: 600, fontSize: '0.9375rem',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {session.title || 'Untitled idea'}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginTop: '0.25rem', fontSize: '0.75rem', color: '#9CA3AF' }}>
            <span style={{
              padding: '0.125rem 0.5rem', borderRadius: '999px',
              backgroundColor: session.mode === 'quick_prototype' ? '#EDE9FE' : '#DBEAFE',
              color:           session.mode === 'quick_prototype' ? '#6D28D9' : '#1D4ED8',
              fontWeight: 600,
            }}>
              {session.mode === 'quick_prototype' ? 'Quick prototype' : 'Strategic bet'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {hasDoc ? <FileText size={12} /> : <MessageSquare size={12} />}
              {hasDoc ? 'Doc generated' : 'In progress'}
            </span>
            <span>{date}</span>
          </div>
        </div>
        <button
          onClick={onDelete}
          aria-label="Delete session"
          style={{
            padding: '0.5rem', borderRadius: '8px', border: 'none',
            backgroundColor: 'transparent', cursor: 'pointer', color: '#9CA3AF',
            display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.backgroundColor = '#FEF2F2'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </Card>
  );
}
