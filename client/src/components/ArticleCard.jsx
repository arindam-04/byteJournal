import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import Cover from './Cover';
import { dateLabel, estimate } from '../models/articleModel';

export default function ArticleCard({ article, featured = false }) {
  return <article className={featured ? 'article-card featured-card' : 'article-card'}>
    <Link to={`/articles/${article.slug}`} className="card-cover-link"><Cover article={article} large={featured}/></Link>
    <div className="card-content"><div className="eyebrow-row"><span className="category-label">{article.category}</span><span className="eyebrow-dot">·</span><span>{article.read_minutes || estimate(article.content)} min read</span></div>
      <h3><Link to={`/articles/${article.slug}`}>{article.title}</Link></h3><p className="card-excerpt">{article.excerpt}</p>
      <div className="article-meta"><span className="avatar">{(article.author || 'B').slice(0,1).toUpperCase()}</span><span>{article.author || 'ByteJournal Team'}</span><span className="meta-divider">/</span><time>{dateLabel(article.published_at)}</time><Link to={`/articles/${article.slug}`} className="card-arrow" aria-label={`Read ${article.title}`}><ArrowUpRight size={17}/></Link></div>
    </div>
  </article>;
}
