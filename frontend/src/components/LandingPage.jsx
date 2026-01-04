import { useState, useEffect } from 'react';
import UnifiedHeader from './UnifiedHeader';
import UnifiedFooter from './UnifiedFooter';
import AuthModal from './AuthModal';
import './LandingPage.css';

// SVG Icons matching reference design
const MessageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="step-icon">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
  </svg>
);

const BrainIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="step-icon">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
  </svg>
);

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="step-icon">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
  </svg>
);

const GavelIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="step-icon">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971Z" />
  </svg>
);

const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="bot-icon">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
  </svg>
);

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="lock-icon">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>
);

const MailIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mail-icon">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="arrow-icon">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="check-icon">
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
);

const AlertTriangleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="alert-icon">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
);

const ArrowCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="action-icon">
    <path strokeLinecap="round" strokeLinejoin="round" d="m12.75 15 3-3m0 0-3-3m3 3h-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="sparkles-icon">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
  </svg>
);

export default function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [capturedEmail, setCapturedEmail] = useState('');
  const [emailInput, setEmailInput] = useState('');

  const openAuth = (mode) => {
    setAuthMode(mode);
    setShowAuth(true);
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (emailInput.trim()) {
      setCapturedEmail(emailInput);
      setShowEmailForm(false);
      openAuth('signup');
    }
  };

  const toggleEmailForm = () => {
    setShowEmailForm(!showEmailForm);
    setEmailInput('');
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToTopAndOpenForm = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setShowEmailForm(true), 600);
  };

  return (
    <div className="landing">
      <UnifiedHeader isSignedIn={false} onOpenAuth={openAuth} />

      <main className="landing-main">
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-glow"></div>

          <div className="hero-content fade-in-up">
            {/* Badge */}
            <div className="hero-badge">
              <span className="badge-dot"></span>
              <span className="badge-text">AI Council Consensus Engine</span>
            </div>

            {/* Headline */}
            <h1 className="hero-title">
              One Decision.<br />
              Five Models.<br />
              <span className="text-gradient">One Clear Answer.</span>
            </h1>

            {/* Subtext */}
            <p className="hero-sub">
              Don't rely on a single hallucination. We force ChatGPT, Claude, Gemini, Grok, and DeepSeek to debate your problem, finding the hidden risks and forming a consensus verdict.
            </p>

            {/* CTA Section */}
            <div className="hero-cta-container">
              {!showEmailForm ? (
                <div className="hero-cta-buttons">
                  <button className="btn-primary btn-large btn-glow" onClick={toggleEmailForm}>
                    Get 5 Free Credits
                    <ArrowRightIcon />
                  </button>
                  <button className="btn-secondary btn-large" onClick={() => scrollToSection('demo')}>
                    View Sample Verdict
                  </button>
                </div>
              ) : (
                <div className="hero-email-form form-enter">
                  <form onSubmit={handleEmailSubmit} className="email-form">
                    <div className="email-form-glow"></div>
                    <div className="email-form-inner">
                      <MailIcon />
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="Enter your email"
                        required
                        autoFocus
                      />
                      <button type="submit" className="email-submit-btn">
                        <ArrowRightIcon />
                      </button>
                    </div>
                  </form>
                  <button className="cancel-link" onClick={toggleEmailForm}>
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <p className="hero-note">No credit card required. Instant analysis.</p>
          </div>

          {/* Hero Visual: Browser Mock */}
          <div className="hero-visual fade-in-up delay-1">
            <div className="browser-mock-outer">
              <div className="browser-mock">
                {/* Browser Header */}
                <div className="browser-header">
                  <div className="browser-dots">
                    <div className="dot red"></div>
                    <div className="dot yellow"></div>
                    <div className="dot green"></div>
                  </div>
                  <div className="browser-url">
                    <LockIcon />
                    <span>decideplease.com/council/live-session</span>
                  </div>
                </div>

                {/* Browser Content */}
                <div className="browser-content">
                  {/* Left: Live Deliberation */}
                  <div className="deliberation-panel">
                    <h3 className="panel-label">Live Deliberation</h3>

                    <div className="orbit-container">
                      <div className="agent-orbit">
                        {/* Agent 1: ChatGPT */}
                        <div className="agent-node pos-1 chatgpt">
                          <BotIcon />
                        </div>
                        {/* Agent 2: Claude */}
                        <div className="agent-node pos-2 claude">
                          <BotIcon />
                        </div>
                        {/* Agent 3: Gemini */}
                        <div className="agent-node pos-3 gemini">
                          <BotIcon />
                        </div>
                        {/* Agent 4: Grok */}
                        <div className="agent-node pos-4 grok">
                          <BotIcon />
                        </div>
                        {/* Agent 5: DeepSeek */}
                        <div className="agent-node pos-5 deepseek">
                          <BotIcon />
                        </div>
                      </div>

                      {/* Center: Consensus */}
                      <div className="consensus-center">
                        <BrainIcon />
                        <span>Consensus</span>
                      </div>

                      {/* Connection rings */}
                      <div className="orbit-ring ring-1"></div>
                      <div className="orbit-ring ring-2"></div>
                    </div>

                    <p className="analyzing-text">Analyzing Risk Vectors...</p>
                  </div>

                  {/* Right: Query & Verdict */}
                  <div className="verdict-panel">
                    <div className="query-section">
                      <h3 className="panel-label">Your Query</h3>
                      <div className="query-box">
                        "Should we migrate our startup's backend from Python/Django to Go? We have 3 Django devs, getting traction, but performance is becoming a concern."
                      </div>
                    </div>

                    <div className="verdict-section">
                      <div className="verdict-header-row">
                        <div className="verdict-indicator">
                          <span className="indicator-dot"></span>
                          <h3 className="verdict-label">Consensus Verdict</h3>
                        </div>
                        <span className="confidence-badge">Confidence: 92%</span>
                      </div>

                      <p className="verdict-title">Stick with Django (for now).</p>
                      <p className="verdict-text">
                        The council unanimously agrees that rewriting in Go is premature optimization. Your bottleneck is likely database queries, not language speed. Rewriting now risks stalling product momentum for 3+ months with a small team.
                      </p>

                      <div className="insight-boxes">
                        <div className="insight-box risk">
                          <div className="insight-header">
                            <AlertTriangleIcon />
                            <span>Primary Risk</span>
                          </div>
                          <p>Loss of feature velocity during migration window could kill startup momentum.</p>
                        </div>
                        <div className="insight-box action">
                          <div className="insight-header">
                            <ArrowCircleIcon />
                            <span>Action Plan</span>
                          </div>
                          <p>Optimize DB indexes first. If Go is needed later, migrate microservices only.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Strip */}
        <div className="trust-strip">
          <p className="trust-label">Optimized for high-stakes decisions</p>
          <div className="trust-pills">
            <span className="trust-pill">Technical Architecture</span>
            <span className="trust-pill">Legal Clause Review</span>
            <span className="trust-pill">Candidate Evaluation</span>
            <span className="trust-pill">Strategic Pivots</span>
          </div>
        </div>

        {/* How It Works Section */}
        <section className="how-section" id="how">
          <div className="how-container">
            <div className="how-grid">
              {/* Left: Process Steps */}
              <div className="how-process">
                <h2>How the Council Deliberates</h2>
                <p className="how-intro">We've automated the process of "Red Teaming." You get the combined intelligence of the world's best models without the noise.</p>

                <div className="steps-container">
                  <div className="steps-line"></div>

                  <div className="process-step">
                    <div className="step-icon-wrapper">
                      <MessageIcon />
                    </div>
                    <div className="step-content">
                      <h3>1. You Ask Once</h3>
                      <p>Describe your dilemma. No fancy prompt engineering needed. Just state the facts and the tradeoff you are facing.</p>
                    </div>
                  </div>

                  <div className="process-step">
                    <div className="step-icon-wrapper">
                      <BrainIcon />
                    </div>
                    <div className="step-content">
                      <h3>2. Independent Deliberation</h3>
                      <p>Five models (GPT-4o, Claude 3.5, etc.) analyze your request in isolation to prevent groupthink bias.</p>
                    </div>
                  </div>

                  <div className="process-step">
                    <div className="step-icon-wrapper">
                      <UsersIcon />
                    </div>
                    <div className="step-content">
                      <h3>3. Anonymous Peer Review</h3>
                      <p>Models critique each other's reasoning anonymously. Weak arguments are discarded; strong counter-points are elevated.</p>
                    </div>
                  </div>

                  <div className="process-step">
                    <div className="step-icon-wrapper">
                      <GavelIcon />
                    </div>
                    <div className="step-content">
                      <h3>4. The Verdict</h3>
                      <p>A Chairman model synthesizes the debate into one clear answer, highlighting the dissent and action items.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Model Analysis Matrix */}
              <div className="matrix-wrapper">
                <div className="matrix-card">
                  <div className="matrix-header">
                    <h4>Model Analysis Matrix</h4>
                    <div className="matrix-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>

                  <div className="model-rows">
                    <div className="model-row">
                      <div className="model-info">
                        <div className="model-avatar chatgpt">
                          <BotIcon />
                        </div>
                        <div className="model-details">
                          <span className="model-name">ChatGPT</span>
                          <span className="model-focus">Focus: Efficiency</span>
                        </div>
                      </div>
                      <span className="vote-badge yes">Vote: YES</span>
                    </div>

                    <div className="model-row">
                      <div className="model-info">
                        <div className="model-avatar claude">
                          <BotIcon />
                        </div>
                        <div className="model-details">
                          <span className="model-name">Claude</span>
                          <span className="model-focus">Focus: Safety</span>
                        </div>
                      </div>
                      <span className="vote-badge yes">Vote: YES</span>
                    </div>

                    <div className="model-row dissent">
                      <div className="model-info">
                        <div className="model-avatar gemini dissent">
                          <BotIcon />
                        </div>
                        <div className="model-details">
                          <span className="model-name">Gemini</span>
                          <span className="model-focus dissent">Flags Risk</span>
                        </div>
                      </div>
                      <span className="vote-badge no">Vote: NO</span>
                    </div>
                  </div>

                  <div className="dissent-notice">
                    <div className="dissent-icon">
                      <SparklesIcon />
                    </div>
                    <div className="dissent-content">
                      <span className="dissent-title">Dissent Detected</span>
                      <p>Gemini identified a critical security flaw in the proposed approach that other models missed. The final verdict has been adjusted to address this risk.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Demo Section */}
        <section className="demo-section" id="demo">
          {/* This section is largely kept from the original for demo shuffling functionality */}
        </section>

        {/* Pricing Section */}
        <section className="pricing-section" id="pricing">
          <div className="pricing-container">
            <div className="pricing-header">
              <h2>Simple, Credit-Based Pricing</h2>
              <p>1 Credit = 1 Full Council Run (Multi-model debate + Verdict + Action Plan)</p>
            </div>

            <div className="pricing-cards">
              {/* Free */}
              <div className="p-card">
                <h3>Trial</h3>
                <div className="p-price">$0</div>
                <ul className="p-features">
                  <li><CheckIcon /> 5 Free Credits</li>
                  <li><CheckIcon /> Access to all 5 Models</li>
                  <li><CheckIcon /> Standard Speed</li>
                </ul>
                <button className="btn-secondary" onClick={() => openAuth('signup')}>
                  Try Free
                </button>
              </div>

              {/* Starter - Featured */}
              <div className="p-card featured">
                <div className="p-badge">Most Popular</div>
                <h3>Starter</h3>
                <div className="p-price">$5</div>
                <ul className="p-features">
                  <li><CheckIcon /> 20 Credits</li>
                  <li><CheckIcon /> Credits Never Expire</li>
                  <li><CheckIcon /> Priority Processing</li>
                  <li><CheckIcon /> Save History</li>
                </ul>
                <button className="btn-primary" onClick={() => openAuth('signup')}>
                  Get Starter
                </button>
              </div>

              {/* Pro */}
              <div className="p-card">
                <h3>Pro</h3>
                <div className="p-price">$15</div>
                <ul className="p-features">
                  <li><CheckIcon /> 100 Credits</li>
                  <li><CheckIcon /> Credits Never Expire</li>
                  <li><CheckIcon /> Max Priority</li>
                </ul>
                <button className="btn-secondary" onClick={() => openAuth('signup')}>
                  Get Pro
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Footer Section */}
        <section className="cta-footer-section">
          <div className="cta-footer-container">
            <h2>Stop guessing. Start knowing.</h2>
            <p>Join thousands of engineers, founders, and managers making better decisions with AI consensus.</p>
            <button className="btn-primary btn-large" onClick={scrollToTopAndOpenForm}>
              Run your first decision
            </button>
          </div>
        </section>
      </main>

      <UnifiedFooter />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        initialMode={authMode === 'signin' ? 'login' : 'register'}
        initialEmail={capturedEmail}
      />
    </div>
  );
}
