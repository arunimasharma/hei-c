# Product Taste Evaluator — Manual Test Cases

Run these via `vercel dev` with `ANTHROPIC_EVALUATOR_API_KEY` set.
Each case documents the exact answers to submit and what to verify.

---

## TC-01 — Exceptional reasoning across all 6 questions
**Product:** Linear
**Goal:** Verify a high-quality, specific, tradeoff-aware response scores 4–5 overall and triggers the "Strong" or "Exceptional" verdict.

| Q | Answer |
|---|--------|
| Q1 | Linear is excellent for software teams that have already internalized agile. It wins on speed, keyboard-first UX, and opinionated workflow design — but it's deliberately not for everyone. It excludes non-technical stakeholders by design, which is a real tradeoff. I like it, but I wouldn't recommend it to a mixed product-engineering-marketing org without a plan for how non-eng people track work. |
| Q2 | The biggest gap is cross-functional visibility without forcing non-technical collaborators into Linear's mental model. I'd invest in a lightweight "viewer" mode — not issue management, just roadmap and progress context — so PMs can share status with execs without exporting to slides. The core product shouldn't change; this would be additive. |
| Q3 | I'd build a dedicated "stakeholder layer" — read-only by default, timeline-first, zero issue-management noise. The segment is mid-size engineering orgs (50–200 eng) where the CTO uses Linear daily but the CPO still lives in Notion or slides. Short term: reduces the PM tax of re-explaining sprint status. Long term: expands Linear's seat count into non-eng roles, improving retention and ACV without diluting the core dev experience. |
| Q4 | Linear's founders came from Coinbase and had strong opinions about what made Jira bad — complexity, slow UX, feature bloat for enterprise. Their early decisions optimized for developer love and word-of-mouth. They probably had data showing that teams who onboarded eng-first had far better retention, so they kept the surface area tight. Stakeholder tooling would have risked muddying that product identity early. |
| Q5 | Bottom-up SaaS adoption data almost certainly showed that individual devs and small teams were the growth engine — not top-down enterprise deals. PLG motion meant keeping the product sharp and dev-loved was the priority. They likely also saw Jira's NPS crater and used that as a forcing function: "don't become Jira" is as much a product principle as a competitive signal. |
| Q6 | Here's the pitch: mid-size engineering orgs — 50 to 200 engineers — are stuck paying a hidden PM tax. Every sprint, someone exports Linear tickets into slides or Notion docs just so a CPO or exec can understand what the team is doing. That's not a communication problem; it's a product gap. Linear stops at the engineering team's desk. My proposal is a stakeholder layer — read-only, timeline-first, zero issue-management noise — that lets non-technical stakeholders see what engineering is building without ever touching Linear's core UI. The core product doesn't change. The dev experience doesn't dilute. But Linear earns seats in roles it currently doesn't reach, improving retention and ACV in orgs that already love it. This matters now because Linear is moving upmarket and enterprise buyers are asking for exactly this kind of cross-functional visibility. Every competitor that adds it first takes the deal. |

**Acceptance criteria:**
- `overall_score`: 4 or 5
- `verdict`: `"Strong"` or `"Exceptional"`
- All per-question scores ≥ 3, most ≥ 4
- `strengths` list is non-empty with specific observations (not generic praise)
- `weaknesses` list may be empty or contain minor gaps
- `coaching_to_improve` list should be short or empty
- Result card renders all sections cleanly with no layout breaks

---

## TC-02 — Solid reasoning with some gaps (mid-tier)
**Product:** Notion
**Goal:** Verify a thoughtful but inconsistently deep response scores 2–3 and gets "Emerging" or "Functional" verdict.

