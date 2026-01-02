import { useState } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import './DemoPage.css';

const DEMOS = [
  {
    q: "Should I accept a lower salary at a startup for equity, or take the higher salary job?",
    rec: "Take the higher salary — unless the startup equity is unusually clear and near-term liquid.",
    confidence: 76,
    votes: [
      { model: "Model 1", pick: "Higher salary" },
      { model: "Model 2", pick: "Higher salary" },
      { model: "Model 3", pick: "Startup equity (dissent)" }
    ],
    risk: "Equity often ends up worth $0. If the startup fails or dilutes heavily, you paid for hope with years of income.",
    tradeoff: "Higher salary reduces upside, but increases certainty and optionality (you can invest or switch later from a stronger base).",
    flip: "If the startup has strong traction, clear terms, reputable investors, and you have 12–18 months runway, the equity path can win."
  },
  {
    q: "Should I hire a senior employee now or wait 3 months and keep contracting?",
    rec: "Wait 3 months and keep contracting — unless the role is blocking revenue this month.",
    confidence: 81,
    votes: [
      { model: "Model 1", pick: "Wait / contract" },
      { model: "Model 2", pick: "Wait / contract" },
      { model: "Model 3", pick: "Hire now (dissent)" }
    ],
    risk: "A bad full-time hire costs more than money—momentum, culture, and time. Contracting preserves flexibility while you learn what you actually need.",
    tradeoff: "Waiting may slow execution, but reduces long-term payroll risk and lets you validate the role definition with real work.",
    flip: "If you're losing deals due to speed or expertise gaps right now, hiring immediately becomes the higher-ROI choice."
  },
  {
    q: "Should I raise money now or bootstrap for another 6 months?",
    rec: "Bootstrap 6 months — unless capital directly unlocks growth you can't reach otherwise.",
    confidence: 74,
    votes: [
      { model: "Model 1", pick: "Bootstrap" },
      { model: "Model 2", pick: "Raise now (dissent)" },
      { model: "Model 3", pick: "Bootstrap" }
    ],
    risk: "Fundraising steals focus and can lock you into expectations before product clarity. Bad terms can trap you for years.",
    tradeoff: "Bootstrapping is slower but keeps control. Raising is faster but adds pressure, dilution, and investor constraints.",
    flip: "If you have proven demand + clear unit economics and capital converts to predictable growth, raising becomes rational."
  },
  {
    q: "Should I switch vendors now even though it will be painful, or tolerate the current one?",
    rec: "Switch now if the vendor is a recurring operational risk; otherwise plan a controlled migration.",
    confidence: 79,
    votes: [
      { model: "Model 1", pick: "Switch now" },
      { model: "Model 2", pick: "Controlled migration" },
      { model: "Model 3", pick: "Switch now" }
    ],
    risk: "Staying with a failing vendor compounds hidden costs: downtime, churn, staff burnout, and reactive firefighting.",
    tradeoff: "Switching creates short-term pain (migration + onboarding), but reduces long-term fragility and restores reliability.",
    flip: "If the vendor's issues are temporary and you can enforce SLAs with real penalties, staying can be cheaper."
  },
  {
    q: "Should I add a cofounder for speed, or stay solo and hire contractors?",
    rec: "Stay solo and hire contractors — unless the cofounder is uniquely essential and aligned.",
    confidence: 72,
    votes: [
      { model: "Model 1", pick: "Stay solo" },
      { model: "Model 2", pick: "Add cofounder (dissent)" },
      { model: "Model 3", pick: "Stay solo" }
    ],
    risk: "A misaligned cofounder is hard to remove and can permanently damage the company. Equity is expensive and irreversible.",
    tradeoff: "A cofounder can accelerate execution and morale, but adds governance complexity and long-term partnership risk.",
    flip: "If the cofounder brings rare distribution, domain authority, or execution capacity you can't buy with money, add them."
  },
  {
    q: "Should I sign this client at a lower price to get the logo, or hold the line?",
    rec: "Hold the line — unless the deal creates repeatable distribution and a clean case study.",
    confidence: 83,
    votes: [
      { model: "Model 1", pick: "Hold price" },
      { model: "Model 2", pick: "Hold price" },
      { model: "Model 3", pick: "Discount for logo (dissent)" }
    ],
    risk: "Discounts train the market that your price is negotiable and attract low-quality clients who churn and drain support.",
    tradeoff: "Holding price may lose the deal, but protects positioning and margins. Discounting may win short-term credibility but hurts future pricing.",
    flip: "If the client guarantees a public case study + referrals and you cap the discount tightly, the logo play can be worth it."
  },
  {
    q: "Should I move my family to a cheaper area to reduce stress, or stay for career access?",
    rec: "Reduce stress and stabilize finances — unless staying directly compounds your income and support network.",
    confidence: 70,
    votes: [
      { model: "Model 1", pick: "Cheaper area" },
      { model: "Model 2", pick: "Stay for career access (dissent)" },
      { model: "Model 3", pick: "Cheaper area" }
    ],
    risk: "Chronic financial stress creates decision fatigue and relationship strain that spills into work and health.",
    tradeoff: "Moving can reduce pressure but may reduce proximity to opportunity. Staying keeps access but can keep you trapped.",
    flip: "If your career income is strongly location-dependent and you have a clear promotion/earnings path, staying can win."
  },
  {
    q: "Should I pay off debt aggressively or invest the money instead?",
    rec: "Pay down high-interest debt first; invest only after the debt is no longer a guaranteed loss.",
    confidence: 86,
    votes: [
      { model: "Model 1", pick: "Pay debt" },
      { model: "Model 2", pick: "Pay debt" },
      { model: "Model 3", pick: "Invest (dissent)" }
    ],
    risk: "High-interest debt is a guaranteed negative return. Investing while carrying expensive debt often increases risk without improving net outcomes.",
    tradeoff: "Paying debt is less exciting but safer. Investing may build wealth faster, but only if returns reliably exceed your debt cost.",
    flip: "If debt is low-interest and you have an emergency fund, investing can become the better long-term move."
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

export default function DemoPage() {
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
    <div className="demo-page">
      <div id="top"></div>

      {/* Navigation */}
      <nav className="dp-nav">
        <div className="dp-container dp-between">
          <a href="/" className="dp-logo">
            <span className="dp-mark">&#x2B21;</span>
            <span className="dp-brand">DecidePlease</span>
          </a>
          <div className="dp-nav-actions">
            <a className="dp-link" href="#demo">Example</a>
            <button className="dp-link" type="button" onClick={() => openAuth('signin')}>Log in</button>
            <button className="dp-btn dp-btn-primary" type="button" onClick={() => openAuth('signup')}>Try Free</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="dp-hero">
        <div className="dp-container">
          <h1>One Decision.<br/>Five Models.<br/><span className="dp-grad">One Clear Answer.</span></h1>
          <p>
            You ask once. Multiple top-tier models disagree on your behalf.
            You get one verdict, the risks, the tradeoffs, and what would change the answer.
          </p>

          <div className="dp-strip" aria-label="What you get">
            <div className="dp-strip-item">
              <div className="dp-strip-t">One verdict</div>
              <div className="dp-strip-s">Not 5 opinions</div>
            </div>
            <div className="dp-strip-item">
              <div className="dp-strip-t">Real risks</div>
              <div className="dp-strip-s">What could go wrong</div>
            </div>
            <div className="dp-strip-item">
              <div className="dp-strip-t">Tradeoffs</div>
              <div className="dp-strip-s">What you give up</div>
            </div>
            <div className="dp-strip-item">
              <div className="dp-strip-t">Flip conditions</div>
              <div className="dp-strip-s">What changes the answer</div>
            </div>
          </div>
        </div>
      </header>

      {/* Demo Section */}
      <section className="dp-demo" id="demo">
        <div className="dp-container">
          <div className="dp-demo-grid">
            <div className="dp-demo-left">
              <h2>High-stakes decisions aren't clean.</h2>
              <p>
                This is what DecidePlease is built for: messy choices with real consequences.
                The council doesn't just answer—<strong>it stress-tests</strong> the answer.
              </p>
              <p className="dp-muted" style={{ marginBottom: '12px' }}>
                Click below to see different real-world decisions.
              </p>

              <div className="dp-demo-actions">
                <button className="dp-btn dp-btn-secondary" type="button" onClick={handleNextDemo}>
                  See another decision &#x21bb;
                </button>
              </div>

              <div className="dp-tagrow" aria-label="Where this is used">
                <div className="dp-tag"><strong>Founders:</strong> hires, strategy, pricing</div>
                <div className="dp-tag"><strong>Operators:</strong> vendors, policies</div>
                <div className="dp-tag"><strong>People:</strong> career, money, life</div>
              </div>
            </div>

            <aside className="dp-demo-card" aria-label="Example verdict card">
              <div className="dp-demo-head">
                <div>
                  <div className="dp-kicker">Example output</div>
                  <div className="dp-title">Consensus Verdict</div>
                </div>
                <div className={`dp-badge ${currentDemo.confidence >= 80 ? '' : 'warning'}`}>
                  {currentDemo.confidence}% confidence
                </div>
              </div>

              <div className="dp-demo-body">
                <div className="dp-qline">
                  <span>Q:</span> "{currentDemo.q}"
                </div>

                <div className="dp-verdict">
                  <div className="dp-dot"></div>
                  <div>
                    <div className="dp-vlabel">Recommendation</div>
                    <div className="dp-vtext">{currentDemo.rec}</div>
                  </div>
                </div>

                <div className="dp-votes" aria-label="Model votes">
                  {currentDemo.votes.map((v, i) => {
                    const isDissent = v.pick.toLowerCase().includes('dissent');
                    return (
                      <div key={i} className={`dp-vote ${isDissent ? 'dissent' : ''}`}>
                        <span className={`dp-vdot ${isDissent ? 'b' : 'a'}`}></span>
                        <span className="dp-vmodel">{v.model}</span>
                        <span className="dp-vpick">{v.pick}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="dp-box">
                  <div className="dp-bl">Primary risk</div>
                  <div className="dp-bt risk">{currentDemo.risk}</div>
                </div>

                <div className="dp-box">
                  <div className="dp-bl">Tradeoff</div>
                  <div className="dp-bt trade">{currentDemo.tradeoff}</div>
                </div>

                <div className="dp-box">
                  <div className="dp-bl">Flip condition</div>
                  <div className="dp-bt flip">{currentDemo.flip}</div>
                </div>

                <div className="dp-foot">Consulted: Top-tier models (GPT, Claude, Gemini + specialist)</div>

                <div className="dp-demo-actions" style={{ marginTop: '14px' }}>
                  <button className="dp-btn dp-btn-primary" type="button" onClick={() => openAuth('signup')}>
                    Run your own decision
                  </button>
                </div>
                <div className="dp-subnote">No credit card • 5 free queries</div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="dp-final">
        <div className="dp-container">
          <h2>Run your decision. Get closure.</h2>
          <p>
            Don't settle for a single-model opinion on something that matters.
            Ask once. Let the council disagree. Get a verdict you can act on.
          </p>
          <div className="dp-cta-row">
            <button className="dp-btn dp-btn-primary" type="button" onClick={() => openAuth('signup')}>
              Run your own decision
            </button>
            <a className="dp-btn dp-btn-secondary" href="#top" style={{ textDecoration: 'none' }}>
              Back to top
            </a>
          </div>
          <div className="dp-fineprint">You'll get: verdict • risks • tradeoffs • flip conditions • next steps</div>
        </div>
      </section>

      {/* Footer */}
      <footer className="dp-footer">
        &copy; 2026 DecidePlease. Built for serious decisions.
      </footer>

      {/* Auth Modal */}
      {showAuth && (
        <div className="dp-auth-modal" onClick={() => setShowAuth(false)}>
          <div className="dp-auth-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="dp-auth-close" onClick={() => setShowAuth(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {authMode === 'signin' ? (
              <>
                <SignIn
                  routing="virtual"
                  afterSignInUrl="/"
                  appearance={{
                    elements: {
                      rootBox: { width: '100%' },
                      card: {
                        background: 'transparent',
                        boxShadow: 'none',
                        border: 'none',
                        margin: 0,
                        padding: 0,
                      },
                    },
                  }}
                />
                <p className="dp-auth-toggle">
                  Don't have an account?{' '}
                  <button onClick={() => setAuthMode('signup')}>Sign up</button>
                </p>
              </>
            ) : (
              <>
                <SignUp
                  routing="virtual"
                  afterSignUpUrl="/"
                  appearance={{
                    elements: {
                      rootBox: { width: '100%' },
                      card: {
                        background: 'transparent',
                        boxShadow: 'none',
                        border: 'none',
                        margin: 0,
                        padding: 0,
                      },
                    },
                  }}
                />
                <p className="dp-auth-toggle">
                  Already have an account?{' '}
                  <button onClick={() => setAuthMode('signin')}>Sign in</button>
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
