import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = (process.env.VITE_ALLOWED_ADMIN_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeKey || !supabaseUrl || !serviceKey) { res.status(503).json({ error: 'Not configured.' }); return; }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'Auth required.' }); return; }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }

  const { price_cents, cohort_name } = req.body as { price_cents: number; cohort_name: string };
  const stripe = new Stripe(stripeKey);

  const products = await stripe.products.list({ limit: 1, active: true });
  let productId: string;
  if (products.data.length > 0) {
    productId = products.data[0].id;
  } else {
    const product = await stripe.products.create({ name: 'Hello-EQ Cohort Access' });
    productId = product.id;
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: price_cents,
    currency: 'usd',
    metadata: { cohort_name },
  });

  res.status(200).json({ price_id: price.id });
}