| Q | Answer |
|---|--------|
| Q1 | I like Notion a lot for personal use but find it overwhelming for team use. The flexibility is its best and worst feature — everything can be anything, which means nothing has a clear purpose by default. I use it daily but I've seen teams abandon it after 3 months because no one maintains the structure. |
| Q2 | Better defaults and templates that actually enforce structure instead of just suggesting it. Also the mobile app is noticeably slower than desktop. |
| Q3 | I'd focus on making Notion opinionated for a specific use case — say, product documentation for startups — rather than trying to be everything. Strip out 60% of the block types, pre-wire the information architecture, and market it as "Notion for product teams." The tradeoff is losing the power users who love the flexibility, but the gain is lower time-to-value and better retention for the mainstream segment that churns today. |
| Q4 | They probably saw huge breadth of use cases and tried to serve all of them. When your users are using your product in 50 different ways it's hard to say no to any feature request. Also they raised a lot of money at a high valuation, which creates pressure to grow TAM rather than focus. |
| Q5 | I think data showed users who built complex wikis early retained longer, so they optimized for power-user depth. But that might have been a correlation trap — maybe those users were just more engaged teams, not because of Notion specifically. |
| Q6 | The pitch: startups and small product teams spend more time setting up Notion than using it. The current product gives you infinite flexibility and zero guidance, which works for the 20% of users who love building systems and churns the other 80% within 3 months. My proposal is Notion for Product Teams — a pre-wired, opinionated workspace with 60% fewer block types, a fixed information architecture for roadmaps, specs, and decisions, and a forced setup flow that gets a team productive in under an hour. The specific segment is early-stage product teams (3–15 people) who need a shared brain but don't have a Notion admin. This matters now because Notion's churn problem is well-documented and Linear has shown that opinionated tools win developer love — the same logic applies to product teams. |

**Acceptance criteria:**
- `overall_score`: 2 or 3
- `verdict`: `"Emerging"` or `"Functional"`
- Q3 and Q1 scores higher (3–4) than Q2 and Q4 (1–2)
- `weaknesses` references the shallow Q2 answer ("mobile is slow" without depth) and Q4's vague fundraising logic
- `coaching_to_improve` contains actionable, specific feedback (not generic)
- Result card renders correctly

---

## TC-03 — All generic UX commentary, no strategy
**Product:** Spotify
**Goal:** Verify a response that is well-written but entirely surface-level scores 0–2 and triggers harsh but fair feedback.

| Q | Answer |
|---|--------|
| Q1 | Yes, I love Spotify. The UI is clean and it's really easy to find music. The recommendation algorithm is great and I like how it suggests new music based on what I listen to. The playlist feature is super useful. |
| Q2 | I would make the UI cleaner and more minimal. The home screen feels cluttered sometimes. I would also improve the search to make it faster and more intuitive. |
| Q3 | I would make it simpler and more focused on music discovery. Less clutter, better UX, and make it easier to find what you're looking for. Any user who wants a cleaner experience would benefit from this. |
| Q4 | Spotify probably added all these features because users asked for them. When you have millions of users everyone wants different things so it gets complicated. |
| Q5 | User data probably showed that people wanted more features so they kept adding them. Most companies do this when they get big. |
| Q6 | I think Spotify should make the app cleaner and easier to use. A lot of people want a simpler music experience and Spotify could be better. It would be great for music lovers who want to find music faster. The idea matters now because streaming is very competitive. |

**Acceptance criteria:**
- `overall_score`: 0 or 1
- `verdict`: `"Very Weak"`
- All per-question scores 0 or 1
- `weaknesses` explicitly calls out: vague UX commentary, no segmentation, no tradeoff thinking, no market reasoning
- `coaching_to_improve` contains at least 3 specific, substantive improvement suggestions
- `strengths` is empty or has a single charitable note at most
- `signals_of_strong_product_taste` is empty

---

## TC-04 — Overconfident, no supporting logic
**Product:** Twitter / X
**Goal:** Verify that confident, definitive-sounding answers with no real argument score low and are penalized for overconfidence.

| Q | Answer |
|---|--------|
| Q1 | Twitter is a fundamentally broken product that was ruined by bad management decisions. It used to be great but now it's terrible and everyone knows it. The algorithm is completely wrong and the product is dying. |
| Q2 | I would rebuild the algorithm from scratch. The current one is just bad. I would make it show you only what you actually want to see, not what an AI thinks you want. |
| Q3 | I would go back to chronological feed for everyone. This would be way better for every single user. Power users want it and casual users would understand it better. It's just obviously the right call. |
| Q4 | The leadership just made bad calls. They don't understand what users want and they're chasing engagement metrics instead of doing what's right. It's pure incompetence. |
| Q5 | Their data is all wrong because they're measuring the wrong things. Any company that measures engagement this way is going to make bad decisions. |
| Q6 | The pitch is simple: Twitter needs a chronological feed and everyone wants it. Any investor who uses Twitter for 5 minutes can see this is obviously the right move. Users are angry, engagement is down, and the fix is obvious. Just do it. It matters now because Twitter is losing users every day and this would fix it immediately. |

