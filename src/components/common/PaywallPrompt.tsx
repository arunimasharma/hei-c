import { useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock } from 'lucide-react';
import Button from './Button';
import Card from './Card';
import { usePass } from '../../context/PassContext';
import type { FeatureKey } from '../../services/passService';
import { trackEvent } from '../../lib/posthog';

const FEATURE_LABELS: Record<FeatureKey, string> = {
  coach: 'coach sessions',
  validator: 'Idea Validator sessions',
  taste: 'Product Taste exercises',
};

interface PaywallPromptProps {
  feature: FeatureKey;
  onUpgrade: () => void;
}

export default function PaywallPrompt({ feature, onUpgrade }: PaywallPromptProps) {
  const { getUsage, openCohort } = usePass();
  const { limit } = getUsage(feature);

  useEffect(() => {
    trackEvent('paywall_shown', { feature, cohort_id: openCohort?.id });
  }, [feature, openCohort?.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '16px',
          backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 1.25rem',
        }}>
          <Lock size={24} color="#F59E0B" />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', margin: '0 0 0.5rem' }}>
          You've used all {limit} free {FEATURE_LABELS[feature]}
        </h3>

        {openCohort ? (
          <>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              Join <strong>{openCohort.name}</strong> for unlimited access to all features.
              <br />
              ${(openCohort.price_cents / 100).toFixed(0)} for{' '}
              {Math.round((new Date(openCohort.cohort_ends_at).getTime() - new Date(openCohort.cohort_starts_at).getTime()) / (1000 * 60 * 60 * 24 * 7))}{' '}
              weeks of full access.
            </p>
            <Button onClick={() => { trackEvent('checkout_started', { cohort_id: openCohort?.id, price: openCohort?.price_cents }); onUpgrade(); }} size="lg">
              Join Cohort
            </Button>
          </>
        ) : (
          <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0', lineHeight: 1.6 }}>
            No cohort is currently open for enrollment.
            <br />
            Check back soon for the next cohort!
          </p>
        )}
      </Card>
    </motion.div>
  );
}
