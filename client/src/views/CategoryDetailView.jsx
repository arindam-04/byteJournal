import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import ArticleCard from '../components/ArticleCard';
import { api } from '../api';
import { headerCategories } from '../components/Header';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';
import './PublicPages.css';

const aliases = { 'web-development':['Web Development','Web'], 'programming-languages':['Programming Languages','Programming'], 'artificial-intelligence':['Artificial Intelligence & Machine Learning','AI','Artificial Intelligence'], 'data-structures-algorithms':['Data Structures & Algorithms','Algorithms'], 'system-design':['System Design'], 'cloud-computing-devops':['Cloud Computing & DevOps','Cloud Computing','DevOps'], 'cybersecurity':['Cybersecurity','Security'], 'database-management':['Database Management','Database'], 'computer-networks':['Computer Networks','Networking'], 'open-source':['Open Source'] };
const descriptions = { 'web-development':'Modern browsers, interfaces, web platforms, and services.', 'programming-languages':'Language fundamentals, runtime behavior, and software craft.', 'artificial-intelligence':'Machine learning, AI systems, and practical applications.', 'data-structures-algorithms':'Algorithms, data structures, and the foundations of problem solving.', 'system-design':'Architecture, scalability, distributed systems, and reliability.', 'cloud-computing-devops':'Cloud platforms, automation, infrastructure, and DevOps practices.', 'cybersecurity':'Security engineering, privacy, and defensive techniques.', 'database-management':'Data modeling, SQL, NoSQL, storage, and query performance.', 'computer-networks':'Protocols, network services, connectivity, and internet systems.', 'open-source':'Open collaboration, tools, communities, and contribution.' };
export default function CategoryDetailView(){
  const pageContent=useSitePageContent('categoryDetail');
  const {categorySlug=''}=useParams();const config=headerCategories.find(([,slug])=>slug===categorySlug);const title=config?.[0]||categorySlug.split('-').map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(' ');
  const [articles,setArticles]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [filter,setFilter]=useState('');
  useEffect(()=>{document.title=`${pageContent.title||title} | ByteJournal`;let active=true;setLoading(true);setError('');const candidates=aliases[categorySlug]||[title];Promise.all(candidates.map(category=>api.articles(`?category=${encodeURIComponent(category)}&limit=50`))).then(results=>{if(active){const merged=results.flatMap(r=>r.articles||[]);setArticles([...new Map(merged.map(a=>[a.id||a.slug,a])).values()]);}}).catch(e=>{if(active)setError(e.message||'Unable to load this category.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[categorySlug,title,pageContent.title]);
  const filtered=useMemo(()=>articles.filter(a=>`${a.title} ${a.excerpt} ${(a.tags||[]).join(' ')}`.toLowerCase().includes(filter.toLowerCase())),[articles,filter]);
  return <main className="public-page"><Link className="bj-back-link" to="/categories"><ArrowLeft size={15}/> All categories</Link><div className="public-page-heading bj-category-heading"><span className="section-kicker">CATEGORY / KNOWLEDGE COLLECTION</span><h1>{pageContent.title||<>{title.split(' ').slice(0, -1).join(' ')} <em>{title.split(' ').slice(-1)[0]}.</em></>}</h1><p>{pageContent.intro||descriptions[categorySlug]||'Explore articles and practical notes in this technical discipline.'}</p></div>
    <SitePageBody page={pageContent}/>
    <label className="bj-page-search bj-category-search"><Search size={17}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder={`Search ${title} articles…`} aria-label={`Search ${title} articles`}/></label>
    {loading?<div className="bj-state-panel">Loading category articles…</div>:error?<div className="bj-state-panel bj-error">{error}</div>:filtered.length?<div className="articles-grid bj-route-grid">{filtered.map((a,i)=><ArticleCard key={a.id||a.slug} article={a} featured={i===0}/>)}</div>:<div className="bj-state-panel"><h2>No published articles in this category yet</h2><p>New writing will appear here when an article is published with a matching category.</p><Link className="button button-outline" to="/become-author">Write about this topic</Link></div>}
  </main>;
}