**Acceptance criteria:**
- `overall_score`: 0 or 1
- `verdict`: `"Very Weak"`
- `weaknesses` specifically flags: overconfidence without argument, no organizational empathy, no segmentation, no tradeoff awareness, unsupported market claims
- `coaching_to_improve` instructs user to provide evidence and consider constraints
- Q4 score especially low (0–1) for lack of organizational empathy

---

## TC-05 — Strong on some Qs, weak on others (uneven profile)
**Product:** Figma
**Goal:** Verify per-question scores vary meaningfully and `detailed_reasoning` calls out the asymmetry.

| Q | Answer |
|---|--------|
| Q1 | Figma changed design collaboration permanently. Before Figma, design handoff was a disaster — exporting assets, version mismatch, dev and design misaligned. Figma made the design file the source of truth for both design and engineering. That's the real product insight, not just "browser-based design tool." |
| Q2 | Better developer handoff tooling. Dev Mode is a step in the right direction but it's still a Figma-first experience that devs tolerate rather than love. I'd invest in an API and CLI that lets engineers pull design tokens, component specs, and assets directly into their workflow without opening Figma. |
| Q3 | I would make it better. |
| Q4 | Figma probably focused on designers first because that's where adoption starts. Makes sense for a PLG motion. |
| Q5 | I think market data showed designers were the buyers and evangelists, so they optimized for designer love. |
| Q6 | I think Figma should make a better developer experience. Engineers don't really love using it and there's probably an opportunity there. It could be good for dev teams. |

**Acceptance criteria:**
- Q1 score: 4–5
- Q2 score: 3–4
- Q3 score: 0 (placeholder answer)
- Q4 score: 2–3 (reasonable but shallow)
- Q5 score: 1–2 (plausible but generic)
- Q6 score: 0–1 (non-answer)
- `overall_score`: 2 or 3 (dragged down by Q3, Q5, Q6)
- `detailed_reasoning` contrasts Q1/Q2 depth with Q3/Q6 weakness
- `strengths` references Q1 and Q2 specifically
- `weaknesses` specifically calls out Q3 as placeholder

---

## TC-06 — Only Q1 answered, all others blank
**Product:** Slack
**Goal:** Verify graceful handling of mostly-empty answers — at least one answer present should not cause a server error, just a very low score.

| Q | Answer |
|---|--------|
| Q1 | Slack is good for real-time communication but bad for async work. It creates an always-on culture that hurts deep work. I use it but I wish my team had better norms around response time expectations. |
| Q2 | *(left blank)* |
| Q3 | *(left blank)* |
| Q4 | *(left blank)* |
| Q5 | *(left blank)* |
| Q6 | *(left blank)* |


**Acceptance criteria:**
- No 400/500 error — server accepts the payload (at least one answer present)
- `overall_score`: 0 or 1
- `verdict`: `"Very Weak"`
- Q1 score: 1–2 (partial credit for a reasonable but thin take)
- Q2–Q6 scores: 0 (not answered)
- `missing_signals` list is non-empty, flags Q2–Q6 as unanswered
- `coaching_to_improve` encourages the user to engage with all 6 questions
- Result card renders without any crashes or missing sections

---

## TC-07 — Gibberish / placeholder answers
**Product:** Airbnb
**Goal:** Verify the model gives 0 overall and the result card still renders cleanly.

| Q | Answer |
|---|--------|
| Q1 | asdfghjkl |
| Q2 | idk |
| Q3 | test test test |
| Q4 | yes |
| Q5 | no |
| Q6 | ??? |

**Acceptance criteria:**
- `overall_score`: 0
- `verdict`: `"Very Weak"`
- All per-question scores: 0
- `detailed_reasoning` notes that no meaningful product judgment was provided
- `strengths` and `signals_of_strong_product_taste` are empty arrays
- `coaching_to_improve` encourages genuine engagement
- Result card renders all sections with empty lists gracefully (no blank white boxes, no JS errors)
- **Critical:** the UI must not crash when all array fields are empty

---

## TC-08 — Non-English answers
**Product:** Duolingo
**Goal:** Verify the evaluator handles non-English input without a server error and attempts to score based on content.

