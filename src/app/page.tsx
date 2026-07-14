import type { Metadata } from "next";
import Link from "next/link";
import {
  Eyebrow,
  Badge,
  Card,
  PlanCard,
  Avatar,
  AIEvaluationCard,
  Logo,
} from "@/components/ui";
import { HomeNav } from "@/components/marketing/HomeNav";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Gyanverse — The all-in-one EdTech OS for coaching institutes",
  description:
    "Run your coaching's entire test program online. Host classes, automate fee transactions, generate mock tests, and pinpoint exact mistakes with AI — all in one platform.",
  openGraph: {
    title: "Gyanverse — The all-in-one EdTech OS",
    description:
      "Host classes, automate fees, run AI-powered exams, and analyze performance. Built for Indian coaching institutes.",
    type: "website",
  },
};

// ── Sample data for the signature AI-evaluation hero visual ──────────────────
const EVAL_STEPS = [
  { text: "Step 1: ∫ x sin(x) dx" },
  { text: "Step 2: = −x cos(x) − ∫ cos(x) dx", wrong: true },
  { text: "Step 3: = −x cos(x) − sin(x) + C" },
];
const EVAL_MISTAKE =
  "In Step 2, using integration by parts, you missed the negative sign. The correct expansion gives +∫ cos(x) dx, not −∫ cos(x) dx.";
const EVAL_ALT =
  "Correct answer: −x cos(x) + sin(x) + C. The DI (tabular) method reaches the same result faster.";

const HERO_STATS = [
  { value: "800+", label: "Institutes" },
  { value: "50,000+", label: "Students" },
  { value: "99.9%", label: "Uptime" },
];

const AI_POINTS = [
  "Scan or upload handwritten step-by-step solutions",
  "Pinpoint exact mistakes in any intermediate step",
  "Generate correct methods and alternative solutions",
  "Instant, detailed feedback for personalized learning",
];

const FEATURES = [
  {
    eyebrow: "AI Evaluation",
    title: (
      <>
        Find <span className="gv-em">exact mistakes</span> in any step.
      </>
    ),
    body: "Upload scanned solutions. AI breaks down each step, pinpoints the precise error, and generates the correct method and alternative approaches.",
    badge: { tone: "success" as const, label: "AI-Powered" },
  },
  {
    eyebrow: "Test Engine",
    title: (
      <>
        Full mock tests, generated in <span className="gv-em">seconds</span>.
      </>
    ),
    body: "Pick syllabus scope, question types, and difficulty mix — the engine assembles a complete mock from your question bank instantly.",
    badge: { tone: "accent" as const, label: "Auto-Generation" },
  },
  {
    eyebrow: "Public Marketplace",
    title: (
      <>
        Publish mocks the whole <span className="gv-em">country</span> can take.
      </>
    ),
    body: "List free or paid mock tests on a public catalogue. Students discover your institute, attempt your mocks, and convert into admissions.",
    badge: { tone: "warning" as const, label: "Marketplace" },
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Gyanverse completely transformed how we run exams. The AI evaluation alone saves our teachers 8 hours every week.",
    name: "Anil Sharma",
    org: "Sharma Classes, Kota",
  },
  {
    quote:
      "We went from 40 to 280 students in 6 months. The public mock marketplace drives most of our organic discovery now.",
    name: "Rajesh Kumar",
    org: "K.R. Tutorial Institute, Delhi",
  },
  {
    quote:
      "The fee automation alone was worth switching. No more WhatsApp reminders — the platform handles collections automatically.",
    name: "Dr. Priya Mehta",
    org: "Apex Academy, Mumbai",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    features: ["30 students · 5 teachers", "5 classes", "3 mocks/mo", "10 AI evals/mo"],
    cta: "Start Free",
  },
  {
    name: "Starter",
    price: "₹999",
    features: [
      "100 students · 10 teachers",
      "20 classes",
      "15 mocks/mo",
      "100 AI evals/mo",
      "Public mocks",
    ],
    cta: "Start Free Trial",
  },
  {
    name: "Growth",
    price: "₹2,499",
    highlighted: true,
    features: [
      "500 students · 20 teachers",
      "50 classes",
      "50 mocks/mo",
      "500 AI evals/mo",
      "Advanced analytics",
      "Public mocks",
    ],
    cta: "Start Free Trial",
  },
  {
    name: "Pro",
    price: "₹5,999",
    features: [
      "Unlimited everything",
      "Advanced analytics",
      "Public mocks",
      "Custom branding",
      "API access",
    ],
    cta: "Talk to Sales",
  },
];

