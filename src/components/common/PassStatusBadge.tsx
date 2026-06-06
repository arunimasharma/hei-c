import { Shield, Clock } from 'lucide-react';
import Card from './Card';
import { usePass } from '../../context/PassContext';

export default function PassStatusBadge() {
  const { hasPaidPass, daysLeft, passes } = usePass();

  if (!hasPaidPass && passes.length === 0) return null;

  const isExpiringSoon = daysLeft !== null && daysLeft <= 7;

  return (
    <Card style={{
      padding: '1rem 1.25rem',
      borderLeft: `4px solid ${hasPaidPass ? '#10B981' : '#F59E0B'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          backgroundColor: hasPaidPass ? '#ECFDF5' : '#FEF3C7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {hasPaidPass
            ? <Shield size={18} color="#10B981" />
            : <Clock size={18} color="#F59E0B" />
          }
        </div>
        <div>
          <p style={{
            fontSize: '0.875rem', fontWeight: 600, margin: 0,
            color: hasPaidPass ? '#065F46' : '#92400E',
          }}>
            {hasPaidPass
              ? `Active Pass — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
              : 'Pass Expired'
            }
          </p>
          {isExpiringSoon && hasPaidPass && (
            <p style={{ fontSize: '0.75rem', color: '#F59E0B', margin: '0.125rem 0 0' }}>
              Your access expires soon
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
