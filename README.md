# Hello-EQ

**Turn real-world product experiences into structured insights that sharpen product thinking — and turn rough ideas into testable prototypes.**

Hello-EQ is a deliberate-practice platform for product managers and aspiring PMs. It pairs an AI coach for career and emotional growth with a product-taste studio for sharpening analytical instincts, and a validator that converts messy ideas into paste-ready build prompts for a coding agent.

Live app → [hello-eq.club](https://hello-eq.club)

---

## The Three Surfaces

```
🧠 Career EQ Coach   →   🧪 Product Career   →   ✨ Idea Validator
   ( your day )          ( your craft )          ( your next bet )
```

| Surface | Route | What it does |
|---------|-------|--------------|
| **🧠 Career EQ Coach** | `/` | One conversational entry point that routes you to journaling, product taste, AI/tech action plans, decision logs, or PM artifact drafting. |
| **🧪 Product Career** | `/product` | A two-step studio — articulate your product taste, then test your instincts against benchmarked friction cases. Also hosts PM Interview Practice. |
| **✨ Idea Validator** | `/validator` | A one-question-at-a-time interview that turns a rough idea into a hypothesis summary plus a paste-ready Claude Code build prompt. |

---

## 🧠 Career EQ Coach

The home surface. A single chat composer that detects intent from what you type (or what chip you tap) and routes you down one of five growth pillars. Every pillar runs as a guided chat — one focused turn at a time — and writes back into your profile.

### Routing pillars

| Pillar | Emoji | What it's for |
|--------|-------|---------------|
| **Emotional IQ** | 🧠 | Journal a work moment. AI detects the emotion, intensity, event type, and triggers; you review/edit before it lands in your reflections feed. Follow-up questions go deeper without being generic. |
| **Product Taste** | 🧪 | Pick a product, answer six open questions in chat, and get a scored evaluation (V1 evaluator with per-question scores, verdict, strengths/weaknesses, and coaching). Saves to your Product Career profile. |
| **AI & Tech Edge** | 🤖 | Sets your product focus and target skills, then generates a personalized AI/tech action plan using the rule-based Actions engine. |
| **Decision Log** | ⚖️ | Walks a decision: what needs deciding by when, options + trade-offs, a structured brief, then a resolution capture. |
| **PM Assist** | 🛠️ | Drafts work artifacts — competitive snapshot, PRD section, user-feedback synthesis, opportunity brief, stakeholder email — grounded in your reflections and exercises. |

### What the Coach also surfaces on the home page

- **Growth pillar control plane** — Three editable targets (product direction, coworker/EI fit, career/skill direction) persisted to `localStorage` and used to ground every prompt the Coach sends.
- **Streak + reflection stats** — Counts of approved reflections and last logged emotion, with nudges when more than 6 days have passed.
- **LinkedIn post generator** — Synthesizes your reflections and taste exercises into one of six post types: emotionally reflective, product-sharp, mixed, perf-review bullets, salary brief, or bio.
- **Work Mode check-in** — A daily one-tap chip (`Mostly strategic`, `Mostly reactive`, `Balanced`, `In survival mode`) that feeds back into the Actions engine.
- **Prefill handoff** — Accepts `?prefill=` in the URL so the Idea Validator can hand a draft reflection straight into the journal.

---

## 🧪 Product Career

A dedicated studio for building product intelligence. Three exercise types share one progress profile.

### Step 1 — Product Taste Analysis

A six-question conversation with an AI companion (`/product` → "Start Exploring"). The questions are:

1. Your honest take on the product
2. What you would build better if you were on the team
3. What you'd do differently — for which specific user segment
4. Why you think the current team made the decisions they did
5. The market patterns / data signals that shaped those decisions
6. A 60-second pitch for your proposed improvement

Answers are evaluated by the **V1 Taste Evaluator** (`/api/evaluate-taste`), which returns:

- **Overall score** (0–5) and a **verdict** mapped to a friendlier label: *Just Starting → Developing → Growing → Confident → Thriving*
- **Per-question scores** (q1–q6) with color-coded chips
- **Detailed reasoning**, **strengths**, **weaknesses**, and **coaching to improve**
- If the evaluator key isn't configured, the page falls back to a legacy free-text analysis (`callClaudeMessages`) so the exercise still completes.

Each completed exercise persists to the user's profile and feeds the **Taste Trajectory** visualization on Insights.

### Step 2 — Friction Cases

Anonymized friction scenarios (e.g. Spotify's free tier friction, Notion's onboarding drop-off). For each case the user picks the root issue and recommends a fix. Submissions are scored **0 / 0.5 / 1** against benchmarked outcomes and stored in `InsightStore`.

Friction Cases feed the **Influence** page:

- **Insight Credibility Score** (0–100) is computed from exercise count, average accuracy, theme coverage, and recency.
- **Expert tags** unlock when a theme (Pricing, UX, Onboarding, Value Prop, Trust) reaches ≥60% accuracy.
- Mixed-version evaluation histories are aggregated using **Policy A** — scores across rubric/graph versions are combined into one signal, with the version labelled in the UI (see `docs/integrations/evaluation-provenance.md`).

### PM Interview Practice

150 real PM interview questions across **Product Sense**, **Analytical Thinking**, and **Behavioral** categories. Secondary card on the Product Career landing page.

### The bridge

After every taste analysis, the page nudges you to "Step 2: Test your instincts" with a Friction Case. The two exercises are designed as a loop: articulate your perspective → diagnose against benchmarked analysis → tighten your model.

---

## ✨ Idea Validator

A standalone tool that converts a rough product idea into a testable hypothesis and a paste-ready build prompt for a coding agent (Claude Code or similar). **No auth required.**

### How a session runs

1. **Pick a mode** at session start:
   - **Quick prototype** *(default)* — smallest possible testable thing, sized for a coding agent to ship in one or two iterations. Validation can be informal (LinkedIn post, Reddit thread, 5 friends, Product .Club).
   - **Strategic bet** — real investment with stakeholders or budget on the line. More rigor on persona + validation plan, a more substantial first cut (auth/db only if the hypothesis requires them).
2. **Chat interview** — One focused question per turn. The assistant gathers four areas in roughly five to seven user messages:
   - Pain + who feels it
   - Current workaround + why it falls short
   - Proposed solution sketch
   - Who they could test with
   Behind the scenes the assistant emits a hidden `<<<AREAS_COVERED:…>>>` status tag on every turn; the server strips it before display and uses it to drive a per-area progress indicator.
3. **Generate Build Prompt** — Always clickable. If the four areas aren't yet covered, the generator picks the most defensible interpretation from the chat and flags each inference with a literal `Assumption:` prefix so nothing hides.
4. **Output document** — A single markdown doc, split on a horizontal rule into:
   - **Hypothesis** tab — framing (hypothesis sentence, target user, what we're testing, validation plan, risks).
   - **Build Prompt** tab — directive, concrete brief for a coding agent: build context, what to build, what NOT to build, tech stack, mock data shape, UI requirements, acceptance criteria, out-of-scope.
   Two copy buttons: **Copy full document** and **Copy Build Prompt only** (just the section below the rule, for pasting straight into a coding agent). A **Download .md** button and a **Regenerate** that re-runs against the same chat history are also exposed.

### Product .Club is always one of the channels

Whenever validation channels come up — in the interview or in the generated document — the system recommends [Product .Club](https://www.linkedin.com/company/theproductgrowthclub) (a LinkedIn community connecting product builders with testers) alongside one or two other channels tailored to the user's situation. It is never pushed as the only option.

### "What happened?" feedback capture

Once a build prompt is generated, an **OutcomePanel** invites the builder to log what happened: *Did you test it?* (`Yes / In progress / No`), *What did you learn?*, *Did the hypothesis hold?* (`Held / Partly / Broke / Inconclusive`), and an optional *Next step*. Outcomes show as colored badges on the session list:

- 🟢 Held · 🟡 Partly · 🔴 Broke · ⚪ Inconclusive

After ~7 days without an outcome, the index page surfaces a dismissible **"What happened?"** nudge listing up to 5 older sessions, so taste compounds instead of evaporating.

### Routes & API surface

```
/validator               # session index + "what happened" nudge
/validator/new           # new interview
/validator/:sessionId    # session detail (Build Prompt / Hypothesis / chat / outcome)
```

A single server endpoint — `POST /api/validator` — handles every operation, discriminated by `op`: `chat`, `generate`, `list`, `get`, `delete`. Sessions, messages, and outcomes persist in Supabase Postgres with RLS enforced per user.

---

## Other Surfaces

| Page | Route | Purpose |
|------|-------|---------|
| **Signals** | `/signals` | Friction signals by theme with accuracy bars and a submission feed. |
| **Influence** | `/influence` | Insight Credibility Score, expert tags, reputation trajectory. |
| **Actions** | `/actions` | Rule-based next-step recommendations from your `InsightProfile`. |
| **Insights** | `/insights` | Exercise log, theme performance, reflections, Taste Trajectory. |
| **Growth** | `/growth` | Development control plane — Product Direction, Thinking Context, Career Focus, structured goals and actions. |
| **Public Profile** | `/p/:slug` | Shareable, verified public profile (no auth required). |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| Routing | React Router 7 (Idea Validator pages are lazy-loaded) |
| Animation | Motion (Framer Motion) |
| Charts | Recharts |
| Icons | Lucide React |
| Styling | Tailwind CSS 4 |
| State | React Context + `localStorage` (exercises, signals, reflections, control plane) |
| Auth | Supabase (the rest of the app is local-first; Validator is auth-optional) |
| Persistence | `localStorage` for exercises/profile/reflections; **Supabase Postgres** for Validator sessions, messages, and outcomes (RLS-enforced) |
| Local DB | Dexie (IndexedDB) for offline/encryption layer |
| Validation | Zod |
| AI | Anthropic Claude API (server functions: `/api/validator`, `/api/evaluate-taste`, `/api/pm-graph/evaluate-friction-case`, `/api/claude`) |
| Analytics | Vercel Analytics + custom validator analytics events |
| Deploy | Vercel |

---

## Local Development

```bash
npm install
npm run dev
```

Create a `.env` file with:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_ANTHROPIC_API_KEY=...
```

```bash
npm run build       # production build (tsc -b && vite build)
npm run typecheck   # TypeScript check without emit
npm run lint        # ESLint
npm test            # vitest run
npm run test:watch  # vitest watch mode
```

---

## Data Architecture

| Store | Where | Contents |
|-------|-------|----------|
| `InsightStore` | localStorage | Friction Case submissions — theme, score, root/fix correctness |
| `AppContext` | localStorage | Product Taste exercises, reflections, emotions, events, user profile |
| `FeedbackStore` | localStorage | Influence/reputation events from the feedback system |
| `BenchmarkStore` | localStorage | Benchmarked outcomes used to score friction cases |
| Validator | **Supabase Postgres** | Sessions, messages, generated docs, outcomes (RLS per user) |
| Public profiles | Supabase | Shareable `/p/:slug` profiles |

`InsightStore.getProfile()` returns the `InsightProfile` — the single source of truth for Signals, Actions, and Insights pages.

---

## Project Structure

```
src/
├── pages/
│   ├── HomePage.tsx                # 🧠 Career EQ Coach — routing + 5 pillars
│   ├── ProductTastePage.tsx        # 🧪 Product Career — Taste · Friction · PM Interview
│   ├── ValidatorIndexPage.tsx      # ✨ Idea Validator — sessions + "What happened?" nudge
│   ├── ValidatorNewPage.tsx        # Validator interview
│   ├── ValidatorSessionPage.tsx    # Build Prompt / Hypothesis / Outcome
│   ├── SignalsPage.tsx · InfluencePage.tsx · ActionsPage.tsx
│   ├── InsightsPage.tsx · GrowthPage.tsx · AccountPage.tsx
│   ├── PublicProfilePage.tsx · TransparencyHubPage.tsx · UsageDashboardPage.tsx
├── components/
│   ├── common/                     # FlowJourney, Card, Button, Modal, etc.
│   ├── product/                    # FrictionCaseExercise, PmInterviewExercise
│   ├── validator/                  # ChatBubble, Markdown, ModeToggle, OutcomePanel
│   ├── feedback/ · goals/ · layout/ · onboarding/ · profile/ · emotions/
├── services/
│   ├── claudeApi.ts                # Anthropic client (callClaudeMessages, parseActionResponse)
│   ├── productTasteEvaluatorApi.ts # V1 Taste Evaluator client
│   ├── tasteExercisePromptBuilder.ts
│   ├── validatorClient.ts          # POST /api/validator wrapper + outcome helpers
│   ├── validatorPrompts.ts         # System prompt, AREAS_COVERED tag, readiness gate
│   ├── validatorAnalytics.ts       # Tracking events for Validator funnel
│   ├── coachPromptBuilder.ts · journalPromptBuilder.ts · promptBuilder.ts
│   ├── publicProfileSync.ts · supabaseSync.ts · memoryManager.ts · migrationService.ts
├── lib/
│   ├── InsightStore.ts             # Friction Case submissions + profile
│   ├── FeedbackStore.ts            # Influence/reputation events
│   ├── BenchmarkStore.ts · credibilityEngine.ts · publicProfile.ts
├── data/frictionCases.ts           # Case bank + theme metadata
├── context/                        # AppContext, AuthContext
api/
├── validator.ts                    # Single function — op: chat | generate | list | get | delete
├── evaluate-taste.ts               # V1 Taste Evaluator
├── pm-graph/evaluate-friction-case.ts
├── public-profile/[slug].ts
├── claude.ts · _evaluatorCore.ts
supabase/migrations/                # validator + public_profiles schema
docs/integrations/                  # evaluation-provenance.md, pm-graph notes
```

---

## Philosophy

Product intuition is a **trainable skill**, not a personality trait. Hello-EQ builds three loops that compound:

1. **Career EQ Coach** — Engage with real work moments and real products critically; the Coach routes you to the right pillar.
2. **Product Career** — Diagnose what's broken and why; score your diagnosis against benchmarked analysis; close the gaps.
3. **Idea Validator** — Turn a rough hypothesis into the smallest testable thing; ship it; log what happened. Taste compounds when outcomes are captured, not when they're forgotten.

Signals in Hello-EQ come from **what you write and analyze** — not from passive behavioral tracking.

---

## Author

**Arunima Sharma**
PM at Protegrity · Founder of Hello-EQ
[LinkedIn](https://www.linkedin.com/in/arunimasharma/) · [hello-eq.club](https://hello-eq.club)

---

Built with [Claude Code](https://claude.ai/claude-code).
