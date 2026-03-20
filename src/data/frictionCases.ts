/**
 * Anonymized real friction cases drawn from aggregated user signal patterns.
 * Each case presents a real-world PM scenario: trigger → user response → analysis challenge.
 */

export type FrictionTheme = 'pricing' | 'ux' | 'onboarding' | 'value' | 'trust';

export interface FrictionCase {
  id: string;
  trigger: 'exit_intent' | 'time_stall' | 'scroll_stall' | 'no_action';
  /** Where in the product journey this friction occurred */
  context: string;
  /** Short anonymised quote from the user */
  rawResponse: string;
  /** Brief narrative for PM context */
  narrative: string;
  theme: FrictionTheme;
  rootIssueOptions: string[];
  correctRootIssueIndex: number;
  fixOptions: string[];
  correctFixIndex: number;
  /** What aggregate real-user data actually shows */
  realDataInsight: string;
  /** % of respondents who gave the rawResponse option */
  signalStrength: number;
  /** % of PMs who correctly identified root issue in past sessions */
  pmAgreementRate: number;
}

export const FRICTION_CASES: FrictionCase[] = [
  // ── PRICING ──────────────────────────────────────────────────────────────────
  {
    id: 'fc_001',
    trigger: 'exit_intent',
    context: 'Pricing page — cursor moved toward browser chrome after 40s on page',
    rawResponse: 'Too expensive',
    narrative:
      'User landed on pricing after clicking "Upgrade" from a feature gate. They scrolled to the Pro plan, hovered for ~40s, then moved to close the tab.',
    theme: 'pricing',
    rootIssueOptions: [
      'The price point is objectively above market rate',
      'The value delivered before the paywall is not clear enough',
      'There is no free-trial option to reduce commitment anxiety',
      'The pricing page layout is confusing and hard to compare tiers',
    ],
    correctRootIssueIndex: 1,
    fixOptions: [
      'Cut the Pro plan price by 25%',
      'Add social proof and outcome metrics above the pricing tiers',
      'Add a 7-day free trial with no credit card required',
      'Redesign pricing table with a feature comparison matrix',
    ],
    correctFixIndex: 1,
    realDataInsight:
      '71% of users who flagged "Too expensive" had never seen a success story or outcome metric before reaching the pricing page. Only 18% actually converted after a price reduction; 54% converted after adding a social proof section above the fold.',
    signalStrength: 71,
    pmAgreementRate: 58,
  },
  {
    id: 'fc_002',
    trigger: 'time_stall',
    context: 'Pricing page — user stalled on the annual vs. monthly toggle for 2+ minutes',
    rawResponse: 'Thinking it over',
    narrative:
      'User toggled between annual and monthly pricing multiple times, scrolled down to read the FAQ, then returned to the toggle without making a decision.',
    theme: 'pricing',
    rootIssueOptions: [
      'Annual pricing discount is not compelling enough',
      'User cannot calculate whether the savings justify the upfront cost',
      'The product value over 12 months is not demonstrated anywhere nearby',
      'The toggle UX is confusing — users don\'t understand what changes',
    ],
    correctRootIssueIndex: 2,
    fixOptions: [
      'Increase the annual discount from 20% to 40%',
      'Add a savings calculator next to the toggle',
      'Show "What you\'ll achieve in 12 months" testimonials near the toggle',
      'Simplify to one pricing option to reduce cognitive load',
    ],
    correctFixIndex: 2,
    realDataInsight:
      '55% of "Thinking it over" users converted when a "Most teams see X outcome in 6 months" stat was placed near the annual/monthly toggle — versus 21% with the toggle alone.',
    signalStrength: 55,
    pmAgreementRate: 44,
  },

  // ── UX / CLARITY ─────────────────────────────────────────────────────────────
  {
    id: 'fc_003',
    trigger: 'time_stall',
    context: 'Dashboard — user stalled 90s on the main action area without clicking anything',
    rawResponse: 'Confusing UI',
    narrative:
      'New user on day 2 of trial. They clicked into the main dashboard, scrolled up and down twice, then moved their cursor between 3 different CTAs without clicking any of them.',
    theme: 'ux',
    rootIssueOptions: [
      'There are too many competing calls-to-action on one screen',
      'The visual hierarchy doesn\'t make the primary action obvious',
      'The labels are using technical jargon unfamiliar to new users',
      'The page loads too slowly, causing perceived unresponsiveness',
    ],
    correctRootIssueIndex: 0,
    fixOptions: [
      'Reduce the page to a single prominent CTA for new users',
      'Increase the font size of all buttons',
      'Add tooltips to every feature',
      'Add a loading spinner to confirm the page has loaded',
    ],
    correctFixIndex: 0,
    realDataInsight:
      '74% of "Confusing UI" signals in the first 3 days of a trial came from screens with 4+ CTAs visible simultaneously. Teams that gated secondary actions behind the primary action flow saw 62% higher day-3 retention.',
    signalStrength: 74,
    pmAgreementRate: 61,
  },
  {
    id: 'fc_004',
    trigger: 'scroll_stall',
    context: 'Feature detail page — user paused scrolling mid-page for 70+ seconds',
    rawResponse: 'Interesting but unclear',
    narrative:
      'User arrived from an email campaign about a new feature. They read the hero section, scrolled 60% down the page, then stopped on the technical diagram section and did not scroll further.',
    theme: 'ux',
    rootIssueOptions: [
      'The feature description uses language that assumes prior knowledge',
      'The technical diagram is too complex for the target audience',
      'The page is too long and users lose momentum',
      'The feature is genuinely uninteresting to this user segment',
    ],
    correctRootIssueIndex: 1,
    fixOptions: [
      'Replace the technical diagram with a 30-second explainer video',
      'Shorten the page by 50%',
      'Add a glossary link next to technical terms',
      'A/B test with a completely different audience segment',
    ],
    correctFixIndex: 0,
    realDataInsight:
      '72% of scroll-stall events on feature pages occurred at diagram or table sections. Replacing complex diagrams with a short video or annotated screenshot walkthrough reduced stall-to-exit rate by 48%.',
    signalStrength: 72,
    pmAgreementRate: 53,
  },

  // ── ONBOARDING ───────────────────────────────────────────────────────────────
  {
    id: 'fc_005',
    trigger: 'no_action',
    context: 'Onboarding step 1 — user viewed the welcome screen for 3+ minutes without clicking "Get Started"',
    rawResponse: 'Not sure where to start',
    narrative:
      'User signed up via a referral link, landed on the onboarding welcome screen. The screen had a welcome message, a product overview video, and a "Get Started" button. User watched 15s of video, paused it, then did nothing for 3 minutes.',
    theme: 'onboarding',
    rootIssueOptions: [
      'The "Get Started" button is visually not prominent enough',
      'The product overview video is too long and not immediately actionable',
      'The user doesn\'t understand what completing onboarding will give them',
      'The referral context set wrong expectations about the product',
    ],
    correctRootIssueIndex: 2,
    fixOptions: [
      'Make the "Get Started" button bigger and bolder',
      'Replace the video with a 3-step visual checklist showing clear outcomes',
      'Add a progress bar to show onboarding completion percentage',
      'Remove the video entirely to reduce friction',
    ],
    correctFixIndex: 1,
    realDataInsight:
      '77% of users who said "Not sure where to start" completed onboarding when presented with a checklist format that showed the specific outcome of each step (e.g. "After this you\'ll have your first report ready"). Generic progress bars had no measurable effect.',
    signalStrength: 77,
    pmAgreementRate: 66,
  },
  {
    id: 'fc_006',
    trigger: 'exit_intent',
    context: 'Onboarding step 3 of 5 — user tried to exit mid-flow',
    rawResponse: 'Too much to take in',
    narrative:
      'User reached step 3 (connecting their first data source) and moved to close the tab. Onboarding had been: account details → team setup → integration setup.',
    theme: 'onboarding',
    rootIssueOptions: [
      'Onboarding has too many steps and feels like a chore',
      'Step 3 asks for technical knowledge the user doesn\'t have ready',
      'Users don\'t understand why integration is required at this point',
      'The onboarding design is visually overwhelming',
    ],
    correctRootIssueIndex: 2,
    fixOptions: [
      'Reduce onboarding from 5 steps to 3 steps',
      'Allow users to skip the integration step and do it later',
      'Add an explainer: "Connecting your data lets you see X result immediately"',
      'Hire a designer to simplify the onboarding UI',
    ],
    correctFixIndex: 2,
    realDataInsight:
      '64% of mid-onboarding exits happened at integration steps. Adding a one-line "why this matters now" explanation reduced drop-off by 41%. Giving users a "skip for now" option had a smaller effect (12% improvement) because most who skipped never returned.',
    signalStrength: 64,
    pmAgreementRate: 49,
  },

  // ── VALUE ─────────────────────────────────────────────────────────────────────
  {
    id: 'fc_007',
    trigger: 'time_stall',
    context: 'Feature usage page — power user stalled before using a key feature for the 10th time',
    rawResponse: 'Not useful yet',
    narrative:
      'User is on day 14 of trial, has logged in 8 times but never used the core AI analysis feature. They open the feature page, stall at the input field for 2 minutes, then close it.',
    theme: 'value',
    rootIssueOptions: [
      'The feature itself doesn\'t match what the user came to do',
      'The feature\'s input requirements are unclear — user doesn\'t know what to type',
      'User hasn\'t seen a compelling example of what a good output looks like',
      'The feature is behind a paywall the user hit unexpectedly',
    ],
    correctRootIssueIndex: 2,
    fixOptions: [
      'Remove the feature until it\'s more intuitive',
      'Pre-populate the input with an example and show the resulting output',
      'Add a text prompt explaining what the input field expects',
      'Send an email sequence explaining the feature',
    ],
    correctFixIndex: 1,
    realDataInsight:
      '58% of "Not useful yet" signals came from users who had never seen a completed example output. Teams that added a "Try with this example" pre-fill saw feature adoption jump from 14% to 61% among stalling users.',
    signalStrength: 58,
    pmAgreementRate: 57,
  },
  {
    id: 'fc_008',
    trigger: 'scroll_stall',
    context: 'Results/output page — user paused on their first generated output for 90+ seconds',
    rawResponse: 'Looking for something',
    narrative:
      'User ran their first analysis and got an output. They scrolled down through the results, stopped near the bottom, then scrolled back up. They did not export, share, or take any next action.',
    theme: 'value',
    rootIssueOptions: [
      'The output format is hard to read or interpret',
      'The output is missing the specific metric the user cared about most',
      'There is no clear "next action" prompt after viewing results',
      'The results page does not explain what the numbers mean',
    ],
    correctRootIssueIndex: 2,
    fixOptions: [
      'Redesign the results page layout',
      'Add more metrics to the output',
      'Add a "What to do next" section at the bottom of every results page',
      'Send a follow-up email explaining the results',
    ],
    correctFixIndex: 2,
    realDataInsight:
      '61% of users who stalled on a results page with no clear next action churned within 7 days. Adding a contextual "Based on these results, your next step is…" section reduced 7-day churn by 34% without changing the output quality.',
    signalStrength: 61,
    pmAgreementRate: 52,
  },

  // ── TRUST ──────────────────────────────────────────────────────────────────────
  {
    id: 'fc_009',
    trigger: 'exit_intent',
    context: 'Sign-up page — user filled in email then moved to exit before confirming',
    rawResponse: 'Just browsing',
    narrative:
      'User arrived from a LinkedIn ad, filled in their work email in the sign-up form, then paused for 30s before moving to close the tab without submitting.',
    theme: 'trust',
    rootIssueOptions: [
      'The product is not interesting enough to justify creating an account',
      'User is concerned about data privacy and what signing up commits them to',
      'The sign-up form asks for too much information upfront',
      'The product looks too similar to something they already use',
    ],
    correctRootIssueIndex: 1,
    fixOptions: [
      'Run better-targeted ads to reach more intent-ready users',
      'Add a "No credit card. Cancel any time. SOC2 certified." trust line near the submit button',
      'Reduce the sign-up form to email only',
      'Change the headline on the landing page',
    ],
    correctFixIndex: 1,
    realDataInsight:
      '62% of "Just browsing" exit signals from sign-up pages correlated with users who had not seen any trust signals (security badges, data policy summary, no-credit-card statement) before the form. Adding a single trust line near the CTA increased sign-up completion by 29%.',
    signalStrength: 62,
    pmAgreementRate: 55,
  },
  {
    id: 'fc_010',
    trigger: 'scroll_stall',
    context: 'Landing page — user stalled on the "How it works" section for 80+ seconds',
    rawResponse: 'Confusing',
    narrative:
      'User came from a Google search. They read the hero, clicked "Learn More," and scrolled into the How It Works section. They read the 3-step diagram slowly, then re-read step 2 three times without continuing.',
    theme: 'trust',
    rootIssueOptions: [
      'The 3-step diagram is visually too complex',
      'Step 2 involves something the user finds risky (e.g. data access, installation)',
      'The language in step 2 uses an unfamiliar technical term',
      'There are too many steps — user loses confidence before finishing',
    ],
    correctRootIssueIndex: 1,
    fixOptions: [
      'Simplify the diagram to 2 steps instead of 3',
      'Add a trust note directly under the risky step explaining why it\'s safe',
      'Replace technical terms with plain-language equivalents',
      'Remove the How It Works section entirely',
    ],
    correctFixIndex: 1,
    realDataInsight:
      '74% of stall events on "How it works" sections occurred specifically on steps that involved data access, installation, or integration. Adding a one-sentence security reassurance ("Your data never leaves your environment") directly below those steps resolved 67% of stalls.',
    signalStrength: 74,
    pmAgreementRate: 63,
  },
];

export const THEME_LABELS: Record<FrictionTheme, { label: string; emoji: string; color: string; bg: string }> = {
  pricing:    { label: 'Pricing',    emoji: '💰', color: '#D97706', bg: '#FFFBEB' },
  ux:         { label: 'UX / Clarity', emoji: '🧭', color: '#4A5FC1', bg: '#EEF0FB' },
  onboarding: { label: 'Onboarding', emoji: '🗺️', color: '#10B981', bg: '#ECFDF5' },
  value:      { label: 'Value',      emoji: '🎯', color: '#7C3AED', bg: '#F5F3FF' },
  trust:      { label: 'Trust',      emoji: '🔒', color: '#0369A1', bg: '#F0F9FF' },
};
