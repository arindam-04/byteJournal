import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Compass, GitBranch, ShieldCheck, Users } from 'lucide-react';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';
import './PublicPages.css';
export default function AboutView(){
  const page=useSitePageContent('about');
  useEffect(()=>{document.title=`${page.title||'About Us'} | ByteJournal`},[page.title]);
  const values=[{Icon:BookOpen,title:'Depth over noise',copy:'We value explanations that build understanding, not just lists of tools and trends.'},{Icon:ShieldCheck,title:'Accuracy with humility',copy:'Technical claims should be clear, verifiable, and honest about trade-offs and uncertainty.'},{Icon:GitBranch,title:'Learning in public',copy:'Useful engineering knowledge grows when practitioners share what worked, what failed, and why.'},{Icon:Users,title:'An open community',copy:'We welcome thoughtful perspectives from learners, builders, researchers, and experienced engineers.'}];
  return <main className="public-page bj-about-page"><div className="public-page-heading"><span className="section-kicker">ABOUT THE PUBLICATION / 05</span><h1>{page.title||<>Ideas for people who <em>build.</em></>}</h1><p>{page.intro||'ByteJournal is an independent technical publication for curious minds who want to understand the systems behind modern software.'}</p></div>
    {page.body?.trim() ? <SitePageBody page={page} className="bj-about-custom-content"/> : <>
      <section className="bj-about-intro"><div><span className="section-kicker">OUR MISSION</span><h2>Make complex technology <em>clearer.</em></h2></div><p>We publish practical articles, tutorials, and engineering perspectives across web development, programming, artificial intelligence, infrastructure, cybersecurity, data, and system design. Our goal is to make deep technical ideas accessible without flattening the details that make them useful.</p></section>
      <section className="bj-values-section"><div className="section-heading"><div><span className="section-kicker">EDITORIAL VALUES</span><h2>How we <em>work.</em></h2></div></div><div className="bj-values-grid">{values.map(({Icon,title,copy},i)=><article key={title} className="bj-value-card"><span className="bj-value-number">0{i+1}</span><Icon size={22}/><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
      <section className="bj-about-cta"><div><span className="section-kicker">CONTRIBUTE TO THE JOURNAL</span><h2>Have an idea worth <em>sharing?</em></h2><p>Help other builders learn from your experience, experiments, and discoveries.</p></div><Link className="button button-light" to="/become-author">Become an author <ArrowUpRight size={16}/></Link></section>
    </>}
  </main>;
}
