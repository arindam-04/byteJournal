import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight, ArrowUp, CheckCircle2, Code2, Github, Linkedin,
  Mail, Send, Youtube
} from 'lucide-react';
import { api } from '../api';
import './Footer.css';

const quickLinks = [
  { label: 'Home', to: '/' },
  { label: 'Articles', to: '/articles' },
  { label: 'Categories', to: '/categories' },
  { label: 'About Us', to: '/about' },
  { label: 'Contact', to: '/contact' },
  { label: 'Become an Author', to: '/become-author' }
];

const topics = [
  ['Web Development','/categories/web-development'], ['Programming','/categories/programming-languages'],
  ['AI & Machine Learning','/categories/artificial-intelligence'], ['Cybersecurity','/categories/cybersecurity'],
  ['Cloud Computing','/categories/cloud-computing-devops'], ['System Design','/categories/system-design'],
  ['Databases','/categories/database-management']
];

const resources = [
  ['Tutorials','/tutorials'], ['Developer Guides','/tutorials?format=guide'],
  ['Code Examples','/tutorials?format=example'], ['FAQs','/faqs']
];

function XBrandIcon({ size = 17 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.901 1.153h3.68L14.54 10.11 24 22.847h-7.406l-5.8-7.584-6.637 7.584H.475l8.6-9.83L0 1.153h7.594l5.242 6.932 6.065-6.932Zm-1.29 19.45h2.039L6.486 3.28H4.298l13.313 17.323Z" /></svg>;
}

const socialLinks = [
  { label: 'GitHub', href: 'https://github.com/', Icon: Github },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/', Icon: Linkedin },
  { label: 'X (Twitter)', href: 'https://x.com/', Icon: XBrandIcon },
  { label: 'YouTube', href: 'https://www.youtube.com/', Icon: Youtube }
];

const legalLinks = [
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Terms & Conditions', to: '/terms' },
  { label: 'Cookie Policy', to: '/cookie-policy' },
  { label: 'Disclaimer', to: '/disclaimer' }
];

export default function Footer({ siteName = 'ByteJournal', tagline, logoUrl = '' }) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  async function handleSubscribe(event) {
    event.preventDefault();
    if (!consent) {
      setStatus({ type: 'error', message: 'Please agree to receive email updates before subscribing.' });
      return;
    }
    setStatus({ type: 'loading', message: '' });
    try {
      const result = await api.newsletterSubscribe(email.trim(), consent);
      setStatus({ type: 'success', message: result.message || 'Thanks — your email has been added to the ByteJournal subscriber list.' });
      setEmail('');
      setConsent(false);
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Subscription failed. Please try again.' });
    }
  }

  function backToTop() {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  return (
    <footer className="site-footer" id="site-footer">
      <div className="footer-shell">
        <div className="footer-main-grid">
          <section className="footer-brand-column" aria-label={`${siteName} information`}>
            <Link to="/" className="footer-brand brand">
              <span className="brand-mark">{logoUrl ? <img src={api.assetUrl(logoUrl)} alt="" /> : <Code2 size={19} aria-hidden="true" />}</span>
              <span>{siteName}<span className="brand-dot">.</span></span>
            </Link>
            <p className="footer-tagline">{tagline ? `${tagline} — Technology, programming, software development, AI, and ideas shaping innovation.` : 'A journal for curious builders exploring technology, programming, software development, AI, and the ideas shaping what comes next.'}</p>
            <div className="footer-socials" aria-label="Social media">
              {socialLinks.map(({ label, href, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer noopener" aria-label={`${label} (opens in a new tab)`} title={label}>
                  <Icon size={17} aria-hidden="true" />
                </a>
              ))}
            </div>
            <span className="footer-brand-note"><span className="footer-live-dot" /> INDEPENDENT ENGINEERING PUBLICATION</span>
          </section>

          <nav className="footer-link-column" aria-label="Quick links">
            <h2>Explore ByteJournal</h2>
            <ul>
              {quickLinks.map((item) => <li key={item.label}>
                <Link to={item.to}>{item.label}</Link>
              </li>)}
            </ul>
          </nav>

          <nav className="footer-link-column" aria-label="Explore topics">
            <h2>Explore Topics</h2>
            <ul>{topics.map(([topic,to]) => <li key={topic}><Link to={to}>{topic}</Link></li>)}</ul>
          </nav>

          <nav className="footer-link-column footer-resources-column" aria-label="Resources">
            <h2>Resources</h2>
            <ul>{resources.map(([resource,to]) => <li key={resource}><Link to={to}>{resource}</Link></li>)}</ul>
            <Link className="footer-write-link" to="/become-author">Share your knowledge <ArrowUpRight size={14} aria-hidden="true" /></Link>
          </nav>

          <section className="footer-newsletter-column" aria-labelledby="footer-newsletter-title">
            <div className="footer-newsletter-copy">
              <span className="footer-eyebrow"><Mail size={13} aria-hidden="true" /> THE BYTEJOURNAL DISPATCH</span>
              <h2 id="footer-newsletter-title">Fresh ideas for your <em>next build.</em></h2>
              <p>Join the reader list for future notes on software, AI, and engineering.</p>
            </div>
            <form className="footer-newsletter-form" onSubmit={handleSubscribe}>
              <label className="sr-only" htmlFor="footer-newsletter-email">Email address</label>
              <div className="footer-email-row">
                <input
                  id="footer-newsletter-email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  maxLength={254}
                  required
                  disabled={status.type === 'loading'}
                />
                <button type="submit" disabled={status.type === 'loading'}>
                  {status.type === 'loading' ? 'Subscribing…' : 'Subscribe'}
                  <Send size={14} aria-hidden="true" />
                </button>
              </div>
              <label className="footer-consent">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={status.type === 'loading'} />
                <span>I agree to receive ByteJournal email updates. See our Privacy Policy for details.</span>
              </label>
              <p className={`footer-form-message footer-form-${status.type}`} role="status" aria-live="polite">
                {status.type === 'success' && <CheckCircle2 size={14} aria-hidden="true" />}
                {status.message}
              </p>
            </form>
          </section>
        </div>

        <div className="footer-bottom-row">
          <p className="footer-copy">© {new Date().getFullYear()} {siteName}. All rights reserved.</p>
          <nav className="footer-legal-links" aria-label="Legal">
            {legalLinks.map((item) => <Link key={item.to} to={item.to}>{item.label}</Link>)}
          </nav>
          <button className="footer-back-top" type="button" onClick={backToTop}>
            Back to top <span><ArrowUp size={14} aria-hidden="true" /></span>
          </button>
        </div>
      </div>
    </footer>
  );
}
