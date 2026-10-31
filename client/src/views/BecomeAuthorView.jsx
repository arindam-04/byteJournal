import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Code2,
  FileText, Lightbulb, PenLine, ShieldCheck, Sparkles, Users,
} from 'lucide-react';
import { api } from '../api';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';

const initialValues = {
  full_name: '',
  email: '',
  expertise: '',
  biography: '',
  portfolio_url: '',
  github_url: '',
  linkedin_url: '',
  writing_experience: '',
  sample_article_url: '',
  motivation: '',
};

const benefits = [
  { icon: Users, title: 'Reach curious builders', copy: 'Share what you have learned with readers who value practical, thoughtful work.' },
  { icon: Lightbulb, title: 'Make ideas useful', copy: 'Turn experiments, lessons and discoveries into clear guidance for others.' },
  { icon: BookOpen, title: 'Build your body of work', copy: 'Create a public archive of your knowledge and strengthen your author profile.' },
];

const steps = [
  { number: '01', title: 'Send your application', copy: 'Tell us about your interests and experience.' },
  { number: '02', title: 'Editorial review', copy: 'Our team reviews your details and sample work.' },
  { number: '03', title: 'Start contributing', copy: 'Approved contributors receive an invitation to join.' },
];

function Field({ label, name, value, onChange, type = 'text', required = false, placeholder, hint, maxLength, minLength, wide = false, rows }) {
  const id = `author-${name}`;
  return (
    <label className={`author-field${wide ? ' author-field-wide' : ''}`} htmlFor={id}>
      <span className="author-field-label">{label}{required && <span className="author-required"> *</span>}</span>
      {type === 'textarea' ? (
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          maxLength={maxLength}
          minLength={minLength}
          rows={rows || 4}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          maxLength={maxLength}
          minLength={minLength}
          pattern={type === 'url' ? 'https?://.+' : undefined}
          placeholder={placeholder}
          autoComplete={name === 'full_name' ? 'name' : name === 'email' ? 'email' : 'off'}
        />
      )}
      {hint && <span className="author-field-hint">{hint}</span>}
      {type === 'textarea' && maxLength && <span className="author-character-count">{value.length}/{maxLength}</span>}
    </label>
  );
}

