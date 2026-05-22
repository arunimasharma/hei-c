import { supabase } from '../lib/supabaseClient';

export interface UserPass {
  id: string;
  user_id: string;
  cohort_id: string;
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
  purchased_at: string;
  access_starts_at: string;
  access_ends_at: string;
  status: 'active' | 'expired' | 'refunded';
}

export interface UsageCount {
  feature: 'coach' | 'validator' | 'taste';
  count: number;
}

export interface Cohort {
  id: string;
  name: string;
  enrollment_opens_at: string;
  enrollment_closes_at: string;
  cohort_starts_at: string;
  cohort_ends_at: string;
  price_cents: number;
  stripe_price_id: string | null;
  max_seats: number | null;
  is_active: boolean;
}

export const FREE_LIMITS = {
  coach: 3,
  validator: 2,
  taste: 5,
} as const;

export type FeatureKey = keyof typeof FREE_LIMITS;

export function hasActivePass(passes: UserPass[]): boolean {
  const now = new Date();
  return passes.some(
    p => p.status === 'active'
      && new Date(p.access_starts_at) <= now
      && new Date(p.access_ends_at) > now,
  );
}

export function isFeatureLocked(feature: FeatureKey, usageCount: number, hasPaidPass: boolean): boolean {
  if (hasPaidPass) return false;
  return usageCount >= FREE_LIMITS[feature];
}

export function daysRemaining(passes: UserPass[]): number | null {
  const now = new Date();
  const active = passes.find(
    p => p.status === 'active'
      && new Date(p.access_starts_at) <= now
      && new Date(p.access_ends_at) > now,
  );
  if (!active) return null;
  const msRemaining = new Date(active.access_ends_at).getTime() - now.getTime();
  return Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
}

export async function fetchUserPasses(): Promise<UserPass[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('user_passes')
    .select('*')
    .order('purchased_at', { ascending: false });
  if (error) { console.error('[HEQ] fetchUserPasses error:', error.message); return []; }
  return data ?? [];
}

export async function fetchUsageCounts(): Promise<UsageCount[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('usage_counts')
    .select('feature, count');
  if (error) { console.error('[HEQ] fetchUsageCounts error:', error.message); return []; }
  return data ?? [];
}

export async function fetchOpenCohort(): Promise<Cohort | null> {
  if (!supabase) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('cohorts')
    .select('*')
    .eq('is_active', true)
    .lte('enrollment_opens_at', now)
    .gte('enrollment_closes_at', now)
    .limit(1)
    .single();
  if (error || !data) return null;
  return data;
}
