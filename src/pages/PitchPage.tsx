import { Link } from 'react-router';
import { type ReactNode } from 'react';
import {
  Repeat, Target, Users, MapPin, BadgeCheck, Network, Wand2,
  ArrowRight, Sparkles, TrendingUp, Quote, FileText, Share2,
  ListChecks, Layers, Lightbulb, Beaker,
} from 'lucide-react';

// ── Investor pitch page (/pitch) ──
// The narrative an investor reads, with live links into the working prototype so
// they can click the product, not just read about it. Standalone (no app chrome)
// so it reads as a deck/landing, not a logged-in tool.

const TEAL = '#0D9488';
const TEAL_DARK = '#0B7A70';
const INK = '#0F172A';

export default function PitchPage() {
  return (
    <div style={{ fontFamily: 'inherit', color: '#1F2937', backgroundColor: 'white' }}>
      {/* ── Hero ── */}
      <section style={{ background: `linear-gradient(160deg, ${INK} 0%, #14243B 60%, ${TEAL_DARK} 140%)`, color: 'white', padding: '5rem 1.5rem 4.5rem' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(94,234,212,0.12)', color: '#5EEAD4', padding: '0.4rem 0.85rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700, marginBottom: '1.5rem' }}>
            <Repeat size={14} /> Drilloop · Seed pitch
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 1.25rem' }}>
            When AI knows everything,<br />the scarce thing is proving <span style={{ color: '#5EEAD4' }}>you</span> can think.
          </h1>
          <p style={{ fontSize: 'clamp(1rem, 2.2vw, 1.25rem)', lineHeight: 1.55, color: 'rgba(255,255,255,0.82)', maxWidth: 720, margin: '0 0 2rem' }}>
            Drilloop turns a trusted expert’s knowledge into daily judgment drills — AI-graded, peer-mirrored, and credentialed — inside a small community that meets online and in person. Built for the 2,000-follower expert everyone else ignores, and the audience done wasting its evenings on the feed. <strong style={{ color: 'white' }}>Both sides of the marketplace are built and clickable today.</strong>
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/drilloop" style={ctaPrimary}>
              <Sparkles size={17} /> Try the member demo <ArrowRight size={16} />
            </Link>
            <Link to="/drilloop/creator" style={ctaGhost}>
              <Wand2 size={16} /> Open the Creator Studio
            </Link>
          </div>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '3rem' }}>
            <HeroStat value="1 prompt" label="away from any answer — so knowing is worthless" />
            <HeroStat value="2,000" label="followers is enough — we serve the long tail" />
            <HeroStat value="15 min" label="a finite session that beats the infinite feed" />
          </div>
        </div>
      </section>

      {/* ── The shift ── */}
      <Section eyebrow="The shift" title="AI didn’t kill learning products. It changed what they’re for.">
        <p style={lede}>
          Information became infinite and free, which quietly destroyed the value of merely knowing things. Courses, newsletters, explainer threads — the whole “here’s information” market is collapsing. What got <em>scarcer</em> are the three things a model can’t hand you:
        </p>
        <div style={grid3}>
          <ValueCard icon={<BadgeCheck size={22} />} title="Demonstrated judgment" body="Proof that you can reason — not that a model can. Tested against a respected rubric, not vibes." />
          <ValueCard icon={<TrendingUp size={22} />} title="A trusted credential" body="A record the market believes because a model can’t fake having done the reps." />
          <ValueCard icon={<Users size={22} />} title="Real social capital" body="A community and network that vouches for you — formed online, deepened in person." />
        </div>
      </Section>

      {/* ── Problem ── */}
      <Section eyebrow="The problem" title="Two underserved people, one broken market." dark>
        <div style={grid3}>
          <ProblemCard n="01" title="The sub-scale expert" body="Deep expertise, ~2,000 high-trust followers — and every tool (courses, paid newsletters, communities) is built for the top 1%. Pour 200k followers in the top, monetize a sliver. The credible-but-small expert monetizes nothing and watches bigger accounts repackage their ideas." />
          <ProblemCard n="02" title="The exhausted audience" body="Following 40 experts, absorbing 40 hot takes a day, improving at nothing. They want their leisure hours to make them better — and they know doomscrolling isn’t it." />
          <ProblemCard n="03" title="The AI flood" body="Now anyone can sound expert because a model wrote it. The signal that someone can actually reason has never been harder to find — or more valuable." />
        </div>
      </Section>

      {/* ── Demand side — member experience (with deep links) ── */}
      <Section eyebrow="The product · demand side" title="A better place to spend the hour you’d lose to the feed." id="product">
        <p style={lede}>
          The drill is the atom — a judgment question you answer in your own words or as an AI-built multiple choice, graded against the expert’s rubric. <strong>Every drill is free and grouped into topics you pick from</strong> — no paywall, no forced path. Each card links straight to that exact screen in the live prototype.
        </p>
        <div style={featureGrid}>
          <FeatureCard icon={<Layers size={20} />} title="Pick a topic, all free" to="/drilloop?view=topics" cta="Browse topics"
            body="Drills are grouped into topics you choose from and drill in any order — every one free. Self-directed, not a linear course you abandon at lesson three." />
          <FeatureCard icon={<Target size={20} />} title="AI grading + reference" to="/drilloop?view=today" cta="Drill a sample"
            body="Answer in your own words and get scored 0–100 with coaching and the expert’s reference answer — a live Claude call, with a graceful offline fallback." />
          <FeatureCard icon={<ListChecks size={20} />} title="AI multiple-choice mode" to="/drilloop?view=topics" cta="Try a drill"
            body="One tap turns any drill into an AI-generated multiple choice — one right answer, three smart distractors, and reasoning guidance comparing your pick to the best one." />
          <FeatureCard icon={<Users size={20} />} title="Mirror — peer reasoning" to="/drilloop?view=today" cta="Answer a drill to unlock"
            body="See how sharp peers reasoned on the same question — anonymized, unlocked only after you commit. The feed replaced by substance." />
          <FeatureCard icon={<Lightbulb size={20} />} title="Request more drills" to="/drilloop?view=topics" cta="Open a topic"
            body="Members ask for drills on the exact sub-topic or scenario they want — a one-line demand signal that routes straight to the creator’s backlog." />
          <FeatureCard icon={<Users size={20} />} title="Drill Rooms" to="/drilloop?view=community" cta="See the Community tab"
            body="A small synchronized cohort moving together this week — presence and accountability, minus the performance." />
          <FeatureCard icon={<MapPin size={20} />} title="Local Chapters" to="/drilloop?view=community" cta="See the Community tab"
            body="When members cluster in a city, a chapter forms and meets in person. The deeply human good a model can never offer." />
          <FeatureCard icon={<BadgeCheck size={20} />} title="Proof of Judgment" to="/drilloop?view=progress" cta="See the Progress tab"
            body="A portable, verifiable credential of your tested judgment — the résumé line that survives AI." />
          <FeatureCard icon={<Network size={20} />} title="Reasoning-based network" to="/drilloop?view=connect" cta="See the Connect tab"
            body="1:1 matches by how you think and what you’re working toward — accept, meet, log the outcome. Backed by a real Postgres matching engine." />
        </div>
      </Section>

      {/* ── Supply side — the creator studio is built (with deep links) ── */}
      <Section eyebrow="The product · supply side" title="Onboarding creators isn’t a roadmap. It’s shipped." dark>
        <p style={{ ...lede, color: 'rgba(255,255,255,0.82)' }}>
          A two-sided marketplace lives or dies on supply, and supply dies on effort. So the creator side is a real <strong style={{ color: 'white' }}>AI content engine</strong>: a small expert turns rough notes into a finished, structured program in minutes. Every AI feature is a <strong style={{ color: 'white' }}>live Claude call — verified end-to-end, not a canned demo</strong>. Click any card to drive the real Creator Studio.
        </p>
        <div style={featureGrid}>
          <FeatureCard dark icon={<FileText size={20} />} title="Rough notes → a finished program" to="/drilloop/creator?tab=author" cta="Open Author"
            body="Paste a messy brain-dump. Claude returns a publish-ready post, drafted drills with rubrics, and research directions — content creation collapsed to one paste." />
          <FeatureCard dark icon={<Beaker size={20} />} title="AI does the research & iterates" to="/drilloop/creator?tab=author" cta="Open Author"
            body="One click has AI act on the research directions and weave concrete examples and evidence into the post; another revises it on your own instructions — formatting or content. The creator stays the editor; the AI does the labor." />
          <FeatureCard dark icon={<Layers size={20} />} title="Structure it into topics" to="/drilloop/creator?tab=manage" cta="Open Manage drills"
            body="Tag any drill to a topic, or create new ones — the program is organized as topics members pick from, not a rigid sequence. Full lifecycle: edit, re-tier, delete, all with an audit log." />
          <FeatureCard dark icon={<Lightbulb size={20} />} title="A backlog driven by demand" to="/drilloop/creator?tab=insights" cta="Open Insights"
            body="Member requests for more drills land in the creator’s Insights as an authoring backlog — so they always know what to build next, straight from demand. The data flywheel that makes the AI engine point in the right direction." />
          <FeatureCard dark icon={<Users size={20} />} title="Privacy-safe community management" to="/drilloop/creator?tab=community" cta="Open Community"
            body="See active vs. inactive members and their milestone ‘wins’ — never their identities or answers. Know who to nudge and who to celebrate." />
          <FeatureCard dark icon={<MapPin size={20} />} title="Host in-person gatherings" to="/drilloop/creator?tab=community" cta="Open Community"
            body="Schedule a local meetup and get a ready-to-paste announcement. The online cohort becomes a real-world community the creator owns." />
          <FeatureCard dark icon={<Share2 size={20} />} title="Free access as the growth engine" to="/drilloop/creator?tab=grow" cta="Open Grow"
            body="Every drill is free — that’s the top of the funnel. A shareable invite welcomes people by name; revenue comes from the membership (community, gatherings, recognition, the credential), not a paywall on learning." />
        </div>
      </Section>

      {/* ── Why it retains ── */}
      <Section eyebrow="Why it compounds" title="We don’t compete for learning budget. We compete with Instagram for time.">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <RetainCard bad="A newsletter renews on guilt." good="Drilloop renews because you can see your judgment improving." />
          <RetainCard bad="A community renews on FOMO." good="A cohort and a local chapter are expecting you tomorrow." />
          <RetainCard bad="A course is bought once, abandoned." good="A credential and network get more valuable the longer you stay." />
        </div>
        <blockquote style={pullQuote}>
          <Quote size={20} color={TEAL} style={{ flexShrink: 0, marginTop: 3 }} />
          <span>You open Drilloop instead of LinkedIn, spend fifteen real minutes, leave sharper, meet two people worth knowing, and watch your own progress move. That trade beats the feed on every axis an ambitious person cares about.</span>
        </blockquote>
      </Section>

      {/* ── For the small expert — the economics ── */}
      <Section eyebrow="Why the long tail wins" title="Small isn’t a limitation here. It’s the whole market.">
        <p style={lede}>
          2,000 high-trust followers who chose you — a meaningful share of whom will pay for measurable growth, a credential, and a real community — beats 200,000 passive scrollers a horizontal platform fights over. Give every drill away free to fill the top of the funnel; twenty paying members at $19/mo for the community, gatherings, and credential is a real business to this person. The studio makes it achievable: develop a whole program in one paste, let demand tell you what to build next, onboard with one link, and keep them with a community they can’t get elsewhere. We’re the first product whose unit economics are built <em>around</em> the long tail of credible-but-small experts — a market thousands of times larger than the head.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/drilloop/creator?tab=grow" style={ctaPrimary}>
            <Share2 size={16} /> See how a creator onboards an audience <ArrowRight size={15} />
          </Link>
          <Link to="/drilloop/creator?tab=author" style={{ ...ctaGhost, color: TEAL, border: `1px solid ${TEAL}33` }}>
            <Wand2 size={16} /> Develop content from notes
          </Link>
        </div>
      </Section>

      {/* ── Why now + traction ── */}
      <Section eyebrow="Why now & where we are" title="The technology that broke the old model is what makes the new one possible.">
        <div style={grid3}>
          <ValueCard icon={<Sparkles size={22} />} title="Why now" body="AI made information worthless and judgment scarce; expertise unbundled from institutions; a generation hit peak influencer fatigue. LLMs can finally grade open-ended judgment cheaply." />
          <ValueCard icon={<Target size={22} />} title="Live today" body="Both sides ship on live Claude calls (verified end-to-end): the member loop (free topic-based drills, write or AI multiple-choice, AI grading, Mirror, Proof, request-more-drills) and the AI creator studio (notes→post→drills→research→iterate, topic structuring, demand backlog, community management, gatherings, one-link onboarding) — plus a working Postgres matching engine." />
          <ValueCard icon={<TrendingUp size={22} />} title="The ask" body="Take one expert (or a small Collective) with ~2,000 followers, convert a slice to paying members, and show a retention curve that flattens past month three." />
        </div>
      </Section>

      {/* ── Final CTA ── */}
      <section style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`, color: 'white', padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', fontWeight: 800, margin: '0 0 1rem', letterSpacing: '-0.01em' }}>
            Don’t take the pitch’s word for it. Click the product.
          </h2>
          <p style={{ fontSize: '1.05rem', opacity: 0.9, margin: '0 0 2rem', lineHeight: 1.5 }}>
            Both sides are live and working — drill free by topic and build your Proof as a member, or turn rough notes into a whole program with AI and run a community as the expert.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/drilloop?view=today" style={{ ...ctaPrimary, backgroundColor: 'white', color: TEAL_DARK }}>
              <Repeat size={17} /> Member experience
            </Link>
            <Link to="/drilloop/creator?tab=author" style={{ ...ctaGhost, borderColor: 'rgba(255,255,255,0.5)' }}>
              <Wand2 size={16} /> Creator Studio
            </Link>
          </div>
          <p style={{ fontSize: '0.78rem', opacity: 0.7, marginTop: '2rem' }}>
            Prototype — auth and payments are demo stand-ins (the studio persists locally). The learning loop, AI authoring, and matching engine are real.
          </p>
        </div>
      </section>
    </div>
  );
}

// ── Layout primitives ──
function Section({ eyebrow, title, children, dark, id }: { eyebrow: string; title: string; children: ReactNode; dark?: boolean; id?: string }) {
  return (
    <section id={id} style={{ backgroundColor: dark ? INK : 'white', color: dark ? 'white' : '#1F2937', padding: '4rem 1.5rem', scrollMarginTop: '1rem' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: TEAL, marginBottom: '0.6rem' }}>{eyebrow}</div>
        <h2 style={{ fontSize: 'clamp(1.4rem, 3.2vw, 2rem)', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.01em', margin: '0 0 1.5rem', color: dark ? 'white' : INK, maxWidth: 760 }}>{title}</h2>
        {children}
      </div>
    </section>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ maxWidth: 220 }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#5EEAD4' }}>{value}</div>
      <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, marginTop: '0.2rem' }}>{label}</div>
    </div>
  );
}

function ValueCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div style={{ flex: '1 1 240px', backgroundColor: 'rgba(13,148,136,0.06)', borderRadius: 16, padding: '1.5rem', border: '1px solid rgba(13,148,136,0.12)' }}>
      <div style={{ color: TEAL, marginBottom: '0.75rem' }}>{icon}</div>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.4rem', color: INK }}>{title}</h3>
      <p style={{ fontSize: '0.86rem', lineHeight: 1.55, color: '#475569', margin: 0 }}>{body}</p>
    </div>
  );
}

function ProblemCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div style={{ flex: '1 1 240px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '1.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#5EEAD4', marginBottom: '0.5rem' }}>{n}</div>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.4rem', color: 'white' }}>{title}</h3>
      <p style={{ fontSize: '0.86rem', lineHeight: 1.55, color: 'rgba(255,255,255,0.72)', margin: 0 }}>{body}</p>
    </div>
  );
}

function FeatureCard({ icon, title, body, to, cta, dark }: { icon: ReactNode; title: string; body: string; to: string; cta: string; dark?: boolean }) {
  const base: React.CSSProperties = dark
    ? { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(94,234,212,0.18)', boxShadow: 'none' }
    : { backgroundColor: 'white', border: '1px solid #E5E7EB', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' };
  const accent = dark ? '#5EEAD4' : TEAL;
  return (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit', display: 'block', borderRadius: 16, padding: '1.4rem', transition: 'transform 0.15s, box-shadow 0.15s', ...base }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = dark ? '0 10px 24px rgba(94,234,212,0.12)' : '0 10px 24px rgba(13,148,136,0.14)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = dark ? 'none' : '0 2px 10px rgba(0,0,0,0.04)'; }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 11, backgroundColor: dark ? 'rgba(94,234,212,0.12)' : 'rgba(13,148,136,0.08)', color: accent, marginBottom: '0.875rem' }}>{icon}</div>
      <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '0 0 0.4rem', color: dark ? 'white' : INK }}>{title}</h3>
      <p style={{ fontSize: '0.83rem', lineHeight: 1.5, color: dark ? 'rgba(255,255,255,0.72)' : '#475569', margin: '0 0 0.875rem' }}>{body}</p>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 700, color: accent }}>{cta} <ArrowRight size={14} /></span>
    </Link>
  );
}

function RetainCard({ bad, good }: { bad: string; good: string }) {
  return (
    <div style={{ flex: '1 1 240px', borderRadius: 16, padding: '1.4rem', border: '1px solid #E5E7EB', backgroundColor: 'white' }}>
      <div style={{ fontSize: '0.84rem', color: '#9CA3AF', textDecoration: 'line-through', marginBottom: '0.6rem' }}>{bad}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: INK, lineHeight: 1.5 }}>{good}</div>
    </div>
  );
}

// ── Style tokens ──
const ctaPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: TEAL, color: 'white',
  padding: '0.8rem 1.5rem', borderRadius: 12, fontSize: '0.95rem', fontWeight: 700, textDecoration: 'none',
  boxShadow: '0 4px 16px rgba(13,148,136,0.35)',
};
const ctaGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'white',
  padding: '0.8rem 1.5rem', borderRadius: 12, fontSize: '0.95rem', fontWeight: 600, textDecoration: 'none',
  border: '1px solid rgba(255,255,255,0.3)',
};
const lede: React.CSSProperties = { fontSize: '1.05rem', lineHeight: 1.6, color: '#475569', maxWidth: 760, margin: '0 0 2rem' };
const grid3: React.CSSProperties = { display: 'flex', gap: '1rem', flexWrap: 'wrap' };
const featureGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' };
const pullQuote: React.CSSProperties = {
  display: 'flex', gap: '0.75rem', margin: '2rem 0 0', padding: '1.5rem', borderRadius: 16,
  backgroundColor: 'rgba(13,148,136,0.06)', border: '1px solid rgba(13,148,136,0.12)',
  fontSize: '1.05rem', lineHeight: 1.6, color: INK, fontWeight: 500,
};