| Q | Answer |
|---|--------|
| Q1 | Duolingo me parece una app bien diseñada para hábitos, pero superficial en pedagogía. Funciona para vocabulario básico pero no para fluidez real. |
| Q2 | Añadiría más contexto conversacional y menos gamificación vacía. Los logros no enseñan a hablar. |
| Q3 | Enfocaría en un segmento específico: adultos que viajan por trabajo y necesitan funcionalidad conversacional en 6 semanas, no gamers que quieren racha de 300 días. |
| Q4 | Duolingo probablemente tenía datos de retención que mostraban que la gamificación reduce churn, así que la optimizaron agresivamente aunque dañe el aprendizaje real. |
| Q5 | Los patrones de datos de consumidores probablemente mostraron que la retención a corto plazo y el DAU correlacionan con racha diaria, no con resultados de aprendizaje. |
| Q6 | El pitch: los adultos que viajan por trabajo necesitan funcionalidad conversacional en un idioma específico en 6 semanas, no una racha de 300 días. Duolingo los pierde porque el producto está diseñado para retención diaria, no para outcomes reales. Mi propuesta es un modo "viaje de negocios" — un plan de 6 semanas con sesiones de 15 minutos enfocadas en vocabulario conversacional práctico, sin gamificación, con simulaciones de situaciones reales como reuniones, aeropuertos y cenas. El segmento es profesionales B2B que pagarían por resultados medibles, no por streaks. Importa ahora porque el mercado de upskilling corporativo está creciendo y ningún producto de idiomas lo está sirviendo bien. |

**Acceptance criteria:**
- No 400/500 error — server processes the request
- `overall_score`: 3 or 4 (content is actually strong — segmentation, tradeoff awareness, clear customer segment and problem framing in Q6 pitch)
- Model evaluates the quality of reasoning, not the language
- Result card renders with whatever language the model responds in
- No crash or empty response

---

## TC-09 — Correct conclusion, weak reasoning (tests "judge reasoning, not correctness")
**Product:** Google+
**Goal:** Verify the evaluator penalizes shallow hindsight even when the conclusion (Google+ failed) is factually correct.

| Q | Answer |
|---|--------|
| Q1 | I didn't like it. It was obviously going to fail because Facebook already owned social networking. Google should have known better. |
| Q2 | They should have made it more like Facebook but better. Copied the features that worked and improved on them. |
| Q3 | I would have just not built it. The market was already taken. Any product person could have seen this coming. It was obviously too late. |
| Q4 | Google's leadership wanted to compete with Facebook because they were scared. They forced employees to use it which is never a good sign. |
| Q5 | The market data showed Facebook was dominant. Anyone looking at the numbers would have known this was a bad idea. |
| Q6 | Google should have built something better than Facebook. The problem is people want to connect with others online and Facebook does it poorly. Any product that did social better would win. Google had the resources so they should have just executed better. The idea obviously mattered — social media was huge — but they just didn't do it right. |

**Acceptance criteria:**
- `overall_score`: 1 or 2 despite correct conclusions
- `verdict`: `"Very Weak"` or `"Emerging"`
- `weaknesses` specifically references: shallow hindsight, no organizational empathy, no segmentation, no tradeoff analysis
- `detailed_reasoning` notes that conclusions may be correct but reasoning is not supported
- This test validates the evaluator's core principle: "judge reasoning quality, not whether the user is objectively correct"

---

## TC-10 — Strong market inference and organizational empathy (Q4/Q5/Q6 focus)
**Product:** Clubhouse
**Goal:** Verify that excellent Q4–Q6 reasoning scores those questions highly even with weaker Q1–Q3.

| Q | Answer |
|---|--------|
| Q1 | It was interesting and I used it for a few months in 2021. Felt like a live podcast you could stumble into. But the retention problem was obvious — there's no replay, no async fallback, and scheduling a room is friction. |
| Q2 | Better. I'd fix the scheduling problem somehow. |
| Q3 | I'd probably focus on live audio for specific verticals instead of general conversation. |
| Q4 | Clubhouse launched during COVID lockdowns when everyone was starved for serendipitous social interaction. The "drop-in audio" mechanic was a perfect fit for that moment. Leadership probably saw explosive early growth and interpreted it as product-market fit rather than context-market fit. By the time they realized the dynamic was COVID-specific, the growth had already plateaued and competitors had shipped audio rooms. The no-replay decision was likely a deliberate choice to create FOMO and urgency — reasonable theory, but it also made the product useless for anyone who couldn't tune in live. |
| Q5 | Early data almost certainly showed extremely high engagement from early adopters (VC Twitter, tech influencers) and misleadingly strong retention from the invite-only cohort. Invite-only creates a selection effect — you only get highly motivated early adopters who will use anything to feel exclusive. That cohort's behavior is unrepresentative of the mass market. By the time the invite gate dropped, the data-informed decisions were already made on a biased sample. |
| Q6 | Here's the pitch: live audio for general conversation is dead, but live audio for professional communities is untapped. The problem Clubhouse failed to solve is retention once the novelty wears off — there's no reason to return if you don't know what's on. My proposal is Clubhouse rebuilt as a vertical live audio platform for one specific community first — say, independent investors and founders — with scheduled programming, curated host credentials, and async replays for people who missed the live session. The customer segment is professional community builders who run paid communities on Slack or Substack and need a live layer. This matters now because that market is actively looking for a better product and Clubhouse's brand collapse left a clear vacuum. The async replay solves the retention problem directly: you come for the live, you stay for the archive. |

