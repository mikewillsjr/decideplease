import UnifiedHeader from './UnifiedHeader';
import UnifiedFooter from './UnifiedFooter';
import './LegalPages.css';

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <UnifiedHeader />
      <main className="legal-content">
        <div className="legal-container">
          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last updated: January 2025</p>

          <section>
            <h2>Introduction</h2>
            <p>
              DecidePlease ("we," "our," or "us") is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you use our AI-powered decision-making service.
            </p>
          </section>

          <section>
            <h2>Information We Collect</h2>

            <h3>Account Information</h3>
            <p>When you create an account, we collect:</p>
            <ul>
              <li>Email address</li>
              <li>Password (stored securely using bcrypt hashing)</li>
              <li>Account creation date</li>
            </ul>

            <h3>Decision Queries</h3>
            <p>When you use our service, we collect:</p>
            <ul>
              <li>The questions and decisions you submit for analysis</li>
              <li>AI-generated responses and recommendations</li>
              <li>Timestamps and usage patterns</li>
            </ul>

            <h3>Payment Information</h3>
            <p>
              Payment processing is handled by Stripe. We do not store your credit card
              details. We retain:
            </p>
            <ul>
              <li>Transaction history (amount, date, credit purchases)</li>
              <li>Stripe customer and payment identifiers</li>
            </ul>

            <h3>Technical Data</h3>
            <p>We automatically collect:</p>
            <ul>
              <li>IP address (for rate limiting and security)</li>
              <li>Browser type and version</li>
              <li>Device information</li>
            </ul>
          </section>

          <section>
            <h2>How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Provide and improve our AI decision-making service</li>
              <li>Process your queries through multiple AI models</li>
              <li>Manage your account and credit balance</li>
              <li>Process payments and send receipts</li>
              <li>Send password reset emails when requested</li>
              <li>Protect against fraud and abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2>Third-Party Services</h2>
            <p>We use the following third-party services:</p>

            <h3>OpenRouter</h3>
            <p>
              Your decision queries are sent to multiple AI models (GPT, Claude, Gemini, etc.)
              via OpenRouter. OpenRouter processes your queries according to their privacy policy.
              We do not share your email or account information with OpenRouter.
            </p>

            <h3>Stripe</h3>
            <p>
              Payment processing is handled by Stripe. Your payment information is processed
              according to Stripe's Privacy Policy. We never have access to your full credit
              card number.
            </p>

            <h3>Resend</h3>
            <p>
              Transactional emails (password resets, purchase confirmations) are sent via
              Resend. Your email address is shared with Resend for this purpose.
            </p>
          </section>

          <section>
            <h2>Data Retention</h2>
            <p>
              We retain your account data and decision history for as long as your account
              is active. You may request deletion of your account and associated data at
              any time by contacting us.
            </p>
          </section>

          <section>
            <h2>Data Security</h2>
            <p>We implement security measures including:</p>
            <ul>
              <li>Encrypted connections (HTTPS/TLS)</li>
              <li>Secure password hashing (bcrypt)</li>
              <li>Rate limiting to prevent abuse</li>
              <li>Regular security reviews</li>
            </ul>
          </section>

          <section>
            <h2>Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data</li>
              <li>Withdraw consent for marketing communications</li>
            </ul>
            <p>
              To exercise these rights, please contact us at privacy@decideplease.com.
            </p>
          </section>

          <section>
            <h2>Cookies</h2>
            <p>
              We use essential cookies to maintain your login session. We do not use
              tracking cookies or third-party analytics cookies.
            </p>
          </section>

          <section>
            <h2>Children's Privacy</h2>
            <p>
              Our service is not intended for children under 13. We do not knowingly
              collect personal information from children under 13.
            </p>
          </section>

          <section>
            <h2>Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you
              of significant changes by email or by posting a notice on our website.
            </p>
          </section>

          <section>
            <h2>Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <p className="contact-info">
              <strong>Email:</strong> privacy@decideplease.com
            </p>
          </section>
        </div>
      </main>
      <UnifiedFooter />
    </div>
  );
}
