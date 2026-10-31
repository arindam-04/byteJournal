import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, BookmarkCheck, Code2, Share2, Check } from 'lucide-react';
import { api } from '../api';
import Cover from '../components/Cover';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { dateLabel, estimate } from '../models/articleModel';

export default function ArticleView({siteName='ByteJournal',browserTitle='ByteJournal — Technical Journal',defaultSocialImage=''}) {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [error, setError] = useState('');
  const [related, setRelated] = useState([]);
  const [copied,setCopied] = useState(false);
  const [saved,setSaved] = useState(false);
  const [saveAuth,setSaveAuth] = useState(null);
  const [saveBusy,setSaveBusy] = useState(false);
  const [saveMessage,setSaveMessage] = useState('');
  useEffect(() => { let active = true; setArticle(null); setError(''); api.article(slug).then(d => { if (active) { setArticle(d.article); api.articles(`?category=${encodeURIComponent(d.article.category)}&limit=5`).then(r => setRelated((r.articles || []).filter(a => a.slug !== slug).slice(0,3))).catch(() => setRelated([])); } }).catch(e => { if (active) setError(e.message || 'This article could not be found.'); }); return () => { active = false; }; }, [slug]);
  useEffect(() => {
    let active = true;
    if (!article?.id) return undefined;
    setSaveMessage('');
    setSaveAuth(null);
    setSaved(false);
    api.savedArticles().then(({ articles = [] }) => {
      if (active) { setSaveAuth(true); setSaved(articles.some(item => String(item.id) === String(article.id))); }
    }).catch(error => {
      if (active) { if (error.status === 401) setSaveAuth(false); else setSaveMessage(error.message || 'Saved articles are unavailable.'); }
    });
    return () => { active = false; };
  }, [article?.id]);
  async function toggleSaved() {
    if (!article?.id || saveBusy) return;
    setSaveBusy(true); setSaveMessage('');
    try {
      if (saved) { await api.unsaveArticle(article.id); setSaved(false); }
      else { await api.saveArticle(article.id); setSaved(true); }
    } catch (error) { setSaveMessage(error.message || 'Could not update your reading list.'); }
    finally { setSaveBusy(false); }
  }
  useEffect(() => { if (!article) return; document.title = article.seo_title || `${article.title} | ${siteName}`; let meta = document.querySelector('meta[name=description]'); if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); } meta.content = article.meta_description || article.excerpt || '';
    let canonical = document.querySelector('link[rel=canonical]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = article.canonical_url || window.location.href;
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) { ogTitle = document.createElement('meta'); ogTitle.setAttribute('property','og:title'); document.head.appendChild(ogTitle); }
    ogTitle.content = article.seo_title || article.title;
    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (!ogDescription) { ogDescription = document.createElement('meta'); ogDescription.setAttribute('property','og:description'); document.head.appendChild(ogDescription); }
    ogDescription.content = article.meta_description || article.excerpt || '';
    const setMeta = (selector,attribute,value,name) => {
      let element=document.querySelector(selector);
      if(!element){element=document.createElement('meta');element.setAttribute(attribute,name);document.head.appendChild(element);}
      element.content=value || '';
    };
    setMeta('meta[property="og:type"]','property','article','og:type');
    setMeta('meta[property="og:url"]','property',article.canonical_url || window.location.href,'og:url');
    const shareImage=article.cover_image ? api.assetUrl(article.cover_image) : (defaultSocialImage ? api.assetUrl(defaultSocialImage) : '');
    setMeta('meta[property="og:image"]','property',shareImage,'og:image');
    setMeta('meta[name="twitter:card"]','name','summary_large_image','twitter:card');
    setMeta('meta[name="twitter:title"]','name',article.seo_title || article.title,'twitter:title');
    setMeta('meta[name="twitter:description"]','name',article.meta_description || article.excerpt || '', 'twitter:description');
    setMeta('meta[name="twitter:image"]','name',shareImage, 'twitter:image');
    return () => { document.title = browserTitle; }; }, [article,siteName,browserTitle,defaultSocialImage]);
  useEffect(() => { document.querySelectorAll('.rich-content pre code').forEach(el => { try { hljs.highlightElement(el); } catch {} const pre = el.parentElement; if (pre && !pre.querySelector('.copy-code')) { const btn = document.createElement('button'); btn.className = 'copy-code'; btn.type = 'button'; btn.textContent = 'Copy code'; btn.addEventListener('click', async () => { await navigator.clipboard.writeText(el.innerText); btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy code'; }, 1400); }); pre.appendChild(btn); } }); }, [article]);
  async function shareArticle(){ const url=window.location.href; if(navigator.share){try{await navigator.share({title:article?.title||'ByteJournal article',url});return;}catch(e){if(e.name==='AbortError')return;}} try{await navigator.clipboard.writeText(url);setCopied(true);window.setTimeout(()=>setCopied(false),1800);}catch{setError('Could not copy the article link.');} }
  if (error) return <main className="article-page"><div className="empty-state"><h2>Article not found</h2><p>{error}</p><Link className="button button-dark" to="/">Back to journal</Link></div></main>;
  if (!article) return <main className="article-page"><div className="loading-line">Loading article…</div></main>;
  return <main className="article-page"><Link to="/" className="back-link"><ArrowLeft size={16}/> Back to journal</Link><div className="article-detail-header"><div className="eyebrow-row"><span className="category-label">{article.category}</span><span className="eyebrow-dot">·</span><span>{article.read_minutes || estimate(article.content)} min read</span></div><h1>{article.title}</h1><p className="article-deck">{article.excerpt}</p><div className="article-meta detail-meta"><span className="avatar">{(article.author || 'B').slice(0,1).toUpperCase()}</span>{article.author_id ? <Link to={`/authors/${article.author_id}`}>{article.author || 'ByteJournal Team'}</Link> : <span>{article.author || 'ByteJournal Team'}</span>}<span className="meta-divider">/</span><time>{dateLabel(article.published_at)}</time></div></div>{article.cover_image ? <img className="article-cover-image" src={api.assetUrl(article.cover_image)} alt={article.title}/> : <Cover article={article} large/>}<script type="application/ld+json">{JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: article.meta_description || article.excerpt, author: { '@type': 'Person', name: article.author || 'ByteJournal Team' }, datePublished: article.published_at, dateModified: article.updated_at, mainEntityOfPage: article.canonical_url || window.location.href, image: article.cover_image ? api.assetUrl(article.cover_image) : (defaultSocialImage ? api.assetUrl(defaultSocialImage) : undefined) })}</script><div className="article-share-actions">{saveAuth === true ? <button type="button" className="button button-outline button-small bj-article-save-button" onClick={toggleSaved} disabled={saveBusy} aria-pressed={saved}>{saved?<BookmarkCheck size={14}/>:<Bookmark size={14}/>} {saveBusy?'Saving…':saved?'Saved':'Save article'}</button> : saveAuth === false ? <Link className="button button-outline button-small" to={`/login?next=${encodeURIComponent(window.location.pathname)}`}><Bookmark size={14}/> Sign in to save</Link> : <button type="button" className="button button-outline button-small" disabled>{saveMessage ? 'Reading list unavailable' : 'Checking account…'}</button>}<button className="button button-outline button-small" onClick={shareArticle}>{copied?<Check size={14}/>:<Share2 size={14}/>} {copied?'Link copied':'Share article'}</button>{saveMessage&&<span className="bj-save-message" role="status">{saveMessage}</span>}</div><article className="prose rich-content" dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(article.content || '')}} />{(article.tags||[]).length>0&&<div className="article-tags">{article.tags.map(t=><span key={t}>#{t}</span>)}</div>}<div className="article-end"><span></span><Code2 size={19}/><span></span></div>{related.length > 0 && <section className="related-articles"><h2>Related field notes</h2><div>{related.map(item => <Link key={item.id} to={`/articles/${item.slug}`}><strong>{item.title}</strong><span>{item.category} · {item.read_minutes || estimate(item.content)} min read</span></Link>)}</div></section>}<Link to="/articles" className="button button-outline"><ArrowLeft size={16}/> All articles</Link></main>;
}