**Acceptance criteria:**
- Q4 score: 4–5
- Q5 score: 4–5
- Q6 score: 4–5
- Q2 and Q3 scores: 0–2 (weak answers)
- `overall_score`: 2–3 (dragged down by Q2/Q3 but lifted by Q4/Q5/Q6)
- `strengths` calls out Q4–Q6 reasoning specifically
- `detailed_reasoning` highlights the asymmetry between early and late questions
- Per-question score chips in the result card visually show the contrast (red for Q2/Q3, green for Q4–Q6)

---

## TC-11 — Maximum length answers (stress test)
**Product:** Amazon
**Goal:** Verify the endpoint handles near-max-length answers (server caps at 2000 chars each) without timing out or returning a malformed response.

*(Each answer is ~400 words / ~2000 characters — paste long substantive text for each Q)*

| Q | Answer |
|---|--------|
| Q1 | Amazon is one of the most complex products to evaluate because it is simultaneously a marketplace, a logistics company, a cloud infrastructure provider, an advertising network, and a media company — all bundled into a single consumer interface. As a shopping product specifically, I have a genuinely mixed take. The discovery experience is severely degraded compared to 10 years ago. Search results are dominated by sponsored listings and generic white-label goods, which makes finding high-quality products harder than it should be for the world's largest product catalog. I still use it constantly because the logistics infrastructure — Prime delivery, returns, reliability — is unmatched. But the front-end product experience has clearly been sacrificed to monetization. I can tell this is intentional and not accidental, which is what makes it interesting to analyze: a company technically capable of building exceptional UX choosing not to because the current tradeoff serves a different master. The search degradation is an advertising revenue optimization, not a product failure. That distinction matters a lot when you're evaluating it. |
| Q2 | The single highest-leverage improvement I would make is separating the discovery experience from the fulfillment experience. Today they are conflated — you discover, compare, and purchase in one surface, and that surface is increasingly optimized for ad revenue rather than discovery quality. I would create a distinct "product research" mode that shows zero sponsored results, ranks by verified review quality, and surfaces independent editorial reviews and comparison data. The tension here is obvious: this cannibalizes Amazon's highest-margin ad inventory. You'd need to either find alternative monetization for the research mode (perhaps a premium subscription) or accept short-term revenue dilution in exchange for trust and discovery quality long-term. I'd argue the long-term play is right because Amazon's real competitive moat isn't discovery — it's logistics. If people trust Amazon to find good products, they'll buy. The discovery quality degradation risks training users to go to TikTok, YouTube, or Reddit for research and only come to Amazon to purchase — which weakens Amazon's role in the purchase funnel and makes the ad inventory less valuable anyway. |
| Q3 | The segment I'd prioritize is high-intent, quality-conscious buyers — people purchasing in categories where quality variance is high and returns are painful: electronics, baby products, health supplements, kitchen appliances. These buyers currently distrust Amazon search and route through YouTube reviews, Reddit threads, or Wirecutter before returning to Amazon to purchase. This is a broken loop that Amazon could own entirely. The specific product change: a "verified quality" filter that combines return rate data, third-party lab testing partnerships, and curated seller certification. Short-term this would increase conversion for quality-conscious segments and reduce return costs. Long-term it would rebuild trust in search and potentially command a premium tier subscription. The tradeoff is it would disadvantage low-quality private label sellers that currently contribute significant GMV — so Amazon would need to believe the quality segment's LTV justifies the disruption to the quantity segment. I think it does, but it requires a multi-year commitment that quarterly earnings pressure makes hard. |
| Q4 | Amazon's leadership made a deliberate choice to monetize search placement as advertising inventory. This wasn't a product failure — it was a rational business decision made by a company that had built the most efficient logistics network in the world and needed to find a way to monetize the transaction surface beyond thin retail margins. AWS funds everything but retail is where user relationship is captured. Advertising on search was the highest-margin lever available. The people making this decision were not ignorant of the UX degradation — they were choosing revenue over discovery quality with full awareness. The organizational pressure came from the advertising division's growth targets, which are now a significant portion of Amazon's revenue mix. Once ad revenue becomes material to total company revenue, the product org's ability to prioritize discovery quality over ad placement becomes severely constrained. This is a classic case of revenue organizational structure shaping product decisions in ways the original product vision wouldn't have anticipated. |
| Q5 | The data patterns that shaped these decisions almost certainly include: conversion rate by placement position (showing that sponsored placements convert nearly as well as organic), customer return-to-Amazon rate after purchases (still high, suggesting discovery quality degradation hasn't yet driven users away at scale), advertising revenue CAGR vs. retail revenue CAGR (advertising growing faster, creating internal incentive misalignment), and customer price sensitivity data (showing that a significant portion of Amazon buyers optimize for price over quality, making the white-label/generic product flood rational for that segment). The missing data they likely don't measure well: long-term category abandonment (users who stop buying a category on Amazon because they've lost trust in search results), and external research routing (the percentage of high-intent purchasers who now research off-Amazon before completing the purchase). If those numbers are large, the ad-revenue-for-discovery-quality tradeoff looks much worse in the long run. |
| Q6 | Here's the 60-second pitch: Amazon is losing its most valuable customers — high-intent, quality-conscious buyers in categories like electronics, baby products, and kitchen appliances — to a three-step research loop: they Google the category, read Wirecutter or Reddit, then return to Amazon to purchase. Amazon is earning the transaction but ceding the discovery relationship. My proposal is a Verified Quality tier in Amazon search — a filter combining return rate data, third-party lab testing partnerships, and seller certification — that shows zero sponsored placements and ranks by quality signal, not bid price. The specific segment is households spending over $2,000 annually on Amazon in high-return-rate categories. These are Amazon's highest-LTV customers and they're the most likely to abandon the platform as trust in search erodes. Short term, a Verified Quality filter increases conversion for this segment and reduces return costs — which are already a $20B+ annual problem. Long term, it rebuilds Amazon's position as a trusted discovery layer, not just a checkout page, and makes the ad inventory more valuable because users trust the context around it. This matters now because TikTok Shop and YouTube Shopping are actively competing for the discovery relationship. Every month Amazon delays is a month those platforms entrench. The right frame for a product leader or investor: this is not a feature, it's a strategic bet on whether Amazon remains the place where purchase decisions are made, or becomes the place where purchase decisions are merely executed. |

**Acceptance criteria:**
- Request completes without 502 timeout (Vercel function timeout is 10s by default — this tests whether the evaluator model responds in time)
- `overall_score`: 4 or 5 (content is genuinely strong)
- `verdict`: `"Strong"` or `"Exceptional"`
- All per-question scores ≥ 3
- Response JSON is valid and complete — no truncation
- Result card renders all sections cleanly; long `detailed_reasoning` text wraps correctly without overflowing the card

---

## Summary Table

| TC | Product | Expected Score | Expected Verdict | Primary Signal Being Tested |
|----|---------|---------------|-------------------|-----------------------------|
| 01 | Linear | 4–5 | Strong / Exceptional | Happy path — full quality |
| 02 | Notion | 2–3 | Emerging / Functional | Mid-tier with gaps |
| 03 | Spotify | 0–1 | Very Weak | Generic UX commentary penalized |
| 04 | Twitter/X | 0–1 | Very Weak | Overconfidence without logic penalized |
| 05 | Figma | 2–3 | Emerging / Functional | Uneven per-question profile |
| 06 | Slack | 0–1 | Very Weak | Mostly blank — graceful handling |
| 07 | Airbnb | 0 | Very Weak | Gibberish — no crash, no error |
| 08 | Duolingo | 3–4 | Functional / Strong | Non-English input handled |
| 09 | Google+ | 1–2 | Very Weak | Correct conclusion, weak reasoning |
| 10 | Clubhouse | 2–3 | Emerging / Functional | Asymmetric Q4–Q6 strength |
| 11 | Amazon | 4–5 | Strong / Exceptional | Max-length stress test |
