import { Link } from 'react-router';
import { type ReactNode } from 'react';
import {
  Repeat, Target, Users, MapPin, BadgeCheck, Network, Wand2, Timer,
  ArrowRight, Sparkles, TrendingUp, Quote,
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
            Drilloop turns a trusted expert’s knowledge into daily judgment drills — AI-graded, peer-mirrored, and credentialed — inside a small community that meets online and in person. Built for the 2,000-follower expert everyone else ignores, and the audience done wasting its evenings on the feed.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/drilloop" style={ctaPrimary}>
              <Sparkles size={17} /> Try the live demo <ArrowRight size={16} />
            </Link>
            <a href="#product" style={ctaGhost}>Read the pitch</a>
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

      {/* ── Product / features (with live links) ── */}
      <Section eyebrow="The product" title="A better place to spend the hour you’d lose to the feed." id="product">
        <p style={lede}>
          The drill is the atom — a judgment question you answer in your own words, AI-graded against the expert’s rubric. Everything around it is engineered to make this a more worthwhile use of leisure time than social media. <strong>Every card below is clickable in the live prototype.</strong>
        </p>
        <div style={featureGrid}>
          <FeatureCard icon={<Timer size={20} />} title="The Daily Rep" to="/drilloop" cta="Open the member app"
            body="A finite session by design — a few drills, your peers’ answers, done. No infinite scroll. We win by ending well." />
          <FeatureCard icon={<Target size={20} />} title="AI grading + reference" to="/drilloop" cta="Drill a sample"
            body="Score your free-text answer 0–100 with coaching and the expert’s reference answer. Real Claude calls, graceful offline fallback." />
          <FeatureCard icon={<Users size={20} />} title="Mirror — peer reasoning" to="/drilloop" cta="Answer a drill to unlock"
            body="See how sharp peers reasoned on the same question — anonymized, unlocked only after you commit. The feed replaced by substance." />
          <FeatureCard icon={<Users size={20} />} title="Drill Rooms" to="/drilloop" cta="See the Community tab"
            body="A small synchronized cohort moving together this week — presence and accountability, minus the performance." />
          <FeatureCard icon={<MapPin size={20} />} title="Local Chapters" to="/drilloop" cta="See the Community tab"
            body="When members cluster in a city, a chapter forms and meets in person. The deeply human good a model can never offer." />
          <FeatureCard icon={<BadgeCheck size={20} />} title="Proof of Judgment" to="/drilloop" cta="See the Progress tab"
            body="A portable, verifiable credential of your tested judgment — the résumé line that survives AI." />
          <FeatureCard icon={<Network size={20} />} title="Reasoning-based network" to="/drilloop" cta="See the Connect tab"
            body="1:1 matches by how you think and what you’re working toward — accept, meet, log the outcome. Backed by a real Postgres matching engine." />
          <FeatureCard icon={<Wand2 size={20} />} title="Expert Collectives" to="/drilloop/creator" cta="Open the Creator Studio"
            body="Several sub-scale experts co-teach one flagship program — more complete, more defensible, a cohort none could fill alone." />
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

      {/* ── For the small expert ── */}
      <Section eyebrow="Founder-side" title="Finally, a product where small is a feature — not a bug." dark>
        <p style={{ ...lede, color: 'rgba(255,255,255,0.82)' }}>
          Paste a post, a talk, a Slack rant → AI drafts the drills with rubrics in seconds → publish. Partner with two peers to launch a Collective. Watch an online cohort turn into chapters in five cities. 2,000 high-trust followers who chose you — a meaningful share of whom pay for measurable growth, a credential, and a real community — beats 200,000 passive scrollers. We’re the first product whose economics are built around the long tail of credible-but-small experts.
        </p>
      </Section>

      {/* ── Why now + traction ── */}
      <Section eyebrow="Why now & where we are" title="The technology that broke the old model is what makes the new one possible.">
        <div style={grid3}>
          <ValueCard icon={<Sparkles size={22} />} title="Why now" body="AI made information worthless and judgment scarce; expertise unbundled from institutions; a generation hit peak influencer fatigue. LLMs can finally grade open-ended judgment cheaply." />
          <ValueCard icon={<Target size={22} />} title="Live today" body="The core loop runs on real model calls — drill, AI-grade, streak, mastery map, expert authoring, struggle analytics — plus a working Postgres matching engine for the network." />
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
            The prototype is live and working — drill, get graded, see your cohort, build your Proof.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/drilloop" style={{ ...ctaPrimary, backgroundColor: 'white', color: TEAL_DARK }}>
              <Repeat size={17} /> Member experience
            </Link>
            <Link to="/drilloop/creator" style={{ ...ctaGhost, borderColor: 'rgba(255,255,255,0.5)' }}>
              <Wand2 size={16} /> Creator Studio
            </Link>
          </div>
          <p style={{ fontSize: '0.78rem', opacity: 0.7, marginTop: '2rem' }}>
            Prototype — auth, payments, and some community surfaces are demo stand-ins. The learning loop and matching engine are real.
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

function FeatureCard({ icon, title, body, to, cta }: { icon: ReactNode; title: string; body: string; to: string; cta: string }) {
  return (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit', display: 'block', backgroundColor: 'white', borderRadius: 16, padding: '1.4rem', border: '1px solid #E5E7EB', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(13,148,136,0.14)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.04)'; }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 11, backgroundColor: 'rgba(13,148,136,0.08)', color: TEAL, marginBottom: '0.875rem' }}>{icon}</div>
      <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '0 0 0.4rem', color: INK }}>{title}</h3>
      <p style={{ fontSize: '0.83rem', lineHeight: 1.5, color: '#475569', margin: '0 0 0.875rem' }}>{body}</p>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 700, color: TEAL }}>{cta} <ArrowRight size={14} /></span>
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
