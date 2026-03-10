import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, User, Bell, Download, Trash2, Database, Key, Loader2 } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { useApp } from '../context/AppContext';
import { generateDemoEmotions, generateDemoEvents, generateDemoActions } from '../utils/demoData';
import { testConnection } from '../services/claudeApi';

export default function SettingsPage() {
  const { state, updateUserProfile, clearAllData, dispatch } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState(state.user?.name || '');
  const [role, setRole] = useState(state.user?.role || '');
  const [showClearModal, setShowClearModal] = useState(false);
  const [saved, setSaved] = useState(false);

  // AI connection test state
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'success' | 'failed' | null>(null);

  const handleSaveProfile = () => {
    updateUserProfile({ name: name.trim(), role: role.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setConnectionStatus(null);
    const result = await testConnection();
    setConnectionStatus(result.ok ? 'success' : 'failed');
    setTesting(false);
  };

  const handleExportData = () => {
    const data = {
      user: state.user,
      emotions: state.emotions,
      events: state.events,
      actions: state.actions,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heic-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadDemoData = () => {
    const userId = state.user?.id || 'demo_user';
    const emotions = generateDemoEmotions(userId);
    const events = generateDemoEvents(userId);
    const actions = generateDemoActions();

    dispatch({
      type: 'LOAD_STATE',
      payload: {
        emotions: [...emotions, ...state.emotions],
        events: [...events, ...state.events],
        actions: [...actions, ...state.actions.filter(a => a.completed)],
      },
    });
  };

  const handleClearAll = () => {
    clearAllData();
    setShowClearModal(false);
    navigate('/onboarding');
  };

  const sectionIconStyle = (bg: string, fg: string) => ({
    width: '40px', height: '40px', borderRadius: '12px',
    display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: bg, color: fg,
  });

  return (
    <DashboardLayout>
      <div style={{ maxWidth: '42rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '0.5rem', borderRadius: '12px', border: 'none',
              backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
              color: '#6B7280',
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1F2937' }}>Settings</h1>
        </div>

        {/* Profile */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={sectionIconStyle('rgba(74,95,193,0.1)', '#4A5FC1')}>
              <User size={20} />
            </div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937' }}>Profile</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input label="Name" value={name} onChange={e => setName(e.target.value)} />
            <Input label="Role / Title" value={role} onChange={e => setRole(e.target.value)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.25rem' }}>
              <Button onClick={handleSaveProfile} disabled={!name.trim()}>Save Changes</Button>
              {saved && <span style={{ fontSize: '0.875rem', color: '#16A34A', fontWeight: 500 }}>Saved!</span>}
            </div>
          </div>
        </Card>

        {/* AI-Powered Actions */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={sectionIconStyle('rgba(245,158,11,0.1)', '#F59E0B')}>
              <Key size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937' }}>AI-Powered Actions</h2>
              <p style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Uses Claude to generate personalized micro-actions</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Testing...</> : 'Test AI Connection'}
              </Button>
            </div>
            {connectionStatus === 'success' && (
              <div style={{
                padding: '0.75rem 1rem', borderRadius: '12px',
                backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0',
              }}>
                <p style={{ fontSize: '0.875rem', color: '#16A34A', fontWeight: 500 }}>
                  Connection successful! AI-powered actions are now enabled.
                </p>
              </div>
            )}
            {connectionStatus === 'failed' && (
              <div style={{
                padding: '0.75rem 1rem', borderRadius: '12px',
                backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
              }}>
                <p style={{ fontSize: '0.875rem', color: '#EF4444', fontWeight: 500 }}>
                  Connection failed. Please check your API key and try again.
                </p>
              </div>
            )}
            <div style={{
              padding: '0.75rem 1rem', borderRadius: '12px',
              backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
            }}>
              <p style={{ fontSize: '0.75rem', color: '#92400E', lineHeight: 1.5 }}>
                The Anthropic API key is configured server-side. When connected, Claude analyzes
                your emotional patterns, career events, and goals to create personalized
                action recommendations that improve over time.
              </p>
            </div>
          </div>
        </Card>

        {/* Preferences */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={sectionIconStyle('rgba(139,126,200,0.1)', '#8B7EC8')}>
              <Bell size={20} />
            </div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937' }}>Preferences</h2>
          </div>
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1F2937', display: 'block', marginBottom: '0.375rem' }}>Check-in Frequency</label>
            <select
              value={state.user?.checkInFrequency || 'daily'}
              onChange={e => updateUserProfile({ checkInFrequency: e.target.value as 'daily' | 'weekly' | 'as-needed' })}
              style={{
                width: '100%', padding: '0.625rem 1rem', borderRadius: '12px',
                border: '1px solid #E5E7EB', fontSize: '0.875rem',
                outline: 'none', fontFamily: 'inherit', backgroundColor: 'white',
                cursor: 'pointer',
              }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="as-needed">As Needed</option>
            </select>
          </div>
        </Card>

        {/* Data */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={sectionIconStyle('#F0FDF4', '#16A34A')}>
              <Database size={20} />
            </div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937' }}>Data</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Button variant="outline" onClick={handleExportData}>
                <Download size={16} /> Export Data
              </Button>
              <Button variant="outline" onClick={handleLoadDemoData}>
                <Database size={16} /> Load Demo Data
              </Button>
            </div>
            <div style={{ paddingTop: '1rem', borderTop: '1px solid #F3F4F6' }}>
              <Button variant="danger" onClick={() => setShowClearModal(true)}>
                <Trash2 size={16} /> Clear All Data
              </Button>
              <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.5rem' }}>This will permanently delete all your data and cannot be undone.</p>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#4A5FC1' }}>Hello-EQ</p>
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Emotional IQ (EQ) Career Operating System</p>
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.25rem' }}>v1.0.0</p>
          </div>
        </Card>
      </div>

      <Modal isOpen={showClearModal} onClose={() => setShowClearModal(false)} title="Clear All Data?">
        <p style={{ color: '#6B7280', marginBottom: '1.25rem' }}>
          This will permanently delete all your emotions, events, actions, and profile data. This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="ghost" onClick={() => setShowClearModal(false)} style={{ flex: 1 }}>Cancel</Button>
          <Button variant="danger" onClick={handleClearAll} style={{ flex: 1 }}>
            <Trash2 size={16} /> Delete Everything
          </Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