// ── Navigation-aware pill CTA (Button is a <button>; links must be anchors) ──
function CtaLink({
  href,
  children,
  variant = "primary",
  arrow = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "accent";
  arrow?: boolean;
}) {
  return (
    <Link href={href} className={`gv-btn gv-btn--${variant} gv-btn--lg`}>
      <span>{children}</span>
      {arrow && (
        <span aria-hidden="true" style={{ fontSize: "1.05em" }}>
          →
        </span>
      )}
    </Link>
  );
}

export default function Home() {
  return (
    <div style={{ background: "var(--paper-50)" }}>
      <HomeNav />

      {/* ── HERO — Editorial Split ─────────────────────────────────────── */}
      <section
        className={styles.sectionTight}
        style={{
          background:
            "radial-gradient(ellipse 65% 60% at 50% 12%, #eef0fc 0%, var(--paper-50) 70%)",
        }}
      >
        <div className={`${styles.container} ${styles.split}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <Eyebrow chip>The All-in-one EdTech OS</Eyebrow>
            <h1
              style={{
                fontSize: "clamp(38px, 5vw, 64px)",
                lineHeight: 1.04,
                letterSpacing: "-0.03em",
              }}
            >
              Run your coaching&apos;s entire test program.{" "}
              <span className="gv-em">Online.</span>
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--text-body)" }}>
              Host classes, automate fee transactions, analyze performance with AI, and
              manage your entire educational operation at a fraction of the cost.
            </p>

            <div
              style={{
                display: "flex",
                gap: 32,
                flexWrap: "wrap",
                padding: "16px 0",
                borderTop: "1px solid var(--border-light)",
                borderBottom: "1px solid var(--border-light)",
              }}
            >
              {HERO_STATS.map((s) => (
                <div key={s.label}>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 26,
                      fontWeight: 700,
                      letterSpacing: "-0.03em",
                      color: "var(--text-heading)",
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 13,
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <CtaLink href="/register" arrow>
                Start Free Trial
              </CtaLink>
              <CtaLink href="/register" variant="secondary">
                Book a Demo
              </CtaLink>
            </div>
          </div>

          <AIEvaluationCard
            student="Rahul S."
            exam="JEE Main · Calculus"
            score={6}
            steps={EVAL_STEPS}
            mistake={EVAL_MISTAKE}
            alternative={EVAL_ALT}
          />
        </div>
      </section>

      {/* ── AI SECTION (dark) ──────────────────────────────────────────── */}
      <section
        id="ai"
        className={`theme-dark ${styles.section}`}
        style={{ background: "var(--navy-900)" }}
      >
        <div className={`${styles.container} ${styles.split}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <Eyebrow>AI Subjective Paper Analysis</Eyebrow>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 46px)" }}>
              Upload solutions. Find <span className="gv-em">exact mistakes</span>.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--text-body)" }}>
              Students scan or upload handwritten solutions. Our AI breaks down the working
              step-by-step, identifies the exact conceptual or calculation error, and
              provides the correct methodology with alternative solutions.
            </p>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 13,
              }}
            >
              {AI_POINTS.map((point) => (
                <li
                  key={point}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    fontFamily: "var(--font-body)",
                    fontSize: 15,
                    color: "var(--text-on-dark)",
                  }}
                >
                  <span style={{ color: "var(--success)", fontWeight: 700 }}>✓</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <AIEvaluationCard
            student="Rahul S."
            exam="Calculus Mid-Term (Scanned)"
            score={6}
            steps={EVAL_STEPS}
            mistake={EVAL_MISTAKE}
            alternative={EVAL_ALT}
          />
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────── */}
      <section id="features" className={styles.section} style={{ background: "var(--paper-50)" }}>
        <div
          className={styles.container}
          style={{ display: "flex", flexDirection: "column", gap: 52 }}
        >
          <div
            style={{
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              alignItems: "center",
            }}
          >
            <Eyebrow chip>Features</Eyebrow>
            <h2 style={{ fontSize: "clamp(30px, 4vw, 44px)" }}>
              Run your entire testing <span className="gv-em">operation</span>.
            </h2>
          </div>

          <div className={styles.cards3}>
            {FEATURES.map((f) => (
              <Card key={f.eyebrow} size="lg" padding={32}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <Eyebrow>{f.eyebrow}</Eyebrow>
                  <h3>{f.title}</h3>
                  <p style={{ fontSize: 15, color: "var(--text-body)", lineHeight: 1.65 }}>
                    {f.body}
                  </p>
                  <div>
                    <Badge tone={f.badge.tone}>{f.badge.label}</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────────────── */}
      <section
        id="customers"
        className={styles.section}
        style={{ background: "#fff", borderTop: "1px solid var(--border-light)" }}
      >
        <div
          className={styles.container}
          style={{ display: "flex", flexDirection: "column", gap: 48 }}
        >
          <div
            style={{
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              alignItems: "center",
            }}
          >
            <Eyebrow chip>Customers</Eyebrow>
            <h2 style={{ fontSize: "clamp(28px, 3.5vw, 40px)" }}>
              Trusted by <span className="gv-em">coaching institutes</span> across India.
            </h2>
          </div>

          <div className={styles.cards3}>
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} padding={28}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <p
                    style={{
                      fontSize: 16,
                      lineHeight: 1.7,
                      color: "var(--text-heading)",
                      fontStyle: "italic",
                    }}
                  >
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      paddingTop: 14,
                      borderTop: "1px solid var(--border-light)",
                    }}
                  >
                    <Avatar name={t.name} size={36} />
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--font-body)",
                          fontWeight: 600,
                          fontSize: 14,
                          color: "var(--text-heading)",
                        }}
                      >
                        {t.name}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 12,
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        {t.org}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────────────── */}
      <section
        id="pricing"
        className={styles.section}
        style={{ background: "#fff", borderTop: "1px solid var(--border-light)" }}
      >
        <div
          className={styles.container}
          style={{ display: "flex", flexDirection: "column", gap: 48 }}
        >
          <div
            style={{
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              alignItems: "center",
            }}
          >
            <Eyebrow chip>Pricing</Eyebrow>
            <h2 style={{ fontSize: "clamp(30px, 4vw, 44px)" }}>
              Pay for <span className="gv-em">growth</span>, not seats.
            </h2>
            <p style={{ fontSize: 16, color: "var(--text-body)" }}>
              Every plan includes the test engine, classes, and fee automation.
            </p>
          </div>

          <div className={styles.plans}>
            {PLANS.map((p) => (
              <PlanCard
                key={p.name}
                name={p.name}
                price={p.price}
                highlighted={p.highlighted}
                features={p.features}
                cta={p.cta}
                href="/register"
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BAND (dark) ────────────────────────────────────────────── */}
      <section
        className="theme-dark"
        style={{ padding: "80px 40px", background: "var(--navy-900)", textAlign: "center" }}
      >
        <div
          style={{
            maxWidth: 600,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 22,
            alignItems: "center",
          }}
        >
          <h2
            style={{
              fontSize: "clamp(28px, 3.5vw, 40px)",
              color: "#f3f5fb",
              letterSpacing: "-0.03em",
            }}
          >
            Start your free trial. Today.
          </h2>
          <p style={{ fontSize: 16, color: "var(--text-body)", lineHeight: 1.65 }}>
            No credit card required. Set up your institute in 5 minutes.
          </p>
          <CtaLink href="/register" arrow>
            Start Free Trial
          </CtaLink>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer
        className="theme-dark"
        style={{
          background: "var(--navy-900)",
          padding: "40px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          className={styles.container}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <Logo size={20} onDark />
          <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-muted)" }}>
            © {new Date().getFullYear()} Gyanverse. All rights reserved.
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            <a href="#features" style={footerLink}>
              Features
            </a>
            <a href="#ai" style={footerLink}>
              AI Analysis
            </a>
            <a href="#pricing" style={footerLink}>
              Pricing
            </a>
            <Link href="/login" style={footerLink}>
              Login
            </Link>
            <Link href="/register" style={footerLink}>
              Get Started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const footerLink: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  color: "var(--text-body-on-dark)",
  textDecoration: "none",
};