export default function BecomeAuthorView() {
  const page=useSitePageContent('becomeAuthor');
  useEffect(() => { document.title = `${page.title||'Become an Author'} | ByteJournal`; }, [page.title]);
  const [values, setValues] = useState(initialValues);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const updateField = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api.submitAuthorApplication(values);
      setMessage(result.message || 'Your application has been received.');
      setValues(initialValues);
    } catch (submitError) {
      setError(submitError.message || 'We could not submit your application. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="author-application-page">
      <div className="author-page-shell">
        <Link to="/" className="author-back-link"><ArrowLeft size={15} /> Back to ByteJournal</Link>

        <header className="author-page-heading">
          <div>
            <span className="author-eyebrow"><span /> CONTRIBUTOR PROGRAM</span>
            <h1>{page.title||<>Become an <em>author.</em></>}</h1>
            <p>{page.intro||'Good ideas deserve a thoughtful audience. Bring your experience, share what you are learning, and help the developer community move forward.'}</p>
          </div>
          <div className="author-heading-note">
            <span className="author-note-mark">“</span>
            <p>Write what you know.<br />Share what you discover.</p>
            <span className="author-note-caption">THE BYTEJOURNAL APPROACH</span>
          </div>
        </header>

        <SitePageBody page={page} className="author-page-custom-content"/>

        <div className="author-application-grid">
          <aside className="author-info-panel">
            <div className="author-info-topline"><span className="author-info-icon"><Code2 size={17} /></span><span>WRITE WITH BYTEJOURNAL</span></div>
            <h2>Your perspective<br />has a place here.</h2>
            <p className="author-info-intro">We are building a collection of useful, honest and well-crafted technical stories. We would love to hear what you can contribute.</p>

            <div className="author-benefits">
              {benefits.map(({ icon: Icon, title, copy }) => (
                <div className="author-benefit" key={title}>
                  <span className="author-benefit-icon"><Icon size={17} /></span>
                  <div><strong>{title}</strong><p>{copy}</p></div>
                </div>
              ))}
            </div>

            <div className="author-process">
              <div className="author-process-heading"><span>WHAT HAPPENS NEXT</span><span>3 STEPS</span></div>
              {steps.map((step) => (
                <div className="author-process-step" key={step.number}>
                  <span className="author-step-number">{step.number}</span>
                  <div><strong>{step.title}</strong><p>{step.copy}</p></div>
                </div>
              ))}
            </div>

            <div className="author-info-foot"><ShieldCheck size={15} /><span>Your details are used only to review your contributor application.</span></div>
            <div className="author-panel-decoration" aria-hidden="true">BJ.</div>
          </aside>

          <section className="author-form-panel" aria-labelledby="author-form-title">
            <div className="author-form-heading">
              <div>
                <span className="author-form-kicker">APPLICATION <span> / </span> 01</span>
                <h2 id="author-form-title">Tell us about yourself</h2>
                <p>Complete the form below. Fields marked with <span className="author-required">*</span> are required.</p>
              </div>
              <span className="author-form-icon"><PenLine size={20} /></span>
            </div>

            {message ? (
              <div className="author-success" role="status" aria-live="polite">
                <span className="author-success-icon"><CheckCircle2 size={28} /></span>
                <span className="author-form-kicker">APPLICATION RECEIVED</span>
                <h3>Thank you for stepping forward.</h3>
                <p>{message} The ByteJournal team will review your application. Submission does not automatically create an account.</p>
                <button type="button" className="button button-dark" onClick={() => setMessage('')}>Submit another application <ArrowRight size={15} /></button>
              </div>
            ) : (
              <form className="author-application-form" onSubmit={submit} noValidate={false}>
                <div className="author-form-section">
                  <div className="author-section-title"><span>01</span><div><h3>About you</h3><p>How should our editorial team reach you?</p></div></div>
                  <div className="author-fields-grid">
                    <Field label="Full name" name="full_name" value={values.full_name} onChange={updateField} required maxLength={120} placeholder="Your name" />
                    <Field label="Email address" name="email" value={values.email} onChange={updateField} type="email" required maxLength={254} placeholder="you@example.com" />
                    <Field label="Area of expertise" name="expertise" value={values.expertise} onChange={updateField} required maxLength={180} wide placeholder="e.g. Frontend development, AI, DevOps, UX engineering" hint="Choose a clear topic or technical area you know well." />
                    <Field label="Short biography" name="biography" value={values.biography} onChange={updateField} type="textarea" required wide rows={4} minLength={30} maxLength={3000} placeholder="Introduce yourself, your background and the work you enjoy doing…" hint="At least 30 characters. A concise 2–4 sentence introduction is ideal." />
                  </div>
                </div>

                <div className="author-form-section">
                  <div className="author-section-title"><span>02</span><div><h3>Your writing profile</h3><p>Share your experience and examples of your work.</p></div></div>
                  <div className="author-fields-grid">
                    <Field label="Writing experience" name="writing_experience" value={values.writing_experience} onChange={updateField} type="textarea" wide rows={3} maxLength={3000} placeholder="Have you written articles, documentation, tutorials or newsletters? Tell us briefly…" />
                    <Field label="Portfolio or personal website" name="portfolio_url" value={values.portfolio_url} onChange={updateField} type="url" placeholder="https://your-site.com" />
                    <Field label="Sample article URL" name="sample_article_url" value={values.sample_article_url} onChange={updateField} type="url" placeholder="https://example.com/your-article" hint="Optional, but helpful for our review." />
                    <Field label="GitHub profile" name="github_url" value={values.github_url} onChange={updateField} type="url" placeholder="https://github.com/username" />
                    <Field label="LinkedIn profile" name="linkedin_url" value={values.linkedin_url} onChange={updateField} type="url" placeholder="https://linkedin.com/in/username" />
                  </div>
                </div>

                <div className="author-form-section author-form-section-last">
                  <div className="author-section-title"><span>03</span><div><h3>Why ByteJournal?</h3><p>Tell us what you would like to contribute.</p></div></div>
                  <div className="author-fields-grid">
                    <Field label="Why do you want to write for ByteJournal?" name="motivation" value={values.motivation} onChange={updateField} type="textarea" required wide rows={5} minLength={30} maxLength={3000} placeholder="What topics would you like to write about? Who would benefit from your articles? What makes you excited to contribute?" hint="At least 30 characters. Be specific about the ideas you would like to share." />
                  </div>
                </div>

                {error && <div className="author-form-error" role="alert"><strong>We couldn't send your application.</strong><span>{error}</span></div>}
                <div className="author-submit-row">
                  <div className="author-submit-note"><FileText size={16} /><span>Applications are reviewed by the ByteJournal editorial team.</span></div>
                  <button type="submit" className="button button-dark author-submit-button" disabled={busy}>
                    {busy ? 'Sending application…' : 'Send application'} {!busy && <ArrowRight size={16} />}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        <div className="author-bottom-note"><Sparkles size={14} /><span>Not sure what to include? Use the motivation section to tell us about the ideas you would like to share.</span></div>
      </div>
    </main>
  );
}
