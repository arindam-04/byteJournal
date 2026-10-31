import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Code2, Database, FileText, LogOut, Plus, RefreshCw, ShieldCheck, Trash2, X, LayoutDashboard, Users, PanelLeftClose, PanelLeftOpen, UserRound, Globe } from 'lucide-react';
import TiptapEditor from '../components/TiptapEditor';
import DOMPurify from 'dompurify';
import { api } from '../api';
import ThemeButton from '../components/ThemeButton';
import useTheme from '../controllers/useTheme';
import { blankForm, dateLabel, estimate, slugify } from '../models/articleModel';
import AdminProfilePanel from './AdminProfilePanel';


export default function CMSView() {
  const [theme, toggle] = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const routeParams = useParams();
  const isEditorPage = location.pathname.includes('/new') || location.pathname.endsWith('/edit');
  const isDashboard = location.pathname === '/cms' || location.pathname === '/cms/';
  const isProfilePage = location.pathname === '/cms/profile';
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [resetMode, setResetMode] = useState(location.pathname === '/cms/reset-password');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [articles, setArticles] = useState([]);
  const [categorySuggestions, setCategorySuggestions] = useState([]);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [articlePage, setArticlePage] = useState(1);
  const [articlePageSize, setArticlePageSize] = useState(5);
  const [overviewPage, setOverviewPage] = useState(1);
  const [overviewPageSize, setOverviewPageSize] = useState(5);
  const [selectedArticleIds, setSelectedArticleIds] = useState(() => new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState('');
  const [stats, setStats] = useState({ total: 0, published: 0, drafts: 0 });
  const [dirty, setDirty] = useState(false);

  const loadArticles = async () => { const [d, s] = await Promise.all([api.adminArticles(), api.stats()]); setArticles(d.articles || []); setStats(s.stats || { total: 0, published: 0, drafts: 0 }); };
  useEffect(() => {
    api.me().then(d => { setUser(d.user); return Promise.all([loadArticles(),api.categories().then(result=>setCategorySuggestions((result.categories||[]).map(item=>item.category))),api.tags().then(result=>setTagSuggestions(result.tags||[]))]); })
      .catch(err => { if (err.status !== 401) setError(err.message || 'The API is unavailable. Check the backend and database.'); })
      .finally(() => setAuthChecked(true));
  }, []);
  const update = (key, value) => { setDirty(true); setForm(f => ({...f, [key]: value})); };
  const forgotPassword = async (e) => { e.preventDefault(); setError(''); setMessage(''); setBusy(true); try { const d = await api.forgotPassword(email); setMessage(d.message || 'If the admin account exists, a reset link will be sent.'); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const resetPassword = async (e) => { e.preventDefault(); setError(''); setMessage(''); if (resetPasswordValue !== resetPasswordConfirm) { setError('Passwords do not match.'); return; } setBusy(true); try { const token = new URLSearchParams(window.location.search).get('token') || ''; const d = await api.resetPassword(token, resetPasswordValue); setMessage(d.message); setResetMode(false); setForgotMode(false); setResetPasswordValue(''); setResetPasswordConfirm(''); window.history.replaceState({}, '', '/cms'); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const login = async (e) => { e.preventDefault(); setError(''); setBusy(true); try { const d = await api.login(email, password); setUser(d.user); setPassword(''); await loadArticles(); setMessage('Signed in successfully.'); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const logout = async () => { await api.logout().catch(() => {}); setUser(null); setArticles([]); setMessage('Signed out.'); };
  const startNew = (keepMessage = false) => { setDirty(false); setEditing(null); setForm(blankForm); setUploadPreview(''); setError(''); if (!keepMessage) setMessage(''); navigate('/cms/articles/new'); window.scrollTo({top:0,behavior:'smooth'}); };
  const populateEdit = (a) => { setDirty(false); setEditing(a.id); setForm({title:a.title,slug:a.slug,excerpt:a.excerpt,category:a.category,author:a.author,content:a.content,status:a.status,featured:Boolean(a.featured),cover_color:a.cover_color || 'blue',cover_image:a.cover_image || '',tags:a.tags || [],seo_title:a.seo_title || '',meta_description:a.meta_description || '',canonical_url:a.canonical_url || ''}); setUploadPreview(a.cover_image || ''); setError(''); setMessage(''); };
  const startEdit = (a) => { populateEdit(a); navigate(`/cms/articles/${a.id}/edit`); window.scrollTo({top:0,behavior:'smooth'}); };
  useEffect(() => {
    if (!user || !routeParams.id || !articles.length) return;
    const article = articles.find(item => String(item.id) === String(routeParams.id));
    if (article && String(editing) !== String(article.id)) populateEdit(article);
  }, [user, routeParams.id, articles]);
  useEffect(() => { const guard = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, [dirty]);
  const save = async (e) => { e.preventDefault(); setError(''); setMessage(''); setBusy(true); const data = {...form, slug: form.slug.trim() || slugify(form.title), read_minutes: estimate(form.content)}; try { if (editing) await api.updateArticle(editing, data); else await api.createArticle(data); await loadArticles(); setMessage(editing ? 'Article updated.' : 'Article created.'); setDirty(false); navigate('/cms/articles'); } catch(e) { setError(e.message); } finally { setBusy(false); } };
  const previewArticle = () => {
    const win = window.open('', '_blank');
    if (!win) { setError('Allow pop-ups to open the article preview.'); return; }
    win.opener = null;
    const escapeText = value => String(value || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
    const safeContent = DOMPurify.sanitize(form.content || '<p>Your article content will appear here.</p>');
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeText(form.title || 'Article preview')} | ByteJournal</title><style>body{font:17px/1.8 system-ui,sans-serif;max-width:780px;margin:50px auto;padding:0 24px;color:#222}h1{font-size:42px;line-height:1.15}small{color:#68736b}pre{overflow:auto;background:#20231f;color:#f5f5f5;padding:18px;border-radius:8px}img{max-width:100%;height:auto}</style></head><body><small>BYTEJOURNAL · PREVIEW · NOT PUBLISHED</small><h1>${escapeText(form.title || 'Untitled article')}</h1><p>${escapeText(form.excerpt)}</p><hr>${safeContent}</body></html>`);
    win.document.close();
  };
  const remove = async (a) => { if (!window.confirm(`Delete "${a.title}"? This cannot be undone.`)) return; setError(''); try { await api.deleteArticle(a.id); setSelectedArticleIds(current => { const next = new Set(current); next.delete(String(a.id)); return next; }); await loadArticles(); if (editing === a.id) { setEditing(null); setDirty(false); navigate('/cms/articles'); } setMessage('Article deleted.'); } catch(e) { setError(e.message); } };
  const shown = articles.filter(a => filter === 'all' || a.status === filter);
  const articlePageCount = Math.max(1, Math.ceil(shown.length / articlePageSize));
  const currentArticlePage = Math.min(articlePage, articlePageCount);
  const pageArticles = shown.slice((currentArticlePage - 1) * articlePageSize, currentArticlePage * articlePageSize);
  const overviewPageCount = Math.max(1, Math.ceil(articles.length / overviewPageSize));
  const currentOverviewPage = Math.min(overviewPage, overviewPageCount);
  const overviewArticles = articles.slice((currentOverviewPage - 1) * overviewPageSize, currentOverviewPage * overviewPageSize);
  const canEditArticle = a => Boolean(user && (['super_admin','admin'].includes(user.role)
    || (user.role === 'editor' && ['submitted','approved','revision_requested'].includes(a.publication_status))
    || (user.role === 'author' && a.status === 'draft' && ['draft','revision_requested','rejected'].includes(a.publication_status))));
  const canDeleteArticle = a => Boolean(user && (['super_admin','admin'].includes(user.role) || (user.role === 'author' && a.status === 'draft' && ['draft','revision_requested','rejected'].includes(a.publication_status))));
  const canPublishArticle = a => Boolean(user && (['super_admin','admin'].includes(user.role)
    ? a.status !== 'published' || a.publication_status !== 'published'
    : user.role === 'editor' && a.publication_status === 'approved'));
  const canUnpublishArticle = a => Boolean(user && ['super_admin','admin','editor'].includes(user.role)
    && a.status === 'published');
  const bulkEligibility = { delete: canDeleteArticle, publish: canPublishArticle, unpublish: canUnpublishArticle };
  const canSelectArticle = a => Object.values(bulkEligibility).some(canPerform => canPerform(a));
  const selectablePageArticles = pageArticles.filter(canSelectArticle);
  const selectedPageArticles = pageArticles.filter(a => selectedArticleIds.has(String(a.id)));
  const selectedOnPage = selectablePageArticles.filter(a => selectedArticleIds.has(String(a.id))).length;
  const selectedActionCounts = Object.fromEntries(Object.keys(bulkEligibility).map(action => [
    action, selectedPageArticles.filter(bulkEligibility[action]).length
  ]));
  const selectVisibleArticles = checked => setSelectedArticleIds(current => {
    const next = new Set(current);
    selectablePageArticles.forEach(a => checked ? next.add(String(a.id)) : next.delete(String(a.id)));
    return next;
  });
  const clearVisibleArticleSelection = () => setSelectedArticleIds(current => {
    const next = new Set(current);
    selectablePageArticles.forEach(a => next.delete(String(a.id)));
    return next;
  });
  const setCurrentArticlePage = page => { setArticlePage(page); setSelectedArticleIds(new Set()); };
  const articleStatusPayload = (article, status) => ({
    title: article.title, slug: article.slug, excerpt: article.excerpt, category: article.category,
    author: article.author, content: article.content, read_minutes: article.read_minutes || estimate(article.content),
    status, featured: Boolean(article.featured), cover_color: article.cover_color || 'blue',
    cover_image: article.cover_image || '', tags: article.tags || [], seo_title: article.seo_title || '',
    meta_description: article.meta_description || '', canonical_url: article.canonical_url || ''
  });
  const performArticleAction = (article, action) => {
    if (action === 'delete') return api.deleteArticle(article.id);
    if (action === 'publish') return user.role === 'editor'
      ? api.reviewArticle(article.id, 'published')
      : api.updateArticle(article.id, articleStatusPayload(article, 'published'));
    return api.reviewArticle(article.id, 'unpublished');
  };
  const actionPastTense = { delete: 'deleted', publish: 'published', unpublish: 'unpublished' };
  const runArticleAction = async (article, action) => {
    if (!bulkEligibility[action](article)) return;
    if (action === 'delete' && !window.confirm(`Delete "${article.title}"? This cannot be undone.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await performArticleAction(article, action);
      if (action === 'delete') setSelectedArticleIds(current => { const next = new Set(current); next.delete(String(article.id)); return next; });
      await loadArticles();
      setMessage(`Article ${actionPastTense[action]}.`);
    } catch (err) { setError(err.message || 'The article action could not be completed.'); }
    finally { setBusy(false); }
  };
  const closeActionMenu = event => event.currentTarget.closest('details')?.removeAttribute('open');
  const closeArticleMenu = closeActionMenu;
  const runBulkAction = async action => {
    const selected = selectedPageArticles.filter(bulkEligibility[action]);
    if (!selected.length) return;
    if (action === 'delete' && !window.confirm(`Delete ${selected.length} selected article${selected.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    setBusy(true); setError(''); setMessage('');
    const results = await Promise.allSettled(selected.map(article => performArticleAction(article, action)));
    const completed = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.length - completed;
    const skipped = selectedPageArticles.length - selected.length;
    setSelectedArticleIds(new Set());
    try { await loadArticles(); } catch (err) { setError(err.message || 'Articles could not be refreshed.'); }
    if (completed) setMessage(`${completed} article${completed === 1 ? '' : 's'} ${actionPastTense[action]}${skipped ? `; ${skipped} skipped because the action does not apply to their current status or role` : ''}.`);
    if (failed) setError(`${failed} selected article${failed === 1 ? '' : 's'} could not be ${actionPastTense[action]}. Refresh and try again.`);
    setBusy(false);
  };
  const editingArticle = articles.find(a => String(a.id) === String(editing));
  const authorCanSubmit = user?.role === 'author' && editingArticle && editingArticle.status === 'draft' && ['draft','revision_requested','rejected'].includes(editingArticle.publication_status);
  if (!authChecked) return <div className="cms-shell"><div className="loading-line">Checking admin session…</div></div>;
  return <div className="cms-shell"><header className="cms-topbar"><Link to="/" className="brand"><span className="brand-mark"><Code2 size={19}/></span><span>bytejournal<span className="brand-dot">.</span></span></Link><div className="cms-top-actions"><span className="admin-label"><ShieldCheck size={15}/> {user ? `${user.role.replace('_',' ').toUpperCase()} WORKSPACE` : 'ADMIN WORKSPACE'}</span><ThemeButton theme={theme} toggle={toggle}/><Link to="/" className="button button-outline button-small">View site <ArrowUpRight size={14}/></Link></div></header>
    {!user ? <main className="login-layout"><div className="login-aside"><span className="section-kicker">YOUR IDEAS, PUBLISHED</span><h1>A quiet place<br/>to <em>make things clear.</em></h1><p>Manage your writing, polish your drafts, and share what you've learned with the world.</p><div className="login-feature"><span><FileText size={18}/></span><div><strong>One place for every article</strong><small>Draft, edit, and publish when you're ready.</small></div></div><div className="login-feature"><span><Database size={18}/></span><div><strong>Saved to your database</strong><small>Your content lives on the server, not just this browser.</small></div></div></div>
      {resetMode ? <form className="login-card" onSubmit={resetPassword}><div className="login-icon"><ShieldCheck size={23}/></div><span className="section-kicker">ACCOUNT SECURITY</span><h2>Set a new password.</h2><p>Choose a strong password with at least 12 characters.</p>{error && <div className="notice notice-error">{error}</div>}{message && <div className="notice notice-success">{message}</div>}<label className="field-label">New password<input type="password" value={resetPasswordValue} onChange={e=>setResetPasswordValue(e.target.value)} required minLength="12" maxLength="200" autoComplete="new-password"/></label><label className="field-label">Confirm new password<input type="password" value={resetPasswordConfirm} onChange={e=>setResetPasswordConfirm(e.target.value)} required minLength="12" maxLength="200" autoComplete="new-password"/></label><button className="button button-dark full-button" disabled={busy}>{busy ? 'Updating…' : 'Update password'} <ArrowRight size={16}/></button><button type="button" className="text-button" onClick={()=>{setResetMode(false);navigate('/cms');}}>Back to sign in</button></form> : forgotMode ? <form className="login-card" onSubmit={forgotPassword}><div className="login-icon"><ShieldCheck size={23}/></div><span className="section-kicker">ACCOUNT RECOVERY</span><h2>Forgot password?</h2><p>Enter your administrator email. If it matches an eligible account, we’ll send a secure reset link.</p>{error && <div className="notice notice-error">{error}</div>}{message && <div className="notice notice-success">{message}</div>}<label className="field-label">Administrator email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label><button className="button button-dark full-button" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'} <ArrowRight size={16}/></button><button type="button" className="text-button" onClick={()=>{setForgotMode(false);setError('');setMessage('');}}>Back to sign in</button></form> : <form className="login-card" onSubmit={login}><div className="login-icon"><ShieldCheck size={23}/></div><span className="section-kicker">RESTRICTED AREA</span><h2>Welcome back.</h2><p>Sign in to your publishing workspace.</p>{error && <div className="notice notice-error">{error}</div>}{message && <div className="notice notice-success">{message}</div>}<label className="field-label">Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username" /></label><label className="field-label">Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label><button className="button button-dark full-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to CMS'} <ArrowRight size={16}/></button><button type="button" className="text-button" onClick={()=>{setForgotMode(true);setError('');setMessage('');}}>Forgot password?</button><small className="form-hint">Use the admin credentials configured in your root .env file.</small></form>}</main> :
    <main className={`cms-main ${isEditorPage ? 'cms-main-editor' : 'cms-main-articles'} ${sidebarCompact ? 'cms-sidebar-compact' : ''}`}>
      <aside className="cms-sidebar" aria-label="CMS navigation">
        <div className="cms-sidebar-brand"><span className="brand-mark"><Code2 size={18}/></span>{!sidebarCompact && <span>WORKSPACE</span>}</div>
        <button type="button" className="cms-sidebar-toggle" onClick={()=>setSidebarCompact(v=>!v)} title={sidebarCompact?'Expand menu':'Collapse menu'} aria-label={sidebarCompact?'Expand menu':'Collapse menu'}>{sidebarCompact?<PanelLeftOpen size={17}/>:<><PanelLeftClose size={17}/><span>Collapse menu</span></>}</button>
        <div className="cms-sidebar-label">{!sidebarCompact && 'MAIN MENU'}</div>
        <nav className="cms-sidebar-links">
          <Link to="/cms" className={isDashboard?'active':''} title="Overview"><LayoutDashboard size={18}/>{!sidebarCompact && <span>Overview</span>}</Link>
          <Link to="/cms/articles" className={location.pathname === '/cms/articles'?'active':''} title="Articles"><FileText size={18}/>{!sidebarCompact && <span>Articles</span>}</Link>
          <Link to="/cms/articles/new" className={isEditorPage && !editing?'active':''} title="New article"><Plus size={18}/>{!sidebarCompact && <span>New article</span>}</Link>
          {['super_admin','admin','editor'].includes(user.role) && <Link to="/cms/management" title="Management"><Users size={18}/>{!sidebarCompact && <span>Management</span>}</Link>}
          {user.can_edit_website && <Link to="/cms/settings/appearance" title="Edit Website"><Globe size={18}/>{!sidebarCompact && <span>Edit Website</span>}</Link>}
          <Link to="/cms/profile" className={isProfilePage?'active':''} title="My profile"><UserRound size={18}/>{!sidebarCompact && <span>My profile</span>}</Link>
        </nav>
        <div className="cms-sidebar-bottom"><Link to="/" title="View website"><ArrowUpRight size={18}/>{!sidebarCompact && <span>View website</span>}</Link><button type="button" onClick={logout} title="Sign out"><LogOut size={18}/>{!sidebarCompact && <span>Sign out</span>}</button></div>
      </aside>
      <div className="cms-content-area">
      {message && <div className="notice notice-success"><Check size={16}/>{message}<button onClick={()=>setMessage('')} aria-label="Dismiss"><X size={15}/></button></div>}
      {error && <div className="notice notice-error">{error}<button onClick={()=>setError('')} aria-label="Dismiss"><X size={15}/></button></div>}
      {isDashboard ? <>
        <div className="cms-welcome"><div><div className="section-kicker">CMS OVERVIEW</div><h1>Welcome back, <em>{user.name?.split(' ')[0] || 'writer'}.</em></h1><p>Here is what is happening across your publication.</p></div><button className="button button-dark" onClick={startNew}><Plus size={17}/> New article</button></div>
        <div className="cms-stats cms-dashboard-stats"><div><span>Total articles</span><strong>{stats.total}</strong><small>All articles in your library</small></div><div><span>Published</span><strong>{stats.published}</strong><small>Live for readers</small></div><div><span>Drafts</span><strong>{stats.drafts}</strong><small>Work in progress</small></div></div>
        <section className="articles-page-panel cms-dashboard-panel"><div className="panel-heading"><div><span className="section-kicker">RECENT CONTENT</span><h2>Recently updated</h2></div><Link to="/cms/articles" className="button button-outline button-small">All articles <ArrowRight size={14}/></Link></div>
          {articles.length ? <><div className="articles-toolbar"><span>{articles.length} articles</span><label className="articles-page-size"><span>Rows per page</span><select aria-label="Overview rows per page" value={overviewPageSize} onChange={e=>{setOverviewPageSize(Number(e.target.value));setOverviewPage(1);}}><option value={5}>5</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label></div><div className="cms-article-list cms-article-list-page">{overviewArticles.map(a=><div className="cms-article-row" key={a.id}><div className={`mini-cover cover-${a.cover_color || 'blue'}`}><Code2 size={18}/></div><div className="cms-article-info">{a.status==='published'?<Link className="cms-article-title-link" to={`/articles/${a.slug}`}><strong>{a.title}</strong></Link>:<strong>{a.title}</strong>}<span>{a.category} · {dateLabel(a.updated_at || a.published_at)}</span><span className={a.status==='published'?'status status-live':'status status-draft'}><i></i>{a.status}</span></div><div className="cms-row-actions"><details className="cms-article-actions"><summary aria-label={`Actions for ${a.title}`}>Actions <ChevronDown size={13}/></summary><div className="cms-action-menu"><button type="button" disabled={busy||!canEditArticle(a)} onClick={e=>{closeArticleMenu(e);startEdit(a);}}>Edit</button><button type="button" disabled={busy||!canDeleteArticle(a)} onClick={e=>{closeArticleMenu(e);runArticleAction(a,'delete');}}>Delete</button><button type="button" disabled={busy||!canPublishArticle(a)} onClick={e=>{closeArticleMenu(e);runArticleAction(a,'publish');}}>Publish</button><button type="button" disabled={busy||!canUnpublishArticle(a)} onClick={e=>{closeArticleMenu(e);runArticleAction(a,'unpublish');}}>Unpublish</button></div></details></div></div>)}</div><div className="cms-pagination" aria-label="Overview article pages"><span>Showing {(currentOverviewPage - 1) * overviewPageSize + 1}–{Math.min(currentOverviewPage * overviewPageSize, articles.length)} of {articles.length}</span><div><button type="button" className="button button-outline button-small" onClick={()=>setOverviewPage(Math.max(1,currentOverviewPage-1))} disabled={currentOverviewPage===1}>Previous</button><span className="cms-page-count">Page {currentOverviewPage} of {overviewPageCount}</span><button type="button" className="button button-outline button-small" onClick={()=>setOverviewPage(Math.min(overviewPageCount,currentOverviewPage+1))} disabled={currentOverviewPage===overviewPageCount}>Next</button></div></div></> : <div className="cms-empty"><FileText size={25}/><p>No articles yet. Create your first article to get started.</p><button className="button button-dark button-small" onClick={startNew}><Plus size={14}/> New article</button></div>}
        </section>
      </> : isProfilePage ? <AdminProfilePanel user={user} onUserUpdated={updated => setUser(current => ({ ...current, ...updated }))} /> : !isEditorPage ? <>
        <div className="cms-welcome"><div><div className="section-kicker">PUBLISHING WORKSPACE</div><h1>Good work, <em>{user.name?.split(' ')[0] || 'writer'}.</em></h1><p>Manage your stories, review their status, and keep your publication moving.</p></div><button className="button button-dark" onClick={startNew}><Plus size={17}/> New article</button></div>
        <div className="cms-stats"><div><span>Total articles</span><strong>{stats.total}</strong><small>Everything you've written</small></div><div><span>Published</span><strong>{stats.published}</strong><small>Visible to readers</small></div><div><span>Drafts</span><strong>{stats.drafts}</strong><small>Still on the workbench</small></div></div>
        <section className="articles-page-panel"><div className="panel-heading"><div><span className="section-kicker">YOUR LIBRARY</span><h2>All articles <span className="count-badge">{articles.length}</span></h2></div><button className="button button-outline button-small" onClick={loadArticles} title="Refresh articles" aria-label="Refresh articles"><RefreshCw size={15}/> Refresh</button></div>
          <div className="articles-toolbar"><div className="list-filter">{['all','published','draft'].map(s=><button key={s} className={filter===s?'filter-pill active':'filter-pill'} onClick={()=>{setFilter(s);setArticlePage(1);setSelectedArticleIds(new Set());}}>{s==='all'?'All articles':s==='published'?'Published':'Drafts'}</button>)}</div><div className="articles-toolbar-meta"><span>{shown.length} article{shown.length===1?'':'s'}</span><label className="articles-page-size"><span>Rows per page</span><select aria-label="Rows per page" value={articlePageSize} onChange={e=>{setArticlePageSize(Number(e.target.value));setArticlePage(1);setSelectedArticleIds(new Set());}}><option value={5}>5</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label></div></div>
          {shown.length ? <>
            {selectablePageArticles.length > 0 && <div className="cms-bulk-toolbar"><span>{selectedPageArticles.length} selected</span><details className="cms-bulk-menu"><summary>Bulk actions <ChevronDown size={14}/></summary><div className="cms-bulk-menu-content"><button type="button" onClick={e=>{closeActionMenu(e);selectVisibleArticles(true);}} disabled={busy}>Select all on this page <span>{selectablePageArticles.length}</span></button><button type="button" onClick={e=>{closeActionMenu(e);clearVisibleArticleSelection();}} disabled={!selectedOnPage||busy}>Clear selection</button><div className="cms-bulk-menu-separator"/>{['super_admin','admin','author'].includes(user.role) && <button type="button" onClick={e=>{closeActionMenu(e);runBulkAction('delete');}} disabled={!selectedActionCounts.delete||busy}>Delete <span>{selectedActionCounts.delete}</span></button>}{['super_admin','admin','editor'].includes(user.role) && <button type="button" onClick={e=>{closeActionMenu(e);runBulkAction('publish');}} disabled={!selectedActionCounts.publish||busy}>Publish <span>{selectedActionCounts.publish}</span></button>}{['super_admin','admin','editor'].includes(user.role) && <button type="button" onClick={e=>{closeActionMenu(e);runBulkAction('unpublish');}} disabled={!selectedActionCounts.unpublish||busy}>Unpublish <span>{selectedActionCounts.unpublish}</span></button>}</div></details></div>}
            <div className="cms-article-list cms-article-list-page">{pageArticles.map(a=><div className="cms-article-row" key={a.id}>{canSelectArticle(a) && <label className="cms-row-select"><input type="checkbox" checked={selectedArticleIds.has(String(a.id))} onChange={e=>{const checked=e.target.checked;setSelectedArticleIds(current=>{const next=new Set(current);checked?next.add(String(a.id)):next.delete(String(a.id));return next;});}} aria-label={`Select ${a.title} for bulk actions`}/></label>}<div className={`mini-cover cover-${a.cover_color || 'blue'}`}><Code2 size={18}/></div><div className="cms-article-info">{a.status==='published'?<Link className="cms-article-title-link" to={`/articles/${a.slug}`}><strong>{a.title}</strong></Link>:<strong>{a.title}</strong>}<span>{a.category} · {dateLabel(a.published_at)}</span><span className={a.status==='published'?'status status-live':'status status-draft'}><i></i>{a.status}</span></div><div className="cms-row-actions"><details className="cms-article-actions"><summary aria-label={`Actions for ${a.title}`}>Actions <ChevronDown size={13}/></summary><div className="cms-action-menu"><button type="button" disabled={busy||!canEditArticle(a)} onClick={e=>{closeActionMenu(e);startEdit(a);}}>Edit</button><button type="button" disabled={busy||!canDeleteArticle(a)} onClick={e=>{closeActionMenu(e);runArticleAction(a,'delete');}}>Delete</button><button type="button" disabled={busy||!canPublishArticle(a)} onClick={e=>{closeActionMenu(e);runArticleAction(a,'publish');}}>Publish</button><button type="button" disabled={busy||!canUnpublishArticle(a)} onClick={e=>{closeActionMenu(e);runArticleAction(a,'unpublish');}}>Unpublish</button></div></details></div></div>)}</div>
            <div className="cms-pagination" aria-label="Article pages"><span>Showing {(currentArticlePage - 1) * articlePageSize + 1}–{Math.min(currentArticlePage * articlePageSize, shown.length)} of {shown.length}</span><div><button type="button" className="button button-outline button-small" onClick={()=>setCurrentArticlePage(currentArticlePage-1)} disabled={currentArticlePage===1}>Previous</button><span className="cms-page-count">Page {currentArticlePage} of {articlePageCount}</span><button type="button" className="button button-outline button-small" onClick={()=>setCurrentArticlePage(currentArticlePage+1)} disabled={currentArticlePage===articlePageCount}>Next</button></div></div>
          </> : <div className="cms-empty"><FileText size={25}/><p>No articles in this view yet.</p><button className="button button-dark button-small" onClick={startNew}><Plus size={14}/> Create your first article</button></div>}
        </section>
      </> : <>
        <div className="editor-page-heading"><div><span className="section-kicker">{editing ? 'REFINE YOUR STORY' : 'PUBLISHING WORKSPACE'}</span><h1>{editing ? 'Edit article' : 'Create a new article'}</h1><p>Write and prepare your story for publication.</p></div><div className="editor-heading-actions"><Link to="/cms/articles" className="button button-outline button-small">Back to articles</Link><button type="button" className="button button-outline button-small" onClick={previewArticle}>Preview <ArrowUpRight size={14}/></button></div></div>
        <form onSubmit={save} className="article-editor-layout">
          <section className="editor-panel article-writing-panel">
            {user.role==='author' && editingArticle && !authorCanSubmit && <div className="notice">This article is with the editorial team. You can edit it again after a revision request.</div>}
            <label className="field-label editor-title-field">Article title<input value={form.title} onChange={e=>{update('title',e.target.value);if(!editing) update('slug',slugify(e.target.value));}} maxLength="180" required placeholder="The idea you want to share"/></label>
            <label className="field-label">URL slug<input value={form.slug} onChange={e=>update('slug',slugify(e.target.value))} required placeholder="your-article-url"/><small>URL: /article/{form.slug || 'your-article-url'}</small></label>
            <label className="field-label">Short description<textarea value={form.excerpt} onChange={e=>update('excerpt',e.target.value)} rows="2" maxLength="320" required placeholder="What will readers learn?"/></label>
            <div className="field-label"><span>Article content</span><div className="rich-editor"><TiptapEditor value={form.content} onChange={value=>update('content',value)} onError={setError}/></div></div>
            <div className="editor-bottom"><span>{form.content.replace(/<[^>]*>/g,' ').trim().split(/\s+/).filter(Boolean).length} words · about {estimate(form.content.replace(/<[^>]*>/g,' '))} min read</span><span>{editingArticle ? `Workflow: ${editingArticle.publication_status || editingArticle.status}` : 'Rich text · code blocks · tables'}</span></div>
          </section>
          <aside className="editor-sidebar">
            <section className="editor-sidebar-card"><div className="sidebar-card-heading">PUBLISHING</div>
              {['super_admin','admin'].includes(user.role) ? <label className="field-label">Status<select value={form.status} onChange={e=>update('status',e.target.value)}><option value="draft">Save as draft</option><option value="published">Publish article</option></select></label> : <div className="field-label"><span>Publication status</span><small>{user.role==='author'?'Save drafts and submit them for editorial review.':'Editors publish approved submissions from Pending reviews.'}</small></div>}
              {['super_admin','admin'].includes(user.role) && <label className="field-label editor-feature-toggle"><span><input type="checkbox" checked={Boolean(form.featured)} onChange={e=>update('featured',e.target.checked)}/> Featured on homepage</span><small>Featured articles appear in the curated homepage section.</small></label>}
              <div className="sidebar-action-stack"><button className="button button-dark full-button" disabled={busy || (user.role==='author' && editingArticle && !authorCanSubmit)}>{busy ? 'Saving…' : editing ? 'Save changes' : form.status==='published' ? 'Publish article' : 'Save draft'} <ArrowUpRight size={16}/></button>{authorCanSubmit && <button type="button" className="button button-outline full-button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await api.updateArticle(editing,{...form,status:'draft',read_minutes:estimate(form.content)});await api.submitArticle(editing);await loadArticles();setMessage('Article submitted for editorial review.');navigate('/cms/articles');}catch(e){setError(e.message);}finally{setBusy(false);}}}>Submit for review</button>}</div>
            </section>
            <section className="editor-sidebar-card"><div className="sidebar-card-heading">ARTICLE DETAILS</div>
              <label className="field-label">Category<input list="article-categories" value={form.category} onChange={e=>update('category',e.target.value)} maxLength="80" required placeholder="Choose or create"/><datalist id="article-categories">{[...new Set(['Backend','Web','Database','System Design','AI','DevOps',...categorySuggestions,...articles.map(a=>a.category)])].map(c=><option key={c} value={c}/>)}</datalist></label>
              <label className="field-label">Author<input value={form.author} onChange={e=>update('author',e.target.value)} required maxLength="80" readOnly={['author','editor'].includes(user.role)}/></label>
              <label className="field-label">Tags<input list="article-tags" value={(form.tags||[]).join(', ')} onChange={e=>update('tags',e.target.value.split(',').map(t=>t.trim()).filter(Boolean).slice(0,20))} placeholder="react, backend, tutorial"/><datalist id="article-tags">{tagSuggestions.map(tag=><option key={tag} value={tag}/>)}</datalist><small>Separate tags with commas.</small></label>
            </section>
            <section className="editor-sidebar-card"><div className="sidebar-card-heading">FEATURED IMAGE</div>
              <label className="field-label">Upload cover<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setUploading(true);setError('');try{const out=await api.uploadImage(file);update('cover_image',out.url);setUploadPreview(out.url);}catch(err){setError(err.message);}finally{setUploading(false);e.target.value='';}}}/></label>{uploading&&<small>Uploading image…</small>}{uploadPreview&&<div className="upload-preview"><img src={uploadPreview.startsWith('http')?uploadPreview:api.assetUrl(uploadPreview)} alt="Cover image preview"/><button type="button" className="button button-outline button-small" onClick={()=>{update('cover_image','');setUploadPreview('')}}>Remove image</button></div>}
              <label className="field-label">Cover style<select value={form.cover_color} onChange={e=>update('cover_color',e.target.value)}>{['blue','orange','purple','green','pink','teal'].map(c=><option key={c}>{c}</option>)}</select></label>
            </section>
            <section className="editor-sidebar-card"><div className="sidebar-card-heading">SEO SETTINGS</div>
              <label className="field-label">SEO title<input value={form.seo_title||''} maxLength="180" onChange={e=>update('seo_title',e.target.value)} placeholder="Optional search result title"/></label>
              <label className="field-label">Meta description<textarea value={form.meta_description||''} maxLength="320" rows="3" onChange={e=>update('meta_description',e.target.value)} placeholder="Short search-engine description"/></label>
              <label className="field-label">Canonical URL<input type="url" value={form.canonical_url || ''} onChange={e=>update('canonical_url',e.target.value)} placeholder="https://example.com/article/..."/><small>Optional. Leave blank to use this article URL.</small></label>
            </section>
            <button type="button" className="button button-outline full-button" onClick={startNew}>Clear form</button>
          </aside>
        </form>
      </>}
      <div className="cms-footer-note"><ShieldCheck size={16}/><span>Signed in as <strong>{user.email}</strong>. CMS actions are protected by the API.</span></div>
      </div>
    </main>}
    <footer className="cms-bottom"><span>BYTEJOURNAL CMS</span><span>WRITE WITH INTENTION. PUBLISH WITH CARE.</span><span>© {new Date().getFullYear()}</span></footer>
  </div>;
}
