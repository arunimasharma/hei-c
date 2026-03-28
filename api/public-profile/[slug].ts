/**
 * GET /api/public-profile/:slug
 *
 * Public, unauthenticated endpoint that returns a user's credibility profile.
 * Only exposes derived aggregates — no PII, no sensitive data.
 *
 * Response shape:
 *   {
 *     credibilityScore: number,   // 0–100
 *     expertTags:       string[], // theme identifiers
 *     proofHash:        string,   // SHA-256 fingerprint for verification
 *     lastUpdated:      string,   // ISO timestamp
 *   }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient }                        from '@supabase/supabase-js';

// Service-role client — only used server-side, never exposed to the client.
// Falls back gracefully when env vars are absent.
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only GET is supported
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;
  if (!slug || typeof slug !== 'string' || slug.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid slug' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Service not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('public_profiles')
      .select('credibility_score, expert_tags, proof_hash, last_updated')
      .eq('public_slug', slug.trim())
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Cache publicly for 5 minutes; stale-while-revalidate for 60s
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');

    return res.status(200).json({
      credibilityScore: data.credibility_score,
      expertTags:       data.expert_tags ?? [],
      proofHash:        data.proof_hash,
      lastUpdated:      data.last_updated,
    });
  } catch (err) {
    console.error('[public-profile] fetch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
