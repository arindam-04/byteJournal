import { Code2, Database, Globe2, Terminal } from 'lucide-react';
import { categoryColors } from '../models/articleModel';

export default function Cover({ article, large = false }) {
  const color = article.cover_color || categoryColors[article.category] || 'blue';
  return <div className={`article-cover cover-${color} ${large ? 'cover-large' : ''}`}>
    <div className="cover-grid"></div><span className="cover-chip">{article.category || 'Engineering'}</span>
    <div className="cover-illustration">{article.category === 'Database' ? <Database/> : article.category === 'Web' ? <Globe2/> : article.category === 'System Design' ? <Terminal/> : <Code2/>}</div>
    <span className="cover-word">{(article.category || 'CODE').toUpperCase()}</span>
  </div>;
}
