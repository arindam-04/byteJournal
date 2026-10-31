import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Newspaper, BookOpen, Filter } from 'lucide-react';
import ArticleCard from '../components/ArticleCard';
import { api } from '../api';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';
import './PublicPages.css';

export function TutorialsView(){
  const page=useSitePageContent('tutorials');
  const [items,setItems]=useState([]);const [difficulty,setDifficulty]=useState('all');const [params]=useSearchParams();const format=params.get('format')||'tutorial';const tag=format==='guide'?'developer-guide':format==='example'?'code-example':'tutorial';const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const defaultTitle=format==='guide'?'Developer Guides':format==='example'?'Code Examples':'Tutorials';
  useEffect(()=>{document.title=`${page.title||defaultTitle} | ByteJournal`;let active=true;setLoading(true);setError('');api.articles(`?tag=${encodeURIComponent(tag)}&limit=50`).then(({articles=[]})=>{if(active)setItems(articles)}).catch(e=>{if(active)setError(e.message||'Tutorials could not be loaded.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[tag,page.title,defaultTitle]);
  const shown=useMemo(()=>items.filter(article=>{const tags=(article.tags||[]).map(t=>String(t).toLowerCase());const marked=tags.find(t=>['beginner','intermediate','advanced'].includes(t));return difficulty==='all'||marked===difficulty}),[items,difficulty]);
  return <main className="public-page"><div className="public-page-heading"><span className="section-kicker">LEARN BY BUILDING / 03</span><h1>{page.title||<>{format==='guide'?'Developer ':format==='example'?'Code ':'Practical '}<em>{format==='guide'?'guides.':format==='example'?'examples.':'tutorials.'}</em></>}</h1><p>{page.intro||'Step-by-step learning published by contributors. Filter by the level tagged on each resource.'}</p></div>
    <SitePageBody page={page}/>
    <div className="bj-collection-toolbar"><span><BookOpen size={17}/> {items.length} resources</span><label><Filter size={15}/><span className="sr-only">Filter by difficulty</span><select value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option value="all">All difficulty levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label></div>
    {loading?<div className="bj-state-panel">Loading tutorials…</div>:error?<div className="bj-state-panel bj-error">{error}</div>:shown.length?<div className="articles-grid bj-route-grid">{shown.map((a,i)=><ArticleCard key={a.id||a.slug} article={a} featured={i===0}/>)}</div>:<div className="bj-state-panel"><BookOpen size={27}/><h2>No tutorials found</h2><p>Published resources are tagged <code>{tag}</code>. Add a difficulty tag such as <code>beginner</code>, <code>intermediate</code>, or <code>advanced</code> to classify a learning path.</p><Link className="button button-outline" to="/become-author">Submit a tutorial <ArrowUpRight size={15}/></Link></div>}
  </main>;
}

export function TechNewsView(){
  const page=useSitePageContent('techNews');
  const [items,setItems]=useState([]);const [category,setCategory]=useState('all');const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  useEffect(()=>{document.title=`${page.title||'Tech News'} | ByteJournal`;let active=true;api.articles('?tag=news&limit=50').then(({articles=[]})=>{if(active)setItems(articles)}).catch(e=>{if(active)setError(e.message||'Technology updates could not be loaded.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[page.title]);
  const categories=[...new Set(items.map(a=>a.category).filter(Boolean))];const shown=category==='all'?items:items.filter(a=>a.category===category);
  return <main className="public-page"><div className="public-page-heading"><span className="section-kicker">SIGNALS & UPDATES / 04</span><h1>{page.title||<>Technology in <em>motion.</em></>}</h1><p>{page.intro||'Recent technology coverage and developments, curated from the ByteJournal editorial feed.'}</p></div>
    <SitePageBody page={page}/>
    <div className="bj-collection-toolbar"><span><Newspaper size={17}/> {items.length} news posts</span><label><Filter size={15}/><span className="sr-only">Filter news by topic</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All topics</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label></div>
    {loading?<div className="bj-state-panel">Loading technology news…</div>:error?<div className="bj-state-panel bj-error">{error}</div>:shown.length?<div className="articles-grid bj-route-grid">{shown.map((a,i)=><ArticleCard key={a.id||a.slug} article={a} featured={i===0}/>)}</div>:<div className="bj-state-panel"><Newspaper size={27}/><h2>No news posts yet</h2><p>This feed uses published articles tagged <code>news</code>. Publish a current technology update with that tag and it will appear here.</p><Link className="button button-outline" to="/articles">Browse all articles</Link></div>}
  </main>;
}
