import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import ArticleCard from '../components/ArticleCard';
import { api } from '../api';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';
import './PublicPages.css';

export default function TagDetailView() {
  const pageContent=useSitePageContent('tagDetail');
  const {tagSlug=''}=useParams();
  const [params]=useSearchParams();
  const tagName=params.get('tag')||tagSlug.split('-').map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ');
  const [articles,setArticles]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [filter,setFilter]=useState('');

  useEffect(()=>{
    document.title=`${pageContent.title||tagName} | ByteJournal`;
    let active=true;
    setLoading(true);
    setError('');
    api.articles(`?tag=${encodeURIComponent(tagName)}&limit=50`)
      .then(({articles:items=[]})=>{if(active)setArticles(items);})
      .catch(err=>{if(active)setError(err.message||'Unable to load articles for this tag.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[tagName,pageContent.title]);

  const shown=useMemo(()=>articles.filter(article=>`${article.title} ${article.excerpt}`.toLowerCase().includes(filter.toLowerCase())),[articles,filter]);
  return <main className="public-page">
    <Link className="bj-back-link" to="/articles"><ArrowLeft size={15}/> All articles</Link>
    <div className="public-page-heading bj-category-heading"><span className="section-kicker">TAG / ARTICLE COLLECTION</span><h1>{pageContent.title||<>Articles tagged <em>{tagName}.</em></>}</h1><p>{pageContent.intro||`Browse published articles tagged ${tagName}.`}</p></div>
    <SitePageBody page={pageContent}/>
    <label className="bj-page-search bj-category-search"><Search size={17}/><input value={filter} onChange={event=>setFilter(event.target.value)} placeholder={`Search ${tagName} articles…`} aria-label={`Search ${tagName} articles`}/></label>
    {loading?<div className="bj-state-panel" role="status">Loading tagged articles…</div>:error?<div className="bj-state-panel bj-error">{error}</div>:shown.length?<div className="articles-grid bj-route-grid">{shown.map((article,index)=><ArticleCard key={article.id||article.slug} article={article} featured={index===0}/>)}</div>:<div className="bj-state-panel"><h2>No published articles with this tag yet</h2><p>Articles tagged “{tagName}” will appear here after publication.</p><Link className="button button-outline" to="/articles">Browse all articles</Link></div>}
  </main>;
}
