import { useNavigate } from 'react-router-dom';
import '../styles/Footer.css';

export default function Footer() {
  const navigate = useNavigate();

  const handleNavigation = (path) => {
    navigate(path);
    window.scrollTo(0, 0);
  };

  return (
    <footer className="footer">

      {/* ── Main grid ── */}
      <div className="footer-container">

        {/* Brand column */}
        <div className="footer-brand">
          <div className="footer-logo">GigFlow</div>
          <p className="footer-description">
            A modern platform connecting skilled freelancers with clients who need
            work done — faster, smarter, and better.
          </p>
          <span className="footer-badge">🚀 Trusted by thousands of clients</span>
        </div>

        {/* Quick Links */}
        <div className="footer-col">
          <h3 className="footer-heading">Platform</h3>
          <ul className="footer-links">
            <li>
              <button className="footer-link" onClick={() => handleNavigation('/')}>
                Home
              </button>
            </li>
            <li>
              <button className="footer-link" onClick={() => handleNavigation('/explore')}>
                Explore Gigs
              </button>
            </li>
            <li>
              <button className="footer-link" onClick={() => handleNavigation('/become-seller')}>
                Become a Seller
              </button>
            </li>
            <li>
              <button className="footer-link" onClick={() => handleNavigation('/login')}>
                Login
              </button>
            </li>
          </ul>
        </div>

        {/* Help */}
        <div className="footer-col">
          <h3 className="footer-heading">Help</h3>
          <ul className="footer-links">
            <li><a href="#faq"     className="footer-link">FAQ</a></li>
            <li><a href="#support" className="footer-link">Support</a></li>
            <li><a href="#contact" className="footer-link">Contact Us</a></li>
            <li><a href="#privacy" className="footer-link">Privacy Policy</a></li>
          </ul>
        </div>

        {/* Social */}
        <div className="footer-col">
          <h3 className="footer-heading">Follow Us</h3>
          <div className="social-links">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              title="Twitter / X"
            >
              𝕏
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              title="LinkedIn"
            >
              in
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              title="GitHub"
            >
              GH
            </a>
          </div>
        </div>

      </div>

      {/* ── Bottom bar ── */}
      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <p className="footer-copy">© 2026 GigFlow. All rights reserved.</p>
          <nav className="footer-legal">
            <a href="#terms">Terms of Service</a>
            <a href="#privacy">Privacy Policy</a>
            <a href="#cookies">Cookies</a>
          </nav>
        </div>
      </div>

    </footer>
  );
}