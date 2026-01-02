import { useState } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import './LandingPage.css';

export default function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('signin');

  const openAuth = (mode) => {
    setAuthMode(mode);
    setShowAuth(true);
  };

  return (
    <div className="landing">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="logo">
            <span className="logo-icon">&#x2B21;</span>
            <span className="logo-text">DecidePlease</span>
          </div>
          <div className="nav-actions">
            <a href="#demo" className="btn-link">Example</a>
            <button className="btn-link" onClick={() => openAuth('signin')}>Log in</button>
            <button className="btn-primary" onClick={() => openAuth('signup')}>Try Free</button>
          </div>
        </div>
      </nav>

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
              <button className="btn-secondary" onClick={() => openAuth('signup')}>
                Run your own decision &rarr;
              </button>
            </div>

            <div className="verdict-card">
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

                <div className="insight-box">
                  <div className="ib-label">Disagreement Summary</div>
                  <div className="ib-text">
                    2 models favored Next.js for SEO/Performance. 1 model strongly argued for React Router due to team velocity concerns.
                  </div>
                </div>

                <div className="insight-box risk">
                  <div className="ib-label">Primary Risk</div>
                  <div className="ib-text">
                    Migration complexity may pause feature work. If short-term speed is critical, this recommendation fails.
                  </div>
                </div>

                <div className="insight-box flip">
                  <div className="ib-label">Flip Condition</div>
                  <div className="ib-text">
                    If SEO is not a top priority, the verdict flips to <strong>React Router</strong> to reduce overhead.
                  </div>
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

      {/* Footer */}
      <footer className="landing-footer">
        &copy; 2026 DecidePlease. Built for serious decisions.
      </footer>

      {/* Auth Modal */}
      {showAuth && (
        <div className="auth-modal" onClick={() => setShowAuth(false)}>
          <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="auth-close" onClick={() => setShowAuth(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {authMode === 'signin' ? (
              <>
                <SignIn afterSignInUrl="/" />
                <p className="auth-toggle">
                  Don't have an account?{' '}
                  <button onClick={() => setAuthMode('signup')}>Sign up</button>
                </p>
              </>
            ) : (
              <>
                <SignUp afterSignUpUrl="/" />
                <p className="auth-toggle">
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
