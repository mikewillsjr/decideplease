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
        <div className="nav-logo">
          <span className="logo-icon">D</span>
          <span className="logo-text">DecidePlease</span>
        </div>
        <div className="nav-actions">
          <button className="nav-link" onClick={() => openAuth('signin')}>Sign In</button>
          <button className="nav-cta" onClick={() => openAuth('signup')}>Get Started Free</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-badge">Powered by 5 Leading AI Models</div>
        <h1 className="hero-title">
          Don't ask <em>one</em> AI.<br />
          <span className="title-highlight">Consult the council.</span>
        </h1>
        <p className="hero-subtitle">
          Get answers vetted by ChatGPT, Claude, Gemini, Grok & DeepSeek working together.
          They debate. They rank. They synthesize. You get the truth.
        </p>
        <div className="hero-cta-group">
          <button className="hero-cta primary" onClick={() => openAuth('signup')}>
            Start with 5 Free Queries
          </button>
          <a href="#how-it-works" className="hero-cta secondary">
            See How It Works
          </a>
        </div>

        {/* Visual Element */}
        <div className="hero-visual">
          <div className="council-ring">
            <div className="model-node" style={{ '--i': 0 }}>
              <span className="node-label">ChatGPT</span>
            </div>
            <div className="model-node" style={{ '--i': 1 }}>
              <span className="node-label">Claude</span>
            </div>
            <div className="model-node" style={{ '--i': 2 }}>
              <span className="node-label">Gemini</span>
            </div>
            <div className="model-node" style={{ '--i': 3 }}>
              <span className="node-label">Grok</span>
            </div>
            <div className="model-node" style={{ '--i': 4 }}>
              <span className="node-label">DeepSeek</span>
            </div>
            <div className="council-center">
              <span>Your Answer</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works" id="how-it-works">
        <div className="section-header">
          <span className="section-number">01</span>
          <h2>How It Works</h2>
          <p>Three stages. Five models. One superior answer.</p>
        </div>

        <div className="stages">
          <div className="stage">
            <div className="stage-number">1</div>
            <div className="stage-content">
              <h3>Independent Analysis</h3>
              <p>Your question goes to all five AI models simultaneously. Each responds without seeing the others - pure, unbiased perspectives.</p>
              <div className="stage-visual">
                <div className="sv-dot"></div>
                <div className="sv-dot"></div>
                <div className="sv-dot"></div>
                <div className="sv-dot"></div>
                <div className="sv-dot"></div>
              </div>
            </div>
          </div>

          <div className="stage">
            <div className="stage-number">2</div>
            <div className="stage-content">
              <h3>Anonymous Peer Review</h3>
              <p>Each model evaluates and ranks the others' answers - anonymously. No favoritism. Just merit-based judgment on accuracy and insight.</p>
              <div className="stage-visual review">
                <div className="sv-line"></div>
                <div className="sv-line"></div>
                <div className="sv-line"></div>
              </div>
            </div>
          </div>

          <div className="stage">
            <div className="stage-number">3</div>
            <div className="stage-content">
              <h3>Chairman Synthesis</h3>
              <p>A chairman model weighs all responses and rankings to deliver one authoritative answer - the collective wisdom of AI's best minds.</p>
              <div className="stage-visual final">
                <div className="sv-diamond"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Section */}
      <section className="why-section">
        <div className="why-content">
          <span className="section-number">02</span>
          <h2>Why a council?</h2>
          <div className="why-grid">
            <div className="why-item">
              <div className="why-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4>Reduce Hallucinations</h4>
              <p>When models cross-check each other, errors get caught.</p>
            </div>
            <div className="why-item">
              <div className="why-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                </svg>
              </div>
              <h4>Diverse Perspectives</h4>
              <p>Each model has unique training. Together, they cover blind spots.</p>
            </div>
            <div className="why-item">
              <div className="why-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4>Ranked Quality</h4>
              <p>See which models perform best on your specific question.</p>
            </div>
            <div className="why-item">
              <div className="why-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h4>Full Transparency</h4>
              <p>See every response, every ranking, every step of the process.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing" id="pricing">
        <div className="section-header">
          <span className="section-number">03</span>
          <h2>Simple Pricing</h2>
          <p>Start free. Pay only when you need more.</p>
        </div>

        <div className="pricing-cards">
          <div className="pricing-card free">
            <div className="card-header">
              <h3>Free Trial</h3>
              <div className="price">
                <span className="amount">$0</span>
              </div>
            </div>
            <ul className="features">
              <li>5 council queries</li>
              <li>All 5 AI models</li>
              <li>Full 3-stage process</li>
              <li>No credit card required</li>
            </ul>
            <button className="card-cta" onClick={() => openAuth('signup')}>
              Get Started
            </button>
          </div>

          <div className="pricing-card pro">
            <div className="popular-badge">Most Popular</div>
            <div className="card-header">
              <h3>Credit Pack</h3>
              <div className="price">
                <span className="amount">$5</span>
                <span className="period">/ 20 queries</span>
              </div>
            </div>
            <ul className="features">
              <li>20 council queries</li>
              <li>All 5 AI models</li>
              <li>Full 3-stage process</li>
              <li>Credits never expire</li>
              <li>Buy anytime you need more</li>
            </ul>
            <button className="card-cta primary" onClick={() => openAuth('signup')}>
              Start Free, Upgrade Later
            </button>
          </div>
        </div>

        <p className="pricing-note">
          That's just $0.25 per query - less than a single premium ChatGPT request,
          but with 5 models working together.
        </p>
      </section>

      {/* CTA Section */}
      <section className="final-cta">
        <h2>Ready for better answers?</h2>
        <p>Join thousands getting smarter responses from AI.</p>
        <button className="hero-cta primary large" onClick={() => openAuth('signup')}>
          Try 5 Free Queries
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="logo-icon small">D</span>
            <span>DecidePlease</span>
          </div>
          <p className="footer-tagline">Collective AI wisdom for better decisions.</p>
        </div>
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
