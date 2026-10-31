import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Braces, Check,
  ChevronRight, Code2, Cpu, Database, Filter, GitBranch, Globe2,
  Layers3, Mail, Network, PenLine, Search, Send, ShieldCheck, Terminal, X, Zap, CheckCircle2
} from 'lucide-react';
import ArticleCard from '../components/ArticleCard';
import usePublishedArticles from '../controllers/usePublishedArticles';
import { api } from '../api';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';

const topics = [
  { name: 'Web Development', slug: 'web-development', number: '01', desc: 'Modern frontend, browsers & the open web', icon: Globe2, tag: 'WEB PLATFORM' },
  { name: 'Programming Languages', slug: 'programming-languages', number: '02', desc: 'APIs, runtimes & distributed services', icon: Terminal, tag: 'SERVER SYSTEMS' },
  { name: 'Database Management', slug: 'database-management', number: '03', desc: 'Data models, query engines & storage', icon: Database, tag: 'DATA LAYER' },
  { name: 'System Design', slug: 'system-design', number: '04', desc: 'Architecture, reliability & scale', icon: Network, tag: 'ARCHITECTURE' },
];

export default function HomeView({ siteName = 'ByteJournal', tagline = '', settings = {} }) {
  const page = useSitePageContent('home');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [trending, setTrending] = useState([]);
  const [popular, setPopular] = useState([]);
  const [featuredArticles, setFeaturedArticles] = useState([]);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [newsletterStatus, setNewsletterStatus] = useState({ type: 'idle', message: '' });
  useEffect(() => { let active = true; api.categories().then(({ categories = [] }) => { if (active) setTrending([...categories].sort((a,b) => b.count-a.count).slice(0,5)); }).catch(() => {}); return () => { active = false; }; }, []);
  useEffect(() => { let active = true; api.popularArticles(settings.popularCount||4).then(({ articles = [] }) => { if (active) setPopular(articles); }).catch(() => {}); return () => { active = false; }; }, [settings.popularCount]);
  useEffect(() => { let active = true; api.featuredArticles(settings.featuredCount||1).then(({ articles = [] }) => { if (active) setFeaturedArticles(articles); }).catch(() => {}); return () => { active = false; }; }, [settings.featuredCount]);
  const { articles, pagination, loading, loadingMore, error: articlesError, loadMore, retry } = usePublishedArticles(search, category, settings.latestCount||12);
  const sectionOrder = name => { const index=(settings.homepageOrder||['featured','latest','popular','topics']).indexOf(name); return index<0?90:index+1; };
  const homepageTopics = settings.homepageCategories?.length ? settings.homepageCategories.map((name,index)=>{const existing=topics.find(topic=>topic.name.toLowerCase()===name.toLowerCase());return existing||{name,slug:name.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),number:String(index+1).padStart(2,'0'),desc:`Articles and notes about ${name}.`,icon:Code2,tag:'TOPIC'};}) : topics;
  async function subscribe(event) {
    event.preventDefault();
    if (!newsletterConsent) { setNewsletterStatus({ type: 'error', message: 'Please agree to receive email updates before subscribing.' }); return; }
    setNewsletterStatus({ type: 'loading', message: '' });
    try { const result = await api.newsletterSubscribe(newsletterEmail.trim(), newsletterConsent); setNewsletterStatus({ type: 'success', message: result.message || 'You are on the ByteJournal dispatch list.' }); setNewsletterEmail(''); setNewsletterConsent(false); }
    catch (error) { setNewsletterStatus({ type: 'error', message: error.message || 'Subscription failed. Please try again.' }); }
  }
  const categories = ['All', ...new Set(articles.map(a => a.category).filter(Boolean))];
  const filtered = useMemo(() => articles.filter(a =>
    (category === 'All' || a.category === category) &&
    `${a.title} ${a.excerpt} ${a.category} ${a.author} ${(a.tags || []).join(' ')}`.toLowerCase().includes(search.toLowerCase())
  ), [articles, category, search]);

  return <>
    <section className="tech-hero">
      <div className="hero-grid-lines" aria-hidden="true" />
      <div className="hero-inner tech-hero-inner">
        <div className="hero-copy-column">
          <div className="hero-kicker"><span className="live-dot" /> INDEPENDENT ENGINEERING PUBLICATION <span className="kicker-version">/ VOL. 01</span></div>
          <h1>{page.title || <>Understand the<br /><span>systems behind</span><br />the screen<span className="hero-period">.</span></>}</h1>
          <p className="hero-copy">{page.intro||settings.homepageIntro||'A technical journal for curious builders. Explore software architecture, web engineering, databases, and the ideas shaping what comes next.'}</p>
          <div className="hero-buttons">
            <a className="button button-dark" href="#articles">Explore the journal <ArrowDownRight size={16} /></a>
            <a className="text-link" href="#topics">Browse disciplines <ArrowRight size={16} /></a>
          </div>
          <div className="hero-stats tech-stats">
            <div><strong>{String(articles.length).padStart(2, '0')}<small>+</small></strong><span>FIELD NOTES</span></div>
            <div><strong>{String(categories.length - 1).padStart(2, '0')}</strong><span>DISCIPLINES</span></div>
            <div><strong>01<span className="stat-accent">/</span>∞</strong><span>LEARNING IN PUBLIC</span></div>
          </div>
        </div>
        <div className="hero-console-wrap" aria-label="Illustrative engineering terminal">
          <div className="console-orbit orbit-a" /><div className="console-orbit orbit-b" />
          <div className="hero-console">
            <div className="console-topbar"><div className="window-dots"><i /><i /><i /></div><span><Terminal size={13} /> system.map</span><span className="console-live"><span /> LIVE</span></div>
            <div className="console-body">
              <div className="console-comment">// a map for curious minds</div>
              <div className="code-line"><span className="code-num">01</span><span className="code-key">const</span> <span className="code-var">knowledge</span> = {'{'}</div>
              <div className="code-line indent"><span className="code-num">02</span><span className="code-prop">frontend</span>: <span className="code-string">'the interface'</span>,</div>
              <div className="code-line indent"><span className="code-num">03</span><span className="code-prop">backend</span>: <span className="code-string">'the engine'</span>,</div>
              <div className="code-line indent"><span className="code-num">04</span><span className="code-prop">data</span>: <span className="code-string">'the memory'</span>,</div>
              <div className="code-line indent"><span className="code-num">05</span><span className="code-prop">systems</span>: <span className="code-string">'the connection'</span></div>
              <div className="code-line"><span className="code-num">06</span>{'}'};</div>
              <div className="console-rule" />
              <div className="console-output"><span className="output-check"><Check size={12} /></span><div><strong>Build your mental model</strong><small>One concept at a time · continuously</small></div><span className="output-arrow"><ArrowUpRight size={16} /></span></div>
            </div>
            <div className="console-footer"><span><Activity size={12} /> KNOWLEDGE GRAPH</span><span>LATENCY: 0.02ms</span></div>
          </div>
          <div className="floating-metric metric-top"><span className="metric-icon"><GitBranch size={15} /></span><span><small>CONNECTED IDEAS</small><strong>∞ pathways</strong></span></div>
          <div className="floating-metric metric-bottom"><span className="metric-icon metric-icon-blue"><Zap size={15} /></span><span><small>LEARNING MODE</small><strong>Always on</strong></span><span className="metric-signal" /></div>
        </div>
      </div>
      <div className="hero-bottomline"><span>ENGINEERING / SOFTWARE / SYSTEMS</span><span>SCROLL TO EXPLORE <ArrowDownRight size={13} /></span></div>
    </section>

    <main className="main-content tech-main">
      <SitePageBody page={page}/>
      {trending.length > 0 && <section className="bj-home-trending" aria-labelledby="bj-trending-heading" style={{order:0}}><div><span className="section-kicker">TOPIC ACTIVITY / BY PUBLISHED ARTICLE COUNT</span><h2 id="bj-trending-heading">Trending <em>topics.</em></h2></div><div className="bj-trending-list">{trending.map(item => { const key = String(item.category || '').toLowerCase(); const slug = ({web:'web-development',backend:'programming-languages',programming:'programming-languages',ai:'artificial-intelligence',database:'database-management',devops:'cloud-computing-devops',security:'cybersecurity'})[key] || key.trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); return <Link key={item.category} to={`/categories/${slug}`}><span>{item.category}</span><small>{item.count} articles</small><ArrowUpRight size={13}/></Link>; })}</div></section>}
      {settings.showFeatured!==false && featuredArticles.length>0 && <section className="section-block bj-featured-section" id="featured" style={{order:sectionOrder('featured')}}><div className="section-heading"><div><div className="section-kicker">EDITOR'S SELECTION</div><h2>Featured <em>articles.</em></h2></div><span className="section-index">CURATED FOR BUILDERS</span></div><div className="articles-grid">{featuredArticles.map((article,index)=><ArticleCard key={article.id||article.slug} article={article} featured={index===0}/>)}</div></section>}
      {settings.showLatest!==false && <section className="section-block" id="articles" style={{order:sectionOrder('latest')}}>
        <div className="section-heading"><div><div className="section-kicker"><span className="section-marker">01</span> THE KNOWLEDGE FEED</div><h2>Ideas with <em>depth.</em></h2></div><div className="section-heading-side"><span className="section-index">LATEST DISPATCHES</span><span className="live-feed"><i /> UPDATED AS WE BUILD</span></div></div>
        <div className="article-tools"><label className="search-box"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search concepts, systems, technologies..." aria-label="Search articles" />{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={15} /></button>}</label><div className="category-filter"><Filter size={15} />{categories.map(c => <button key={c} className={category === c ? 'filter-pill active' : 'filter-pill'} onClick={() => setCategory(c)}>{c}</button>)}</div></div>
        {articlesError ? <div className="empty-state"><h3>Articles could not be loaded</h3><p>{articlesError}</p><button className="button button-outline" onClick={retry}>Try again</button></div> : loading ? <div className="loading-line" role="status">Loading articles from ByteJournal…</div> : filtered.length ? <><div className="articles-grid">{filtered.map((article, i) => <ArticleCard key={article.id || article.slug} article={article} featured={i === 0} />)}</div>{pagination.hasMore && <div className="load-more-wrap"><button className="button button-outline" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more articles'}</button></div>}<div className="grid-end"><span /><span>SHOWING {articles.length} OF {pagination.total} DISPATCHES</span><span /></div></> : <div className="empty-state"><Search size={28} /><h3>No matching field notes</h3><p>Try another keyword or discipline.</p><button className="button button-outline" onClick={() => { setSearch(''); setCategory('All'); }}>Reset search <X size={14} /></button></div>}
      </section>}

      {settings.showPopular!==false && popular.length > 0 && <section className="section-block bj-popular-section" aria-labelledby="bj-popular-heading" style={{order:sectionOrder('popular')}}><div className="section-heading"><div><div className="section-kicker">READER FAVORITES / MOST READ</div><h2 id="bj-popular-heading">Popular <em>dispatches.</em></h2></div><span className="section-index">MOST READ</span></div><div className="articles-grid">{popular.map((article, i) => <ArticleCard key={article.id || article.slug} article={article} featured={i === 0}/>)}</div></section>}

      <section className="topics-section tech-topics" id="topics" style={{order:sectionOrder('topics')}}>
        <div className="section-heading"><div><div className="section-kicker"><span className="section-marker">02</span> EXPLORE THE STACK</div><h2>Pick a <em>discipline.</em></h2></div><p className="topics-intro">From the pixels users see to the infrastructure they never do — follow the thread that interests you.</p></div>
        <div className="topics-grid">{homepageTopics.map(t => { const Icon = t.icon; return <Link key={t.name} to={`/categories/${t.slug}`} className="topic-card"><span className="topic-number">{t.number} <span>/{' '}{t.tag}</span></span><span className="topic-icon"><Icon size={21} /></span><strong>{t.name}</strong><span className="topic-desc">{t.desc}</span><span className="topic-explore">EXPLORE TOPIC <ArrowUpRight size={14} /></span></Link>; })}</div>
      </section>

      <section className="stack-banner" id="about" style={{order:98}}><div className="stack-banner-visual"><div className="stack-ring ring-one"/><div className="stack-ring ring-two"/><div className="stack-core"><Layers3 size={28}/></div><span className="stack-node node-a"><Code2 size={15}/></span><span className="stack-node node-b"><Database size={15}/></span><span className="stack-node node-c"><Cpu size={15}/></span></div><div className="stack-banner-copy"><span className="section-kicker"><span className="section-marker">03</span> THINK IN SYSTEMS</span><h2>Go beyond the<br /><em>surface layer.</em></h2><p>Good engineering starts with asking why. Follow the details, connect the abstractions, and build an intuition that lasts longer than a framework trend.</p><Link to="/become-author" className="button button-light">Contribute a field note <ArrowUpRight size={16}/></Link></div><div className="stack-banner-index">BJ / SYSTEMS THINKING</div></section>

      <section className="newsletter tech-newsletter bj-home-newsletter" style={{order:99}}><div className="newsletter-icon"><Mail size={21} /></div><div className="bj-home-newsletter-copy"><span className="section-kicker">THE BYTEJOURNAL DISPATCH</span><h2>Fresh ideas for your <em>next build.</em></h2><p>Join the reader list for practical notes on software, AI, and engineering.</p></div><form className="bj-home-newsletter-form" onSubmit={subscribe}><div className="bj-home-newsletter-fields"><label className="sr-only" htmlFor="home-newsletter-email">Email address</label><input id="home-newsletter-email" type="email" value={newsletterEmail} onChange={event=>setNewsletterEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" maxLength={254} required disabled={newsletterStatus.type==='loading'}/><button className="button button-dark" type="submit" disabled={newsletterStatus.type==='loading'}>{newsletterStatus.type==='loading'?'Subscribing…':'Subscribe'} <Send size={14}/></button></div><label className="bj-home-newsletter-consent"><input type="checkbox" checked={newsletterConsent} onChange={event=>setNewsletterConsent(event.target.checked)} disabled={newsletterStatus.type==='loading'}/><span>I agree to receive ByteJournal email updates. <Link to="/privacy-policy">Privacy Policy</Link>.</span></label><p className={`bj-home-newsletter-status status-${newsletterStatus.type}`} role="status" aria-live="polite">{newsletterStatus.type==='success'&&<CheckCircle2 size={14}/>} {newsletterStatus.message}</p></form></section>
    </main>
  </>;
}
