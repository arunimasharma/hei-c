import { supabase } from '../lib/supabaseClient';
import type { Cohort } from './passService';

export interface AdminCohort extends Cohort {
  enrolled_count?: number;
}

export interface EnrolledUser {
  user_id: string;
  email: string;
  purchased_at: string;
  coach_usage: number;
  validator_usage: number;
  taste_usage: number;
}

export async function fetchAllCohorts(): Promise<AdminCohort[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('cohorts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('[HEQ] fetchAllCohorts:', error.message); return []; }
  return data ?? [];
}

export async function createCohort(cohort: {
  name: string;
  enrollment_opens_at: string;
  enrollment_closes_at: string;
  cohort_starts_at: string;
  cohort_ends_at: string;
  price_cents: number;
  max_seats: number | null;
}): Promise<AdminCohort | null> {
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const priceRes = await fetch('/api/admin/create-stripe-price', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ price_cents: cohort.price_cents, cohort_name: cohort.name }),
  });

  let stripePriceId: string | null = null;
  if (priceRes.ok) {
    const priceData = await priceRes.json();
    stripePriceId = priceData.price_id;
  }

  // Use admin API route to create cohort (service role needed for insert)
  const createRes = await fetch('/api/admin/create-cohort', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ ...cohort, stripe_price_id: stripePriceId }),
  });

  if (!createRes.ok) return null;
  return createRes.json();
}

export async function updateCohort(id: string, updates: Partial<AdminCohort>): Promise<boolean> {
  if (!supabase) return false;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const res = await fetch('/api/admin/update-cohort', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ id, updates }),
  });
  return res.ok;
}

export async function fetchCohortUsers(cohortId: string): Promise<EnrolledUser[]> {
  if (!supabase) return [];
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  const res = await fetch(`/api/admin/cohort-users?cohort_id=${cohortId}`, {
    headers: { 'Authorization': `Bearer ${session.access_token}` },
  });
  if (!res.ok) return [];
  return res.json();
}
