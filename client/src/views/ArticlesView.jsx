import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, ArrowRight } from 'lucide-react';
import ArticleCard from '../components/ArticleCard';
import { api } from '../api';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';
import './PublicPages.css';

export default function ArticlesView() {
  const pageContent = useSitePageContent('articles');
  const [params, setParams] = useSearchParams();
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || 'newest';
  const page = Math.max(1, Number(params.get('page') || 1));

  useEffect(() => { api.categories().then(data => setCategories(data.categories || [])).catch(() => {}); }, []);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const query = new URLSearchParams({ page: String(page), limit: '12' });
    if (q.trim()) query.set('q', q.trim()); if (category) query.set('category', category);
    api.articles(`?${query}`).then(data => { if (active) { setArticles(data.articles || []); setPagination(data.pagination || { page, pages: 1, total: 0 }); } })
      .catch(err => { if (active) setError(err.message || 'Articles could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [q, category, page, attempt]);

  const sorted = useMemo(() => [...articles].sort((a,b) => sort === 'oldest'
    ? new Date(a.published_at || a.created_at) - new Date(b.published_at || b.created_at)
    : sort === 'title' ? (a.title || '').localeCompare(b.title || '')
    : new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at)), [articles, sort]);
  function update(key, value) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); if (key !== 'page') next.delete('page'); setParams(next); }

  useEffect(() => { document.title = `${pageContent.title || 'Articles'} | ByteJournal`; }, [pageContent.title]);
  return <main className="public-page bj-listing-page">
    <div className="public-page-heading"><span className="section-kicker">THE KNOWLEDGE LIBRARY / 01</span><h1>{pageContent.title || <>Articles with <em>depth.</em></>}</h1><p>{pageContent.intro || 'Explore practical engineering notes, explainers, and ideas from the ByteJournal community.'}</p></div>
    <SitePageBody page={pageContent}/>
    <section className="bj-listing-tools" aria-label="Article filters">
      <label className="bj-page-search"><Search size={17}/><input type="search" value={q} onChange={e => update('q', e.target.value)} placeholder="Search articles, topics, and authors…" aria-label="Search articles"/></label>
      <label className="bj-select-filter"><SlidersHorizontal size={15}/><span className="sr-only">Filter by category</span><select value={category} onChange={e => update('category',e.target.value)}><option value="">All categories</option>{categories.map(item => <option key={item.category} value={item.category}>{item.category}</option>)}</select></label>
      <label className="bj-select-filter"><span className="sr-only">Sort articles</span><select value={sort} onChange={e => update('sort',e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z (current page)</option></select></label>
    </section>
    <div className="bj-results-meta"><span>{pagination.total || 0} published articles</span>{category && <button type="button" onClick={() => update('category','')}>Clear {category} ×</button>}</div>
    {loading ? <div className="bj-state-panel" role="status">Loading articles…</div> : error ? <div className="bj-state-panel bj-error"><h2>Articles are unavailable</h2><p>{error}</p><button className="button button-outline" onClick={() => setAttempt(value => value + 1)}>Try again</button></div> : sorted.length ? <div className="articles-grid bj-route-grid">{sorted.map((article,index) => <ArticleCard key={article.id || article.slug} article={article} featured={index===0 && page===1 && !q && !category}/>)}</div> : <div className="bj-state-panel"><Search size={26}/><h2>No articles match these filters</h2><p>Try a different keyword or select another category.</p><Link className="button button-outline" to="/articles">Show all articles</Link></div>}
    {!loading && pagination.pages > 1 && <nav className="bj-pagination" aria-label="Article pages"><button type="button" disabled={page<=1} onClick={() => update('page',String(page-1))}>Previous</button><span>Page {page} of {pagination.pages}</span><button type="button" disabled={page>=pagination.pages} onClick={() => update('page',String(page+1))}>Next <ArrowRight size={14}/></button></nav>}
  </main>;
}
