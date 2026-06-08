// ── The creator this Drilloop membership is built around ──
// MVP is deliberately single-creator, single-topic (per the product strategy):
// prove people will pay for the learning loop before generalising.

export interface CreatorTier {
  id: string;
  name: string;
  price: number; // monthly USD
  blurb: string;
  features: string[];
  highlighted?: boolean;
}

export interface CreatorProfile {
  name: string;
  handle: string;
  avatar: string; // emoji stand-in for a profile photo
  topic: string;
  tagline: string;
  bio: string;
  proof: string;
  tiers: CreatorTier[];
}

export const CREATOR: CreatorProfile = {
  name: 'Arunima Sharma',
  handle: '@arunima.pm',
  avatar: '🧭',
  topic: 'Agentic AI & AI Product Judgment',
  tagline: 'Stop forgetting what you read. Drill the judgment that makes you defensible.',
  bio: 'PM who has shipped agentic products. I turn the theory you skim on LinkedIn into daily reps so you can defend every architectural call — workflow vs agent, eval design, the security gates — without notes.',
  proof: 'Based on the 8-phase Agentic AI Development Theory study plan.',
  tiers: [
    {
      id: 'free',
      name: 'Follower',
      price: 0,
      blurb: 'Taste the loop.',
      features: ['Sample drills from free posts', 'Instant AI grading', 'See your first score'],
    },
    {
      id: 'member',
      name: 'Drilloop Member',
      price: 19,
      blurb: 'The full learning loop.',
      highlighted: true,
      features: [
        'All 20 drills across 8 phases',
        'AI grading + reference answers on every drill',
        'Streaks, mastery & weak-area tracking',
        'Daily drill nudges',
        'Leaderboard & shoutouts',
      ],
    },
    {
      id: 'pro',
      name: 'Cohort + Coaching',
      price: 79,
      blurb: 'Defend it under fire.',
      features: ['Everything in Member', 'Monthly live capstone review', 'In-person meetups', '1:1 mock interrogation'],
    },
  ],
};
