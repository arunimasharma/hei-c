import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, Sparkles, BarChart3, Heart, Zap } from 'lucide-react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import EmotionGame from '../components/onboarding/EmotionGame';
import { useApp } from '../context/AppContext';
import type { UserProfile } from '../types';

export default function OnboardingPage() {
  const { dispatch } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [goals, setGoals] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'as-needed'>('daily');

  const createUser = (skipDetails = false) => {
    const user: UserProfile = {
      id: `user_${Date.now()}`,
      name: name || 'Friend',
      role: role || 'Professional',
      goals: skipDetails ? undefined : goals,
      checkInFrequency: skipDetails ? 'as-needed' : frequency,
      onboardingComplete: true,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'SET_USER', payload: user });
    navigate('/');
  };

  const canProceed = () => {
    if (step === 2) return name.trim().length > 0;
    return true;
  };

  const nextStep = () => {
    if (step < 4) setStep(step + 1);
    else createUser();
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="onboarding-bg" style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '520px', position: 'relative', zIndex: 1 }}>
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{ textAlign: 'center' }}
            >
              <img src="/logo.svg" alt="HEI-C" style={{
                width: '88px', height: '88px', margin: '0 auto 2rem', display: 'block',
                boxShadow: '0 12px 40px rgba(74, 95, 193, 0.3)', borderRadius: '20px',
              }} />

              <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.75rem', lineHeight: 1.2 }}>
                Welcome to HEI-C
              </h1>
              <p style={{ fontSize: '1.15rem', color: '#6B7280', marginBottom: '0.5rem' }}>
                Your Emotional Intelligence Career Operating System
              </p>
              <p style={{ color: '#9CA3AF', marginBottom: '2.5rem', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.7 }}>
                Track career events, understand your emotional patterns, and build emotional intelligence for professional growth.
              </p>

              {/* Feature highlights */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
                {[
                  { icon: Heart, label: 'Track Emotions', color: '#EF4444' },
                  { icon: BarChart3, label: 'View Patterns', color: '#4A5FC1' },
                  { icon: Zap, label: 'Get Actions', color: '#F59E0B' },
                ].map(item => (
                  <div key={item.label} style={{
                    backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem 0.75rem',
                    border: '1px solid #F3F4F6', textAlign: 'center',
                  }}>
                    <item.icon size={24} color={item.color} style={{ margin: '0 auto 0.5rem' }} />
                    <p style={{ fontSize: '0.8rem', fontWeight: 500, color: '#6B7280' }}>{item.label}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '400px', margin: '0 auto' }}>
                <Button size="lg" fullWidth onClick={() => setStep(1)}>
                  Get Started <ArrowRight size={18} />
                </Button>
                <Button variant="ghost" size="lg" fullWidth onClick={() => createUser(true)}>
                  Skip Setup
                </Button>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="game"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <EmotionGame onComplete={() => setStep(2)} />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.35 }}
            >
              <StepHeader step={1} total={4} title="Tell us about yourself" />
              <div style={{
                backgroundColor: 'white', borderRadius: '20px', padding: '2rem',
                border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <Input
                    label="Your Name"
                    placeholder="Enter your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                  />
                  <Input
                    label="Career Role / Title"
                    placeholder="e.g., Software Engineer, Product Manager"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                  />
                </div>
              </div>
              <NavButtons onBack={prevStep} onNext={nextStep} canProceed={canProceed()} />
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.35 }}
            >
              <StepHeader step={2} total={4} title="Your Career Goals" />
              <div style={{
                backgroundColor: 'white', borderRadius: '20px', padding: '2rem',
                border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#1F2937', marginBottom: '0.5rem' }}>
                  What are your primary career goals or current challenges?
                </label>
                <textarea
                  style={{
                    width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid #E5E7EB',
                    backgroundColor: 'white', color: '#1F2937', fontSize: '0.875rem', lineHeight: 1.6,
                    resize: 'none', outline: 'none', fontFamily: 'inherit',
                  }}
                  rows={4}
                  placeholder="e.g., Get promoted to senior level, improve leadership skills, manage work-life balance..."
                  value={goals}
                  onChange={e => setGoals(e.target.value)}
                  onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(74,95,193,0.12)'; e.target.style.borderColor = 'transparent'; }}
                  onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#E5E7EB'; }}
                />
              </div>
              <NavButtons onBack={prevStep} onNext={nextStep} canProceed={true} />
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.35 }}
            >
              <StepHeader step={3} total={4} title="Check-in Preferences" />
              <div style={{
                backgroundColor: 'white', borderRadius: '20px', padding: '2rem',
                border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '1.25rem' }}>
                  How often would you like to log your emotions?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {([
                    { value: 'daily' as const, label: 'Daily', desc: 'Build a consistent habit with daily check-ins' },
                    { value: 'weekly' as const, label: 'Weekly', desc: 'Reflect on your week every 7 days' },
                    { value: 'as-needed' as const, label: 'As Needed', desc: 'Log whenever you feel the need' },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFrequency(opt.value)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '1rem 1.25rem', borderRadius: '14px',
                        border: `2px solid ${frequency === opt.value ? '#4A5FC1' : '#F3F4F6'}`,
                        backgroundColor: frequency === opt.value ? 'rgba(74,95,193,0.04)' : 'white',
                        cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: frequency === opt.value ? '0 1px 4px rgba(74,95,193,0.1)' : 'none',
                      }}
                    >
                      <div style={{ fontWeight: 500, color: '#1F2937', fontSize: '0.95rem' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.825rem', color: '#6B7280', marginTop: '0.15rem' }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <Button variant="outline" onClick={prevStep} className="flex-1">
                  <ArrowLeft size={16} /> Back
                </Button>
                <Button onClick={() => createUser()} className="flex-1">
                  <Sparkles size={16} /> Complete Setup
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepHeader({ step, total, title }: { step: number; total: number; title: string }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            style={{
              height: '4px', flex: 1, borderRadius: '4px', transition: 'all 0.3s',
              backgroundColor: i < step ? '#4A5FC1' : '#E5E7EB',
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: '0.875rem', color: '#9CA3AF', marginBottom: '0.25rem' }}>Step {step} of {total}</p>
      <h2 style={{ fontSize: '1.375rem', fontWeight: 600, color: '#1F2937' }}>{title}</h2>
    </div>
  );
}

function NavButtons({ onBack, onNext, canProceed }: { onBack: () => void; onNext: () => void; canProceed: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
      <Button variant="outline" onClick={onBack} className="flex-1">
        <ArrowLeft size={16} /> Back
      </Button>
      <Button onClick={onNext} disabled={!canProceed} className="flex-1">
        Continue <ArrowRight size={16} />
      </Button>
    </div>
  );
}
