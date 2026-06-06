import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(503).json({ error: 'Service not configured.' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

  if (authError || !user) {
    res.status(401).json({ error: 'Invalid session.' });
    return;
  }

  const { feature } = req.body as { feature?: string };
  if (!feature || !['coach', 'validator', 'taste'].includes(feature)) {
    res.status(400).json({ error: 'feature must be "coach", "validator", or "taste".' });
    return;
  }

  const { data: newCount, error: rpcError } = await supabase
    .rpc('increment_usage', { p_user_id: user.id, p_feature: feature });

  if (rpcError) {
    console.error('[HEQ] usage-increment error:', rpcError.message);
    res.status(500).json({ error: 'Failed to increment usage.' });
    return;
  }

  res.status(200).json({ count: newCount });
}
