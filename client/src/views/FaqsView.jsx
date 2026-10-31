import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CircleHelp } from 'lucide-react';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';
import './PublicPages.css';
const faqs=[
  ['Who can read ByteJournal?','All published articles and public resources are available to read without an account.'],
  ['How do I become a contributor?','Use the Become an Author page to submit your background, areas of expertise, and writing interests. The editorial team reviews applications.'],
  ['How do I publish an article?','Contributor accounts are provisioned through the editorial invitation process. Once your invitation is accepted, sign in and use the publishing workspace.'],
  ['How can I suggest a correction?','Use the Contact page and include the article URL, the passage in question, and any supporting sources.'],
  ['How do I receive updates?','Subscribe through the newsletter form in the site footer. Your email and consent are stored for the publication mailing list; campaign delivery must be configured separately by the site operator.']
];
export default function FaqsView(){const page=useSitePageContent('faqs');useEffect(()=>{document.title=`${page.title||'FAQs'} | ByteJournal`},[page.title]);return <main className="public-page bj-faq-page"><div className="public-page-heading"><span className="section-kicker">HELP & INFORMATION</span><h1>{page.title||<>Frequently asked <em>questions.</em></>}</h1><p>{page.intro||'Helpful details about reading, contributing, and using ByteJournal.'}</p></div>{page.body?.trim()?<SitePageBody page={page}/>:<><div className="bj-faq-list">{faqs.map(([q,a],i)=><details key={q} open={i===0}><summary><span>{q}</span><CircleHelp size={17}/></summary><p>{a}</p></details>)}</div><section className="bj-about-cta"><div><span className="section-kicker">STILL HAVE A QUESTION?</span><h2>Talk to the <em>team.</em></h2><p>Send a note and we’ll route it to the right person.</p></div><Link to="/contact" className="button button-light">Contact us <ArrowUpRight size={16}/></Link></section></>}</main>}
