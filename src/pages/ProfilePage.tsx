import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Edit2, Save, X, RotateCw } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import TextArea from '../components/common/TextArea';
import EmotionGame from '../components/onboarding/EmotionGame';
import { useApp } from '../context/AppContext';

export default function ProfilePage() {
  const { state, updateUserProfile } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [showEmotionGame, setShowEmotionGame] = useState(false);
  const user = state.user;

  // Edit form state
  const [formData, setFormData] = useState({
    name: user?.name || '',
    role: user?.role || '',
    goals: user?.goals || '',
    checkInFrequency: (user?.checkInFrequency || 'as-needed') as 'daily' | 'weekly' | 'as-needed',
  });

  const handleSave = () => {
    updateUserProfile({
      name: formData.name || 'Friend',
      role: formData.role || 'Professional',
      goals: formData.goals || undefined,
      checkInFrequency: formData.checkInFrequency,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      role: user?.role || '',
      goals: user?.goals || '',
      checkInFrequency: (user?.checkInFrequency || 'as-needed') as 'daily' | 'weekly' | 'as-needed',
    });
    setIsEditing(false);
  };

  if (showEmotionGame) {
    return (
      <DashboardLayout>
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1rem' }}>
          <button
            onClick={() => setShowEmotionGame(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6B7280',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            ← Back to Profile
          </button>
          <EmotionGame onComplete={() => setShowEmotionGame(false)} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>
              My Profile
            </h1>
            <p style={{ color: '#6B7280', marginTop: '0.25rem', margin: 0 }}>
              Manage your profile information and preferences
            </p>
          </div>
          <Button
            variant={isEditing ? 'outline' : 'primary'}
            onClick={isEditing ? handleCancel : () => setIsEditing(true)}
          >
            {isEditing ? (
              <>
                <X size={16} /> Cancel
              </>
            ) : (
              <>
                <Edit2 size={16} /> Edit
              </>
            )}
          </Button>
        </div>

        {/* Profile Information */}
        <AnimatePresence mode="wait">
          {!isEditing ? (
            <motion.div
              key="view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
            >
              {/* Basic Info Card */}
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      backgroundColor: 'rgba(74,95,193,0.1)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '1rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: '#4A5FC1',
                      }}
                    >
                      {user?.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                      {user?.name}
                    </h2>
                    <p style={{ color: '#6B7280', margin: 0, fontSize: '0.875rem' }}>
                      {user?.role}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '1rem',
                  }}
                >
                  <div
                    style={{
                      backgroundColor: '#F9FAFB',
                      padding: '1rem',
                      borderRadius: '12px',
                    }}
                  >
                    <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0 }}>
                      CHECK-IN FREQUENCY
                    </p>
                    <p
                      style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: '#1F2937',
                        margin: '0.5rem 0 0 0',
                        textTransform: 'capitalize',
                      }}
                    >
                      {user?.checkInFrequency}
                    </p>
                  </div>
                  <div
                    style={{
                      backgroundColor: '#F9FAFB',
                      padding: '1rem',
                      borderRadius: '12px',
                    }}
                  >
                    <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0 }}>
                      MEMBER SINCE
                    </p>
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: '0.5rem 0 0 0' }}>
                      {user?.createdAt
                        ? new Date(user.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                          })
                        : 'Unknown'}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Goals Card */}
              {user?.goals && (
                <Card>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: '0 0 1rem 0' }}>
                    Career Goals & Challenges
                  </h3>
                  <p style={{ color: '#6B7280', lineHeight: 1.6, margin: 0 }}>
                    {user.goals}
                  </p>
                </Card>
              )}

              {/* Emotion Game Card */}
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      backgroundColor: '#EFF6FF',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                    }}
                  >
                    ✨
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                      Re-run Emotion Pattern Game
                    </h3>
                    <p style={{ color: '#6B7280', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
                      See how your emotional patterns have evolved
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowEmotionGame(true)}
                  >
                    <RotateCw size={14} /> Play Again
                  </Button>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="edit"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
            >
              {/* Edit Form */}
              <Card>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <Input
                    label="Name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Enter your name"
                  />

                  <Input
                    label="Career Role / Title"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    placeholder="e.g., Software Engineer, Product Manager"
                  />

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: '#1F2937',
                        marginBottom: '0.5rem',
                      }}
                    >
                      Career Goals & Challenges
                    </label>
                    <TextArea
                      value={formData.goals}
                      onChange={(e) =>
                        setFormData({ ...formData, goals: e.target.value })
                      }
                      placeholder="Describe your career goals or current challenges"
                      rows={4}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: '#1F2937',
                        marginBottom: '0.75rem',
                      }}
                    >
                      Check-in Frequency
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {([
                        {
                          value: 'daily' as const,
                          label: 'Daily',
                          desc: 'Build a consistent habit with daily check-ins',
                        },
                        {
                          value: 'weekly' as const,
                          label: 'Weekly',
                          desc: 'Reflect on your week every 7 days',
                        },
                        {
                          value: 'as-needed' as const,
                          label: 'As Needed',
                          desc: 'Log whenever you feel the need',
                        },
                      ]).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() =>
                            setFormData({
                              ...formData,
                              checkInFrequency: opt.value,
                            })
                          }
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '1rem 1.25rem',
                            borderRadius: '14px',
                            border: `2px solid ${
                              formData.checkInFrequency === opt.value
                                ? '#4A5FC1'
                                : '#F3F4F6'
                            }`,
                            backgroundColor:
                              formData.checkInFrequency === opt.value
                                ? 'rgba(74,95,193,0.04)'
                                : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow:
                              formData.checkInFrequency === opt.value
                                ? '0 1px 4px rgba(74,95,193,0.1)'
                                : 'none',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 500,
                              color: '#1F2937',
                              fontSize: '0.95rem',
                            }}
                          >
                            {opt.label}
                          </div>
                          <div
                            style={{
                              fontSize: '0.825rem',
                              color: '#6B7280',
                              marginTop: '0.15rem',
                            }}
                          >
                            {opt.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    marginTop: '2rem',
                  }}
                >
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    style={{ flex: 1 }}
                  >
                    <Save size={16} /> Save Changes
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
