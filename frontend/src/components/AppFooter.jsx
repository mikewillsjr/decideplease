import './AppFooter.css';

export default function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-left">
          <span className="footer-copyright">
            &copy; {currentYear} DecidePlease
          </span>
        </div>
        <nav className="footer-nav">
          <a href="/" className="footer-link">Home</a>
          <a href="/blog" className="footer-link">Blog</a>
          <a href="/privacy" className="footer-link">Privacy</a>
          <a href="/terms" className="footer-link">Terms</a>
        </nav>
      </div>
    </footer>
  );
}
