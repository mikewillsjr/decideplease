import { useState } from 'react';
import UnifiedHeader from './UnifiedHeader';
import UnifiedFooter from './UnifiedFooter';
import AuthModal from './AuthModal';
import './LandingPage.css';

const DEMOS = [
  {
    q: "Should I accept a lower salary at a startup for equity, or take the higher salary job?",
    rec: "Take the higher salary — unless the startup equity is unusually clear and near-term liquid.",
    confidence: 76,
    votes: [
      { model: "GPT-4", pick: "Higher salary" },
      { model: "Claude", pick: "Higher salary" },
      { model: "Gemini", pick: "Startup equity (dissent)" }
    ],
    risk: "Equity often ends up worth $0. If the startup fails or dilutes heavily, you paid for hope with years of income.",
    tradeoff: "Higher salary reduces upside, but increases certainty and optionality.",
    flip: "If the startup has strong traction, clear terms, and you have 12–18 months runway, equity can win."
  },
  {
    q: "Should I hire a senior employee now or wait 3 months and keep contracting?",
    rec: "Wait 3 months and keep contracting — unless the role is blocking revenue this month.",
    confidence: 81,
    votes: [
      { model: "GPT-4", pick: "Wait / contract" },
      { model: "Claude", pick: "Wait / contract" },
      { model: "Gemini", pick: "Hire now (dissent)" }
    ],
    risk: "A bad full-time hire costs more than money—momentum, culture, and time.",
    tradeoff: "Waiting may slow execution, but reduces long-term payroll risk.",
    flip: "If you're losing deals due to speed or expertise gaps right now, hiring immediately becomes higher-ROI."
  },
  {
    q: "Migrate to Next.js or stick with React Router?",
    rec: "Migrate to Next.js — unless SEO is not a priority and team velocity is critical.",
    confidence: 92,
    votes: [
      { model: "GPT-4", pick: "Next.js" },
      { model: "Claude", pick: "Next.js" },
      { model: "Gemini", pick: "React Router (dissent)" }
    ],
    risk: "Migration complexity may pause feature work for 2-3 sprints.",
    tradeoff: "Next.js adds SSR/SEO benefits but increases infrastructure complexity.",
    flip: "If SEO is not a top priority, the verdict flips to React Router to reduce overhead."
  },
  {
    q: "Should I sign this client at a lower price to get the logo, or hold the line?",
    rec: "Hold the line — unless the deal creates repeatable distribution and a clean case study.",
    confidence: 83,
    votes: [
      { model: "GPT-4", pick: "Hold price" },
      { model: "Claude", pick: "Hold price" },
      { model: "Gemini", pick: "Discount for logo (dissent)" }
    ],
    risk: "Discounts train the market that your price is negotiable.",
    tradeoff: "Holding price may lose the deal, but protects positioning and margins.",
    flip: "If the client guarantees a public case study + referrals and you cap the discount tightly, the logo play can be worth it."
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
                  <span className="verdict-title">Consensus Verdict</span>
                  <span className="verdict-badge">92% CONFIDENCE</span>
                </div>
                <div className="verdict-body">
                  <div className="verdict-question">
                    Q: "Migrate to Next.js or stick with React Router?"
                  </div>

                  <h4 className="verdict-recommendation">
                    <span className="v-dot"></span>
                    Recommendation: Migrate to Next.js
                  </h4>

                  <div className="model-votes">
                    <div className="vote agree">
                      <span className="vote-model">GPT-4</span>
                      <span className="vote-stance">Next.js</span>
                    </div>
                    <div className="vote agree">
                      <span className="vote-model">Claude</span>
                      <span className="vote-stance">Next.js</span>
                    </div>
                    <div className="vote dissent">
                      <span className="vote-model">Gemini</span>
                      <span className="vote-stance">React Router (dissent)</span>
                    </div>
                  </div>

                  <div className="insight-box risk">
                    <div className="ib-label">Primary Risk</div>
                    <div className="ib-text">
                      Migration complexity may pause feature work for 2-3 sprints.
                    </div>
                  </div>

                  <div className="insight-box flip">
                    <div className="ib-label">Flip Condition</div>
                    <div className="ib-text">
                      If SEO is not critical, verdict flips to <strong>React Router</strong>.
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
                <span className="verdict-title">Consensus Verdict</span>
                <span className={`verdict-badge ${currentDemo.confidence >= 80 ? '' : 'warning'}`}>
                  {currentDemo.confidence}% CONFIDENCE
                </span>
              </div>
              <div className="verdict-body">
                <div className="verdict-question">
                  Q: "{currentDemo.q}"
                </div>

                <h4 className="verdict-recommendation">
                  <span className="v-dot"></span>
                  {currentDemo.rec}
                </h4>

                <div className="model-votes">
                  {currentDemo.votes.map((v, i) => {
                    const isDissent = v.pick.toLowerCase().includes('dissent');
                    return (
                      <div key={i} className={`vote-item ${isDissent ? 'dissent' : ''}`}>
                        <span className={`vote-dot ${isDissent ? 'dissent' : ''}`}></span>
                        <span className="vote-model">{v.model}</span>
                        <span className="vote-pick">{v.pick}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="insight-box risk">
                  <div className="ib-label">Primary Risk</div>
                  <div className="ib-text">{currentDemo.risk}</div>
                </div>

                <div className="insight-box">
                  <div className="ib-label">Tradeoff</div>
                  <div className="ib-text">{currentDemo.tradeoff}</div>
                </div>

                <div className="insight-box flip">
                  <div className="ib-label">Flip Condition</div>
                  <div className="ib-text">{currentDemo.flip}</div>
                </div>

                <div className="verdict-footer">
                  Consulted: Top-tier Language Models (GPT, Claude, Gemini)
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
