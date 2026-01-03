import { useState } from 'react';
import UnifiedHeader from './UnifiedHeader';
import UnifiedFooter from './UnifiedFooter';
import AuthModal from './AuthModal';
import './LandingPage.css';

const DEMOS = [
  {
    q: "Should I accept a lower salary at a startup for equity, or take the higher salary job?",
    verdict: "Take the higher salary. The guaranteed income provides stability and optionality that early-stage equity rarely matches. Most startup equity ends up worthless, and even successful exits often come with heavy dilution. The council found strong consensus that unless you have specific insider knowledge about the startup's trajectory, the bird in hand wins.",
    opinions: [
      { label: "ChatGPT", stance: "Higher salary", color: "#10b981" },
      { label: "Claude", stance: "Higher salary", color: "#10b981" },
      { label: "Gemini", stance: "Take the equity", color: "#ef4444" },
      { label: "Grok", stance: "Higher salary", color: "#10b981" },
      { label: "DeepSeek", stance: "Higher salary", color: "#10b981" }
    ],
    keyRisk: "Startup equity has ~90% chance of being worth $0. You're trading guaranteed income for lottery tickets.",
    nextStep: "If you're still considering the startup, request to see their cap table, latest 409A valuation, and runway."
  },
  {
    q: "Should I hire a senior employee now or wait 3 months and keep contracting?",
    verdict: "Wait and keep contracting. The consensus strongly favors maintaining flexibility at this stage. A premature full-time hire locks in fixed costs and cultural commitment before you've validated the role's actual requirements. Contractors let you test the work without the commitment.",
    opinions: [
      { label: "ChatGPT", stance: "Wait / contract", color: "#10b981" },
      { label: "Claude", stance: "Wait / contract", color: "#10b981" },
      { label: "Gemini", stance: "Hire now", color: "#ef4444" },
      { label: "Grok", stance: "Wait / contract", color: "#10b981" },
      { label: "DeepSeek", stance: "Wait / contract", color: "#10b981" }
    ],
    keyRisk: "A bad hire costs 6-12 months of productivity. Firing is harder and more expensive than not hiring.",
    nextStep: "Define the exact outcomes you need in 90 days. If a contractor can hit them, you've validated the role."
  },
  {
    q: "Migrate to Next.js or stick with React Router?",
    verdict: "Migrate to Next.js. The council reached near-unanimous agreement that the long-term benefits outweigh short-term migration costs. Server-side rendering, improved SEO, and the App Router's conventions will accelerate development once the team adapts. The one dissent raised valid concerns about migration complexity but was outweighed.",
    opinions: [
      { label: "ChatGPT", stance: "Next.js", color: "#10b981" },
      { label: "Claude", stance: "Next.js", color: "#10b981" },
      { label: "Gemini", stance: "React Router", color: "#ef4444" },
      { label: "Grok", stance: "Next.js", color: "#10b981" },
      { label: "DeepSeek", stance: "Next.js", color: "#10b981" }
    ],
    keyRisk: "Migration will pause feature development for 2-4 weeks. Plan for velocity dip.",
    nextStep: "Start with a single route migration to prove the pattern before committing fully."
  },
  {
    q: "Should I sign this client at a lower price to get the logo, or hold the line?",
    verdict: "Hold your price. The council found that logo-hunting discounts rarely pay off—they set dangerous precedents, attract price-sensitive customers, and erode positioning. The one dissent argued for strategic discounting but couldn't overcome the risk of training your market that prices are negotiable.",
    opinions: [
      { label: "ChatGPT", stance: "Hold price", color: "#10b981" },
      { label: "Claude", stance: "Hold price", color: "#10b981" },
      { label: "Gemini", stance: "Discount for logo", color: "#ef4444" },
      { label: "Grok", stance: "Hold price", color: "#10b981" },
      { label: "DeepSeek", stance: "Hold price", color: "#10b981" }
    ],
    keyRisk: "One discount becomes a pattern. Future prospects will expect the same treatment.",
    nextStep: "Counter-offer with added value instead of reduced price: extra onboarding, priority support, or a case study package."
  }
];

function getRandomDemo(currentQ = null) {
  let next = DEMOS[Math.floor(Math.random() * DEMOS.length)];
  if (DEMOS.length > 1 && currentQ) {
    while (next.q === currentQ) {
      next = DEMOS[Math.floor(Math.random() * DEMOS.length)];
    }
  }
  return next;
}

