import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight, ArrowLeft, UserRound } from 'lucide-react';
import { api } from '../api';
import { dateLabel } from '../models/articleModel';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';
export default function AuthorProfileView(){
  const page=useSitePageContent('authorProfile');
  const {id}=useParams();
  const [data,setData]=useState(null),[error,setError]=useState('');
  useEffect(()=>{if(data)document.title=`${page.title||data.author.name} | ByteJournal`},[page.title,data]);
  useEffect(()=>{let live=true;setData(null);setError('');api.author(id).then(result=>{if(live)setData(result);}).catch(e=>{if(live)setError(e.message||'Author profile not found.');});return()=>{live=false};},[id]);
  if(error)return <main className="article-page"><Link to="/" className="back-link"><ArrowLeft size={14}/> Back to journal</Link><div className="empty-state"><h2>Author not found</h2><p>{error}</p></div></main>;
  if(!data)return <main className="article-page"><div className="loading-line">Loading author profile…</div></main>;
  return <main className="article-page author-profile"><Link to="/" className="back-link"><ArrowLeft size={14}/> Back to journal</Link><div className="author-profile-head"><span className="author-profile-icon"><UserRound size={25}/></span><div><span className="category-label">{page.title||'BYTEJOURNAL CONTRIBUTOR'}</span><h1>{data.author.name}</h1><p>{data.author.expertise||'Technical writer'}</p></div></div>{data.author.bio&&<p className="article-deck">{data.author.bio}</p>}{page.intro&&<p className="article-deck">{page.intro}</p>}<SitePageBody page={page} className="author-profile-custom-content"/><div className="section-heading"><h2>Published articles <em>({data.author.article_count})</em></h2></div>{data.articles.length?<div className="author-article-list">{data.articles.map(article=><Link key={article.id} to={`/articles/${article.slug}`}><div><strong>{article.title}</strong><span>{article.category} · {article.read_minutes||1} min read · {dateLabel(article.published_at)}</span></div><ArrowUpRight size={17}/></Link>)}</div>:<p className="muted-copy">No public articles are available yet.</p>}</main>;
}
