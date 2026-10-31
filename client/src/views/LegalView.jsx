import { Link, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';

const documents = {
  'privacy-policy': {
    title: 'Privacy Policy', intro: 'This notice explains how ByteJournal handles information submitted through the public website and its editorial tools.', sections: [
      ['Information you provide', 'When you subscribe to the newsletter, we collect your email address and record your subscription preference. When you use the contact form, we collect your name, email address, subject (if supplied), and message. Contributors and CMS users may provide account, profile, and article information.'],
      ['How information is used', 'Information is used to maintain the newsletter subscriber list, respond to messages, operate contributor and publishing workflows, secure accounts, and maintain the website. The subscriber list allows the site operator to send email updates when newsletter delivery is configured.'],
      ['Storage and service providers', 'Website data is stored by the hosting and database services configured by the site operator. Email delivery, if enabled, may be handled by the SMTP provider configured for the website. Those providers process information as needed to provide their services.'],
      ['Retention and your choices', 'Information is retained for as long as reasonably needed for the purpose for which it was collected, security, and applicable record-keeping. To ask about access, correction, or deletion of information you submitted, use the Contact page. You can also request removal from newsletter updates by contacting the site operator.'],
      ['Security and changes', 'Reasonable technical and organizational measures should be maintained to protect information. No internet transmission or storage method can be guaranteed completely secure. This notice may be updated as the website and its practices change.']
    ]
  },
  terms: {
    title: 'Terms & Conditions', intro: 'These terms describe the basic rules for accessing and using ByteJournal.', sections: [
      ['Using the website', 'You may read, share links to, and make reasonable personal use of public articles. You must not misuse the website, attempt unauthorized access, interfere with its operation, or use its forms to submit unlawful, abusive, or harmful material.'],
      ['Content and intellectual property', 'Unless a page states otherwise, articles and original site materials remain the property of their respective authors or rights holders. You may quote brief portions with clear attribution and a link to the source. Do not republish complete articles or submitted materials without permission.'],
      ['Contributor submissions', 'Authors are responsible for ensuring they have the rights and permissions needed for submitted text, images, code, and other materials. Submissions may be reviewed, edited for clarity, accepted, or declined under the publication’s editorial process.'],
      ['Availability and changes', 'The website and its features may change or become temporarily unavailable. The site operator may update these terms when needed. Continued use after a published update means you accept the revised terms.']
    ]
  },
  cookies: {
    title: 'Cookie Policy', intro: 'ByteJournal uses a small amount of browser storage to provide core site and account functionality.', sections: [
      ['Essential session cookie', 'The CMS uses an HTTP-only authentication cookie to keep an administrator or contributor signed in. It is used for account security and is not accessible to page scripts.'],
      ['Theme preference', 'The website stores your light or dark theme preference in browser local storage so the selected appearance can be remembered on your next visit.'],
      ['Third-party resources', 'The current design loads web fonts from Google Fonts. Your browser may connect to that provider to retrieve font files. Hosting or security infrastructure may also use its own technical cookies or logs.'],
      ['Managing browser storage', 'You can clear cookies and local storage through your browser settings. Clearing the CMS session cookie signs you out, and clearing the theme preference may return the site to your system default. Blocking essential storage may affect CMS sign-in.']
    ]
  },
  disclaimer: {
    title: 'Disclaimer', intro: 'ByteJournal publishes educational and informational material about technology and software engineering.', sections: [
      ['Educational information', 'Articles, tutorials, and code examples are provided for general learning and discussion. They may contain errors, omissions, or become outdated as tools and platforms change.'],
      ['Code and technical guidance', 'Review and test all code in an appropriate development environment before using it in production. You are responsible for assessing security, compatibility, licensing, and operational risks in your own systems.'],
      ['No professional advice', 'Content on this website is not a substitute for professional security, legal, financial, or other specialist advice.'],
      ['External links', 'Links to third-party websites are provided for convenience. ByteJournal does not control those websites and is not responsible for their content, availability, or privacy practices.']
    ]
  }
};

export default function LegalView({ siteName = 'ByteJournal', slugOverride = null }) {
  const { slug } = useParams();
  const documentSlug=slugOverride || slug;
  const pageKey=({'privacy-policy':'privacyPolicy',terms:'terms','cookie-policy':'cookiePolicy',disclaimer:'disclaimer'})[documentSlug]||'privacyPolicy';
  const page=useSitePageContent(pageKey);
  const legalDocument = documents[documentSlug];
  useEffect(() => { if (legalDocument) window.document.title = `${page.title||legalDocument.title} | ByteJournal`; }, [legalDocument,page.title]);
  if (!legalDocument) return <main className="legal-page"><span className="section-kicker">LEGAL / NOT FOUND</span><h1>Document not found.</h1><Link className="text-link" to="/"><ArrowLeft size={14} /> Return home</Link></main>;
  return (
    <main className="legal-page">
      <Link className="text-link" to="/"><ArrowLeft size={14} /> Back to ByteJournal</Link>
      <span className="section-kicker" style={{ display: 'block', marginTop: 34 }}>LEGAL / {siteName.toUpperCase()}</span>
      <h1>{page.title||legalDocument.title}</h1>
      <p className="legal-page-intro">{page.intro||legalDocument.intro}</p>
      {page.body?.trim() ? <SitePageBody page={page} className="legal-page-custom-content"/> : <>
        <p className="legal-updated">STARTER POLICY TEXT · REVIEW BEFORE PUBLICATION</p>
        {legalDocument.sections.map(([heading, body]) => <section className="legal-section" key={heading}><h2>{heading}</h2><p>{body}</p></section>)}
        <p className="legal-draft-note">Site operator note: confirm that this text matches your actual business identity, hosting providers, email service, data retention process, and applicable legal obligations before publishing it as a final legal policy.</p>
      </>}
    </main>
  );
}
