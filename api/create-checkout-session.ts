import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
    res.status(503).json({ error: 'Payment service not configured.' });
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
    res.status(401).json({ error: 'Invalid or expired session.' });
    return;
  }

  const { cohort_id } = req.body as { cohort_id?: string };
  if (!cohort_id) {
    res.status(400).json({ error: 'cohort_id is required.' });
    return;
  }

  const { data: cohort, error: cohortError } = await supabase
    .from('cohorts')
    .select('*')
    .eq('id', cohort_id)
    .eq('is_active', true)
    .single();

  if (cohortError || !cohort) {
    res.status(404).json({ error: 'Cohort not found or enrollment closed.' });
    return;
  }

  const now = new Date();
  if (now < new Date(cohort.enrollment_opens_at) || now > new Date(cohort.enrollment_closes_at)) {
    res.status(400).json({ error: 'Enrollment window is not open.' });
    return;
  }

  const { data: existingPasses } = await supabase
    .from('user_passes')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gte('access_ends_at', now.toISOString())
    .limit(1);

  if (existingPasses && existingPasses.length > 0) {
    res.status(400).json({ error: 'You already have an active pass.' });
    return;
  }

  if (cohort.max_seats !== null) {
    const { count } = await supabase
      .from('user_passes')
      .select('*', { count: 'exact', head: true })
      .eq('cohort_id', cohort_id)
      .in('status', ['active']);

    if (count !== null && count >= cohort.max_seats) {
      res.status(400).json({ error: 'This cohort is sold out.' });
      return;
    }
  }

  const stripe = new Stripe(stripeKey);
  const origin = req.headers.origin || 'https://hello-eq.com';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price: cohort.stripe_price_id,
      quantity: 1,
    }],
    metadata: {
      user_id: user.id,
      cohort_id: cohort.id,
    },
    customer_email: user.email,
    success_url: `${origin}/account?purchase=success`,
    cancel_url: `${origin}/account?purchase=cancelled`,
  });

  res.status(200).json({ url: session.url });
}
