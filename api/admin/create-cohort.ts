import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = (process.env.VITE_ALLOWED_ADMIN_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) { res.status(503).json({ error: 'Not configured.' }); return; }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'Auth required.' }); return; }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }

  const body = req.body as {
    name: string;
    enrollment_opens_at: string;
    enrollment_closes_at: string;
    cohort_starts_at: string;
    cohort_ends_at: string;
    price_cents: number;
    max_seats: number | null;
    stripe_price_id: string | null;
  };

  const { data, error } = await supabase
    .from('cohorts')
    .insert({
      name: body.name,
      enrollment_opens_at: body.enrollment_opens_at,
      enrollment_closes_at: body.enrollment_closes_at,
      cohort_starts_at: body.cohort_starts_at,
      cohort_ends_at: body.cohort_ends_at,
      price_cents: body.price_cents,
      max_seats: body.max_seats,
      stripe_price_id: body.stripe_price_id,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('[HEQ] create-cohort error:', error.message);
    res.status(500).json({ error: 'Failed to create cohort.' });
    return;
  }

  res.status(200).json(data);
}
