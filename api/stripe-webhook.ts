import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    res.status(503).json({ error: 'Webhook not configured.' });
    return;
  }

  const stripe = new Stripe(stripeKey);
  const rawBody = await readRawBody(req);
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    console.error('[HEQ] Stripe webhook signature verification failed:', message);
    res.status(400).json({ error: 'Invalid signature.' });
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const cohortId = session.metadata?.cohort_id;

    if (!userId || !cohortId) {
      console.error('[HEQ] Stripe webhook: missing metadata', { userId, cohortId });
      res.status(400).json({ error: 'Missing metadata.' });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: cohort } = await supabase
      .from('cohorts')
      .select('cohort_starts_at, cohort_ends_at')
      .eq('id', cohortId)
      .single();

    if (!cohort) {
      console.error('[HEQ] Stripe webhook: cohort not found', cohortId);
      res.status(400).json({ error: 'Cohort not found.' });
      return;
    }

    const { error: insertError } = await supabase
      .from('user_passes')
      .insert({
        user_id: userId,
        cohort_id: cohortId,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
        access_starts_at: cohort.cohort_starts_at,
        access_ends_at: cohort.cohort_ends_at,
        status: 'active',
      });

    if (insertError) {
      console.error('[HEQ] Stripe webhook: insert error', insertError.message);
      res.status(500).json({ error: 'Failed to create pass.' });
      return;
    }

    console.log(JSON.stringify({
      event: 'pass_created',
      user_id: userId,
      cohort_id: cohortId,
      checkout_session_id: session.id,
    }));
  }

  res.status(200).json({ received: true });
}