export default function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [currentDemo, setCurrentDemo] = useState(() => getRandomDemo());

  const openAuth = (mode) => {
    setAuthMode(mode);
    setShowAuth(true);
  };

  const handleNextDemo = () => {
    setCurrentDemo(getRandomDemo(currentDemo.q));
  };

  return (
    <div className="landing">
      {/* Unified Navigation */}
      <UnifiedHeader isSignedIn={false} onOpenAuth={openAuth} />

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-container">
          <h1 className="hero-title">
            One Decision.<br />
            Five Models.<br />
            <span className="text-gradient">One Clear Answer.</span>
          </h1>

          <p className="hero-sub">
            You ask once. Multiple top-tier models disagree on your behalf.<br />
            You get one consensus verdict, identified risks, and clear next steps.
          </p>

          <div className="value-bullets">
            <div className="v-bullet">
              <span className="v-icon">&#10003;</span>
              Consensus verdict with confidence score
            </div>
            <div className="v-bullet">
              <span className="v-icon">&#10003;</span>
              Key risks & counterarguments surfaced
            </div>
            <div className="v-bullet">
              <span className="v-icon">&#10003;</span>
              Clear next steps you can act on
            </div>
          </div>

          <div className="hero-cta-group">
            <button className="btn-primary btn-large" onClick={() => openAuth('signup')}>
              Get 5 Free Credits
            </button>
          </div>

          <p className="hero-note">No credit card required. Instant access.</p>

          {/* Council Visual */}
          <div className="council-visual">
            <div className="council-arena">
              <div className="model-node chatgpt">
                <span className="node-label">ChatGPT</span>
              </div>
              <div className="model-node claude">
                <span className="node-label">Claude</span>
              </div>
              <div className="model-node gemini">
                <span className="node-label">Gemini</span>
              </div>
              <div className="model-node grok">
                <span className="node-label">Grok</span>
              </div>
              <div className="model-node deepseek">
                <span className="node-label">DeepSeek</span>
              </div>
              <div className="council-center">
                <span>Your Answer</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <div className="trust-strip">
        <div className="trust-container">
          <div className="trust-label">Used for high-stakes decisions like:</div>
          <div className="use-cases">
            <span className="uc-pill">Technical Architecture</span>
            <span className="uc-pill">Legal Clause Review</span>
            <span className="uc-pill">Candidate Evaluation</span>
            <span className="uc-pill">Vendor Selection</span>
            <span className="uc-pill">Conflicting Research</span>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <section className="how-section" id="how">
        <div className="how-nav">
          <a className="how-skip" href="#demo" aria-label="Skip to demo">Skip to demo ↓</a>
          <div className="how-nav-right">
            <a href="#pricing" className="btn-link">See pricing</a>
            <button className="btn-primary btn-small" onClick={() => openAuth('signup')}>
              Try 5 free queries
            </button>
          </div>
        </div>

        {/* Outcome Strip */}
        <div className="outcome-strip">
          <div className="outcome-box">
            <span className="outcome-icon">✓</span>
            <span className="outcome-text">One clear verdict</span>
          </div>
          <div className="outcome-box">
            <span className="outcome-icon">⚠</span>
            <span className="outcome-text">Risks surfaced</span>
          </div>
          <div className="outcome-box">
            <span className="outcome-icon">⚖</span>
            <span className="outcome-text">Dissent preserved</span>
          </div>
          <div className="outcome-box">
            <span className="outcome-icon">→</span>
            <span className="outcome-text">Next steps ready</span>
          </div>
        </div>

        <div className="how-container">
          <div className="how-grid">
            {/* Left: Process Explanation */}
            <div className="how-process">
              <h2>How It Works</h2>

              <div className="process-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h3>You ask once</h3>
                  <p>Describe your decision, tradeoff, or question. No prompt engineering required.</p>
                </div>
              </div>

              <div className="process-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h3>5 models deliberate</h3>
                  <p>GPT, Claude, Gemini, Grok, and DeepSeek each form independent opinions on your question.</p>
                </div>
              </div>

              <div className="process-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h3>Anonymous peer review</h3>
                  <p>Each model critiques the others without knowing who wrote what. No favoritism. Pure merit.</p>
                </div>
              </div>

              <div className="process-step">
                <div className="step-number">4</div>
                <div className="step-content">
                  <h3>One verdict emerges</h3>
                  <p>A chairman model synthesizes consensus, flags dissent, and delivers actionable next steps.</p>
                </div>
              </div>
            </div>

            {/* Right: Sticky Demo Card */}
            <div className="how-demo-wrapper">
              <div className="how-demo-card">
                <div className="demo-label">Example Output</div>
                <div className="verdict-header">
                  <span className="verdict-title">Council Verdict</span>
                  <span className="verdict-badge-models">5 AI Models</span>
                </div>
                <div className="verdict-body">
                  <div className="verdict-question">
                    "Migrate to Next.js or stick with React Router?"
                  </div>

                  {/* Compact model opinions */}
                  <div className="model-opinions compact">
                    <div className="opinion-chip" style={{ borderColor: '#10b981' }}>
                      <span className="opinion-dot" style={{ background: '#10b981' }}></span>
                      <span className="opinion-model">ChatGPT</span>
                      <span className="opinion-stance">Next.js</span>
                    </div>
                    <div className="opinion-chip" style={{ borderColor: '#10b981' }}>
                      <span className="opinion-dot" style={{ background: '#10b981' }}></span>
                      <span className="opinion-model">Claude</span>
                      <span className="opinion-stance">Next.js</span>
                    </div>
                    <div className="opinion-chip" style={{ borderColor: '#ef4444' }}>
                      <span className="opinion-dot" style={{ background: '#ef4444' }}></span>
                      <span className="opinion-model">Gemini</span>
                      <span className="opinion-stance">React Router</span>
                    </div>
                    <div className="opinion-chip" style={{ borderColor: '#10b981' }}>
                      <span className="opinion-dot" style={{ background: '#10b981' }}></span>
                      <span className="opinion-model">Grok</span>
                      <span className="opinion-stance">Next.js</span>
                    </div>
                    <div className="opinion-chip" style={{ borderColor: '#10b981' }}>
                      <span className="opinion-dot" style={{ background: '#10b981' }}></span>
                      <span className="opinion-model">DeepSeek</span>
                      <span className="opinion-stance">Next.js</span>
                    </div>
                  </div>

                  <div className="verdict-synthesis">
                    <div className="synthesis-label">The Verdict</div>
                    <p className="synthesis-text">Migrate to Next.js. The long-term benefits outweigh short-term migration costs.</p>
                  </div>

                  <div className="insight-box risk">
                    <div className="ib-label">Key Risk</div>
                    <div className="ib-text">
                      Migration will pause feature development for 2-4 weeks.
                    </div>
                  </div>

                  <div className="insight-box next-step">
                    <div className="ib-label">Next Step</div>
                    <div className="ib-text">
                      Start with a single route migration to prove the pattern.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="demo-section" id="demo">
        <div className="demo-container">
          <div className="demo-grid">
            <div className="demo-text">
              <h2>When it matters, don't rely on one opinion.</h2>
              <p>
                Single models often confirm your bias. The Council is built to challenge it.
              </p>
              <p>
                We force top models to critique each other anonymously. If there's a risk, we find it. If there's a better path, we highlight it.
              </p>
              <button className="btn-secondary shuffle-btn" onClick={handleNextDemo}>
                See another decision &#x21bb;
              </button>
              <button className="btn-primary" onClick={() => openAuth('signup')}>
                Run your own decision &rarr;
              </button>
            </div>

            <div className="verdict-card">
              <div className="verdict-header">
                <span className="verdict-title">Council Verdict</span>
                <span className="verdict-badge-models">5 AI Models</span>
              </div>
              <div className="verdict-body">
                <div className="verdict-question">
                  "{currentDemo.q}"
                </div>

                {/* Model opinions row */}
                <div className="model-opinions">
                  {currentDemo.opinions.map((op, i) => (
                    <div key={i} className="opinion-chip" style={{ borderColor: op.color }}>
                      <span className="opinion-dot" style={{ background: op.color }}></span>
                      <span className="opinion-model">{op.label}</span>
                      <span className="opinion-stance">{op.stance}</span>
                    </div>
                  ))}
                </div>

                {/* Synthesized verdict */}
                <div className="verdict-synthesis">
                  <div className="synthesis-label">The Verdict</div>
                  <p className="synthesis-text">{currentDemo.verdict}</p>
                </div>

                <div className="insight-box risk">
                  <div className="ib-label">Key Risk</div>
                  <div className="ib-text">{currentDemo.keyRisk}</div>
                </div>

                <div className="insight-box next-step">
                  <div className="ib-label">Recommended Next Step</div>
                  <div className="ib-text">{currentDemo.nextStep}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing-section" id="pricing">
        <div className="pricing-container">
          <div className="pricing-header">
            <h2>Pricing</h2>
            <p>
              <strong>1 credit = 1 Council Run</strong> (Multi-model debate + Verdict + Action Plan)
            </p>
          </div>

          <div className="pricing-cards">
            <div className="p-card">
              <h3>Trial</h3>
              <div className="p-price">$0</div>
              <div className="p-sub">5 credits included</div>
              <button className="btn-secondary" onClick={() => openAuth('signup')}>
                Try Free
              </button>
            </div>

            <div className="p-card featured">
              <div className="p-badge">POPULAR</div>
              <h3>Starter</h3>
              <div className="p-price">$5</div>
              <div className="p-sub">20 credits (never expire)</div>
              <button className="btn-primary" onClick={() => openAuth('signup')}>
                Get Starter
              </button>
            </div>

            <div className="p-card">
              <h3>Pro</h3>
              <div className="p-price">$15</div>
              <div className="p-sub">100 credits</div>
              <button className="btn-secondary" onClick={() => openAuth('signup')}>
                Get Pro
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Unified Footer */}
      <UnifiedFooter />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        initialMode={authMode === 'signin' ? 'login' : 'register'}
      />
    </div>
  );
}
