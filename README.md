# Hello-EQ

**Turn real-world product experiences into structured insights that sharpen product thinking.**

Hello-EQ is a product thinking coach for PMs and aspiring product managers. It guides you through a deliberate practice loop: reflect on products you use, diagnose friction cases, build a credibility signal, and get targeted recommendations for where to go deeper.

Live app → [hello-eq.club](https://hello-eq.club)

---

## The 5-Step Journey

```
🧠 Coach  →  📡 Signals  →  🧪 Product  →  ⚡ Influence  →  💡 Actions
```

| Step | What happens |
|------|-------------|
| **Coach** | Reflect on product experiences and start exercises |
| **Signals** | See friction patterns you've identified through exercises |
| **Product** | Diagnose real-world friction cases to build analytical credibility |
| **Influence** | Track your Insight Credibility Score and reputation |
| **Actions** | Get rule-based next steps based on your exercise signals |

---

## Features

### 🧪 Friction Case Exercises
Multiple-choice diagnostic exercises built around real product scenarios (e.g. Spotify's free tier friction, Notion's onboarding drop-off). You identify the root issue and recommend a fix. Each submission is scored 0 / 0.5 / 1 based on accuracy. Results accumulate into your **Insight Credibility Score** and theme-level accuracy profile.

### 🎯 Product Taste Exercises
Free-text exercises where you evaluate a real product you use. Describe friction you've noticed — onboarding, pricing, trust, UX — and your responses are evaluated by AI for depth and specificity. Results feed into your friction signal profile.

### 📡 Friction Signals
Signals come from what you write and analyze — not behavioral tracking. View your signals by theme (Pricing, UX, Onboarding, Value Prop, Trust) with accuracy progress bars and a timestamped feed of your exercise submissions.

### ⚡ Influence & Credibility Score
Your Insight Credibility Score (0–100) is computed from exercise count, average accuracy, theme coverage, and recency. Expert tags unlock when you reach high accuracy in a specific domain. The Influence page displays your reputation and score trajectory.

### 💡 Recommended Actions
Fully rule-based recommendations derived from your InsightProfile. Rules fire on: no exercises yet, low case count, low accuracy, narrow theme coverage, single-theme over-indexing, expert tag unlocked, or high volume depth. Deterministic and explainable.

### 📊 Product Insights
A personal dashboard with three tabs:
- **Overview** — Exercises done, avg accuracy, themes explored, credibility score, latest exercise card, theme performance bars
- **Exercise Log** — Friction case history with scores, Product Taste exercise list
- **Reflections** — Product journal entries and key decisions log

### ✨ Idea Validator
A standalone tool (separate from the 5-step journey) that turns a rough product idea into a hypothesis summary and a paste-ready build prompt for a coding agent (Claude Code or similar). The AI interviewer collaborates — one focused question per turn — and aims to gather four areas (pain + who feels it; current workaround + why it falls short; proposed solution sketch; who they could test with) in roughly five to seven user messages.

A mode toggle adapts the interviewer:

- **Quick prototype** *(default)* — smallest possible testable thing, sized for a coding agent to ship in one or two iterations. Informal validation channels welcome.
- **Strategic bet** — real product investment with stakeholders or budget on the line. More rigor on the validation plan and a more substantial first cut.

Whenever validation channels come up, the system always recommends [Product .Club](https://www.linkedin.com/company/theproductgrowthclub) — a LinkedIn community connecting product builders with testers — alongside one or two other channels tailored to the user's situation.

The "Generate Build Prompt" button is always clickable. If the four areas aren't yet covered, the user can still generate; gaps are flagged as assumptions in the output. Sessions persist in Supabase Postgres (auth-required; RLS-enforced). The generated document has a "Copy full document" button and a separate "Copy Build Prompt only" button (just the section below the horizontal rule) for users who want to paste straight into a coding agent.

Routes: `/validator`, `/validator/new`, `/validator/:sessionId`. Server endpoint: `POST /api/validator` (single function, discriminated by `op`: `chat`, `generate`, `list`, `get`, `delete`).

### 📈 Development
A control plane for steering your practice:
- **Product Direction** — What product areas you're focused on
- **Thinking Context** — Engineering constraints or collaboration context to shape prompts
- **Career Focus** — Where you're headed professionally

The AI (Claude API) synthesizes your reflections and exercises to generate a **Work Profile** — including a product profile, coworker compatibility profile, and suggested automation projects. Includes structured goals and actions tracking.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| Routing | React Router 7 |
| Animation | Motion (Framer Motion) |
| Charts | Recharts |
| Icons | Lucide React |
| Styling | Tailwind CSS 4 |
| Auth | Supabase |
| Persistence | localStorage (exercises, signals, profile) |
| AI | Anthropic Claude API |
| Analytics | Vercel Analytics |
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
npm run build       # production build
npm run typecheck   # TypeScript check without emit
npm run lint        # ESLint
```

---

## Data Architecture

All user exercise data is stored in **localStorage** — no server-side user data. Supabase handles authentication only.

| Store | Contents |
|-------|----------|
| `InsightStore` | Friction Case submissions — theme, score, root/fix correctness |
| `AppContext` | Product Taste exercises, reflections, user profile |
| `FeedbackStore` | Influence/reputation events from the feedback system |

`InsightStore.getProfile()` returns your `InsightProfile` — the single source of truth for Signals, Actions, and Insights pages.

---

## Project Structure

```
src/
├── pages/
│   ├── HomePage.tsx           # Coach — reflections + exercise entry
│   ├── SignalsPage.tsx         # Friction signals from exercises
│   ├── ProductTastePage.tsx    # Friction Case + Product Taste exercises
│   ├── InfluencePage.tsx       # Credibility score + reputation
│   ├── ActionsPage.tsx         # Rule-based recommendations
│   ├── InsightsPage.tsx        # Exercise log + theme performance
│   └── GrowthPage.tsx          # Development control plane + goals
├── components/
│   ├── common/FlowJourney.tsx  # 5-step nav component
│   ├── feedback/               # Influence panel
│   ├── layout/                 # Header, DashboardLayout
│   └── product/                # FrictionCaseExercise
├── lib/
│   ├── InsightStore.ts         # Friction Case submissions + profile
│   └── FeedbackStore.ts        # Influence/reputation events
├── data/
│   └── frictionCases.ts        # Case bank + theme metadata
└── context/
    ├── AppContext.tsx
    └── AuthContext.tsx
```

---

## Philosophy

Product intuition is a **trainable skill**, not a personality trait. Hello-EQ creates a deliberate practice loop:

1. **Engage** with real products critically
2. **Diagnose** what's broken and why — not just "this feels off"
3. **Score** your diagnosis against expert analysis
4. **Track** where your thinking is sharp and where it has gaps
5. **Act** on specific, prioritized exercises to close those gaps

Signals in Hello-EQ come from **what you write and analyze** — not from passive behavioral tracking.

---

## Author

**Arunima Sharma**
PM at Protegrity · Founder of Hello-EQ
[LinkedIn](https://www.linkedin.com/in/arunimasharma/) · [hello-eq.club](https://hello-eq.club)

---

Built with [Claude Code](https://claude.ai/claude-code).
