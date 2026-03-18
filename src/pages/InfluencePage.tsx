import { Zap } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import InfluencePanel from '../components/feedback/InfluencePanel';

export default function InfluencePage() {
  return (
    <DashboardLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color="white" />
          </div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.02em' }}>
            Influence
          </h1>
        </div>

        {/* Intro banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.875rem 1.125rem', borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(217,119,6,0.07) 0%, rgba(74,95,193,0.07) 100%)',
          border: '1px solid rgba(217,119,6,0.18)',
        }}>
          <Zap size={18} color="#D97706" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
              Give feedback → earn status → shape products
            </p>
            <p style={{ fontSize: '0.78rem', color: '#6B7280', margin: '0.125rem 0 0' }}>
              Every friction signal you share builds your product influence profile.
            </p>
          </div>
        </div>

        <InfluencePanel />
      </div>
    </DashboardLayout>
  );
}
