import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = (process.env.VITE_ALLOWED_ADMIN_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

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

  const cohortId = req.query.cohort_id as string;
  if (!cohortId) { res.status(400).json({ error: 'cohort_id required.' }); return; }

  const { data: passes } = await supabase
    .from('user_passes')
    .select('user_id, purchased_at')
    .eq('cohort_id', cohortId);

  if (!passes || passes.length === 0) { res.status(200).json([]); return; }

  const users: Array<{ user_id: string; email: string; purchased_at: string; coach_usage: number; validator_usage: number; taste_usage: number }> = [];

  for (const pass of passes) {
    const { data: { user: authUser } } = await supabase.auth.admin.getUserById(pass.user_id);

    const { data: usage } = await supabase
      .from('usage_counts')
      .select('feature, count')
      .eq('user_id', pass.user_id);

    const counts = { coach: 0, validator: 0, taste: 0 };
    usage?.forEach(u => {
      if (u.feature in counts) counts[u.feature as keyof typeof counts] = u.count;
    });

    users.push({
      user_id: pass.user_id,
      email: authUser?.email ?? 'unknown',
      purchased_at: pass.purchased_at,
      coach_usage: counts.coach,
      validator_usage: counts.validator,
      taste_usage: counts.taste,
    });
  }

  res.status(200).json(users);
}
