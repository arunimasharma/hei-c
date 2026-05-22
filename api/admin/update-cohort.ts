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

  const { id, updates } = req.body as { id: string; updates: Record<string, unknown> };
  if (!id) { res.status(400).json({ error: 'id required.' }); return; }

  const { error } = await supabase
    .from('cohorts')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('[HEQ] update-cohort error:', error.message);
    res.status(500).json({ error: 'Failed to update cohort.' });
    return;
  }

  res.status(200).json({ success: true });
}
