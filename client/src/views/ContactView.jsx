import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';

const initial = { name: '', email: '', subject: '', message: '', website: '' };

export default function ContactView() {
  const page=useSitePageContent('contact');
  useEffect(() => { document.title = `${page.title||'Contact'} | ByteJournal`; }, [page.title]);
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setStatus({ type: 'loading', message: '' });
    try {
      const result = await api.sendContactMessage(values);
      setStatus({ type: 'success', message: result.message || 'Thanks for reaching out. Your message has been received.' });
      setValues(initial);
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Your message could not be sent. Please try again.' });
    }
  }

  return (
    <main className="contact-page">
      <Link className="text-link" to="/"><ArrowLeft size={14} /> Back to ByteJournal</Link>
      <span className="section-kicker" style={{ display: 'block', marginTop: 34 }}>START A CONVERSATION /  CONTACT</span>
      <h1>{page.title||<>Let’s talk <em>technology.</em></>}</h1>
      <p className="contact-page-intro">{page.intro||'Have a question, correction, collaboration idea, or feedback about an article? Send the ByteJournal team a note.'}</p>
      <SitePageBody page={page} className="contact-page-custom-content"/>
      <form className="contact-form-card" onSubmit={submit}>
        <div className="contact-form-grid">
          <div className="contact-field"><label htmlFor="contact-name">Your name</label><input id="contact-name" name="name" value={values.name} onChange={update} maxLength={120} autoComplete="name" required /></div>
          <div className="contact-field"><label htmlFor="contact-email">Email address</label><input id="contact-email" type="email" name="email" value={values.email} onChange={update} maxLength={254} autoComplete="email" required /></div>
          <div className="contact-field contact-field-wide"><label htmlFor="contact-subject">Subject <span>(optional)</span></label><input id="contact-subject" name="subject" value={values.subject} onChange={update} maxLength={180} /></div>
          <div className="contact-field contact-field-wide"><label htmlFor="contact-message">Message</label><textarea id="contact-message" name="message" value={values.message} onChange={update} minLength={10} maxLength={5000} required /></div>
          <div className="contact-honeypot" aria-hidden="true"><label htmlFor="contact-website">Leave this field empty</label><input id="contact-website" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={update} /></div>
        </div>
        <button className="button button-dark contact-submit" type="submit" disabled={status.type === 'loading'}>{status.type === 'loading' ? 'Sending…' : 'Send message'} <Send size={14} /></button>
        {status.message && <p className={`contact-status ${status.type}`} role="status" aria-live="polite">{status.type === 'success' && <CheckCircle2 size={14} />} {status.message}</p>}
      </form>
    </main>
  );
}
