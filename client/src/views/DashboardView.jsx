import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Bookmark, FileText, LayoutDashboard, LogOut, Trash2, UserRound } from 'lucide-react';
import { api } from '../api';
import { dateLabel } from '../models/articleModel';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';
import './PublicPages.css';

export default function DashboardView() {
  const page=useSitePageContent('dashboard');
  const [user, setUser] = useState(null);
  const [articles, setArticles] = useState([]);
  const [savedArticles, setSavedArticles] = useState([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);
  const [removing, setRemoving] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { document.title = `${page.title||'Dashboard'} | ByteJournal`; }, [page.title]);

  useEffect(() => {
    let active = true;
    api.me().then(async ({ user: current }) => {
      if (!active) return;
      setUser(current);
      const [articleResult, savedResult] = await Promise.allSettled([api.adminArticles(), api.savedArticles()]);
      if (!active) return;
      if (articleResult.status === 'fulfilled') setArticles(articleResult.value.articles || []);
      else setError(articleResult.reason?.message || 'Your article workspace is currently unavailable.');
      if (savedResult.status === 'fulfilled') setSavedArticles(savedResult.value.articles || []);
      else setSavedError(savedResult.reason?.message || 'Saved articles could not be loaded.');
    }).catch(err => {
      if (active) {
        if (err.status === 401 || err.status === 403) setUnauthorized(true);
        else setError(err.message || 'Unable to load your account.');
      }
    }).finally(() => {
      if (active) { setLoading(false); setSavedLoading(false); }
    });
    return () => { active = false; };
  }, []);

  async function logout() {
    await api.logout().catch(() => {});
    navigate('/', { replace: true });
  }

  async function removeSaved(articleId) {
    setRemoving(articleId);
    setSavedError('');
    try {
      await api.unsaveArticle(articleId);
      setSavedArticles(current => current.filter(article => String(article.id) !== String(articleId)));
    } catch (err) {
      setSavedError(err.message || 'Could not remove this saved article.');
    } finally {
      setRemoving(null);
    }
  }

  if (unauthorized) return <Navigate to="/login?next=%2Fdashboard" replace />;
  if (loading) return <main className="public-page"><div className="bj-state-panel" role="status">Checking your account…</div></main>;

  return <main className="public-page bj-dashboard-page">
    <div className="public-page-heading"><span className="section-kicker">YOUR BYTEJOURNAL / ACCOUNT</span><h1>{page.title||<>Your publishing <em>desk.</em></>}</h1><p>{page.intro||'Review your account, reading list, and contributions.'}</p></div>
    <SitePageBody page={page}/>
    {error && <div className="bj-inline-error" role="status">{error}</div>}
    {user && <>
      <section className="bj-dashboard-profile"><span className="bj-dashboard-avatar"><UserRound size={26}/></span><div><span className="section-kicker">SIGNED IN ACCOUNT</span><h2>{user.name || 'ByteJournal member'}</h2><p>{user.email}</p><span className="bj-role-pill">{String(user.role || 'member').replaceAll('_', ' ')}</span></div><button className="button button-outline" onClick={logout}><LogOut size={15}/> Sign out</button></section>
      <section className="bj-dashboard-actions"><Link to="/cms" className="bj-dashboard-action"><LayoutDashboard size={20}/><span><strong>Publishing workspace</strong><small>Manage articles, drafts, and editorial activity</small></span><ArrowUpRight size={16}/></Link><Link to="/cms/profile" className="bj-dashboard-action"><UserRound size={20}/><span><strong>Edit profile</strong><small>Update your account details and password</small></span><ArrowUpRight size={16}/></Link></section>
      <section className="bj-dashboard-articles bj-dashboard-saved"><div className="section-heading"><div><span className="section-kicker">YOUR READING LIST</span><h2>Saved <em>articles.</em></h2></div><span className="bj-role-pill">{savedArticles.length} saved</span></div>
        {savedError && <div className="bj-inline-error" role="status">{savedError}</div>}
        {savedLoading ? <div className="bj-state-panel">Loading your reading list…</div> : savedArticles.length ? <div className="bj-dashboard-article-list">{savedArticles.map(article => <div className="bj-dashboard-saved-row" key={article.id}><Link to={`/articles/${article.slug}`}><span><strong>{article.title}</strong><small>{article.category} · {dateLabel(article.published_at)}</small></span><ArrowUpRight size={15}/></Link><button type="button" className="bj-remove-saved" onClick={() => removeSaved(article.id)} disabled={removing === article.id} aria-label={`Remove ${article.title} from saved articles`} title="Remove from saved"><Trash2 size={15}/></button></div>)}</div> : <div className="bj-state-panel"><Bookmark size={25}/><h3>Your reading list is empty</h3><p>Open an article and select “Save article” to keep it here for later.</p><Link className="button button-outline" to="/articles">Explore articles</Link></div>}
      </section>
      <section className="bj-dashboard-articles"><div className="section-heading"><div><span className="section-kicker">YOUR CONTENT</span><h2>Recent <em>articles.</em></h2></div><Link to="/cms/articles" className="text-link">Open CMS <ArrowUpRight size={15}/></Link></div>
        {articles.length ? <div className="bj-dashboard-article-list">{articles.slice(0, 8).map(article => <Link key={article.id} to={`/cms/articles/${article.id}/edit`}><span><strong>{article.title}</strong><small>{article.category} · Updated {dateLabel(article.updated_at || article.created_at)}</small></span><span className={`bj-status-pill ${article.status === 'published' ? 'published' : 'draft'}`}>{article.status || 'draft'}</span></Link>)}</div> : <div className="bj-state-panel"><FileText size={25}/><h3>No articles in your workspace yet</h3><p>Start a draft or submit an idea to the editorial team.</p><Link className="button button-dark" to="/cms/articles/new">Write an article</Link></div>}
      </section>
    </>}
  </main>;
}
