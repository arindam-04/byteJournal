import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Copy, RefreshCw, ShieldCheck, Users, UserPlus, Palette, ClipboardList, Globe, Mail } from 'lucide-react';
import { api } from '../api';
import CmsPaginatedList from '../components/CmsPaginatedList';
import CmsRowActions from '../components/CmsRowActions';
import ThemeButton from '../components/ThemeButton';
import useTheme from '../controllers/useTheme';

const defaultLightPalette={
  background:'#F7F3EB',surface:'#FFFFFF',elevatedSurface:'#F0EBE1',primaryText:'#242424',secondaryText:'#62635C',mutedText:'#77776F',
  primaryAccent:'#526B55',accentHover:'#405642',accentText:'#FFFFFF',links:'#405E45',borders:'#E2DCCF',inputs:'#FFFEFA'
};
const defaultDarkPalette={
  background:'#171916',surface:'#22251F',elevatedSurface:'#2A2D26',primaryText:'#F2EEE5',secondaryText:'#B6B7AE',mutedText:'#9B9D93',
  primaryAccent:'#A6B8A3',accentHover:'#C0D0BA',accentText:'#171916',links:'#C0D0BA',borders:'#393C34',inputs:'#1C1F1A'
};
const paletteFields=[
  ['background','Page background'],['surface','Card/surface'],['elevatedSurface','Elevated surface'],['primaryText','Primary text'],
  ['secondaryText','Secondary text'],['mutedText','Muted text'],['primaryAccent','Primary accent'],['accentHover','Accent hover'],
  ['accentText','Accent text'],['links','Links'],['borders','Borders'],['inputs','Inputs']
];
const defaultAppearance = {
  siteName: 'ByteJournal', tagline: 'Ideas with depth.', browserTitle: 'ByteJournal — Technical Journal',
  primaryColor: '#526B55', secondaryColor: '#FFFFFF', accentColor: '#405642',
  backgroundColor: '#F7F3EB', surfaceColor: '#FFFFFF', textColor: '#242424', linkColor: '#405E45',
  lightPalette:defaultLightPalette,darkPalette:defaultDarkPalette,
  logoUrl:'',faviconUrl:'',defaultSocialImage:'',headingFont:'manrope',bodyFont:'system',codeFont:'mono',fontSize:'medium',
  headerLayout:'split',navigationLayout:'links',footerLayout:'columns',articleCardStyle:'bordered',borderRadius:8,contentWidth:1200,homepageLayout:'editorial',
  homepageIntro:'A technical journal for curious builders. Explore software architecture, web engineering, databases, and the ideas shaping what comes next.',
  homepageOrder:['featured','latest','popular','topics'],homepageCategories:[],showFeatured:true,showLatest:true,showPopular:true,featuredCount:1,latestCount:8,popularCount:4,themePreference:'system'
};
const roles = ['super_admin','admin','editor','author'];
const statusList = ['Pending','Under Review','Approved','Rejected','Invited','Completed'];
const formatDate = value => value ? new Date(value).toLocaleString() : '—';
export default function CMSManagementView() {
  const location=useLocation();
  const navigate=useNavigate();
  const [theme,toggle] = useTheme();
  const [user,setUser] = useState(null);
  const [checked,setChecked] = useState(false);
  const [tab,setTab] = useState(()=>{const initial=location.state?.tab || (location.pathname==='/cms/settings/appearance'?'appearance':'overview');return initial==='pages'?'appearance':initial;});
  const [dashboard,setDashboard] = useState(null);
  const [applications,setApplications] = useState([]);
  const [reviewArticles,setReviewArticles] = useState([]);
  const [reviewNotes,setReviewNotes] = useState({});
  const [media,setMedia] = useState([]);
  const [categories,setCategories] = useState([]);
  const [tags,setTags] = useState([]);
  const [categoryForm,setCategoryForm] = useState({name:'',description:'',is_active:true});
  const [tagForm,setTagForm] = useState({name:'',description:''});
  const [invitations,setInvitations] = useState([]);
  const [users,setUsers] = useState([]);
  const [appearance,setAppearance] = useState(defaultAppearance);
  const [appearanceHasPublished,setAppearanceHasPublished] = useState(false);
  const [status,setStatus] = useState('');
  const [search,setSearch] = useState('');
  const [email,setEmail] = useState('');
  const [role,setRole] = useState('author');
  const [notes,setNotes] = useState({});
  const [inviteLink,setInviteLink] = useState('');
  const [inviteLinkNote,setInviteLinkNote] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const canManageRole = user && ['super_admin','admin','editor'].includes(user.role);
  const isSuper = user?.role === 'super_admin';
  const canEditWebsite = isSuper || user?.role === 'admin' || Boolean(user?.can_edit_website);
  const canManage = Boolean(canManageRole || canEditWebsite);
  const canInvite = ['super_admin','admin'].includes(user?.role);
  const canTaxonomy = ['super_admin','admin'].includes(user?.role);

  async function loadAll(currentTab = tab) {
    setError('');
    try {
      if (currentTab === 'overview') setDashboard(await api.dashboard());
      if (currentTab === 'reviews') {
        const result = await api.adminArticles();
        setReviewArticles((result.articles || []).filter(article => ['submitted','approved'].includes(article.publication_status)));
      }
      if (currentTab === 'media') { const result = await api.media(); setMedia(result.assets || []); }
      if (currentTab === 'categories' && canTaxonomy) { const result = await api.adminCategories(); setCategories(result.categories || []); }
      if (currentTab === 'tags' && canTaxonomy) { const result = await api.adminTags(); setTags(result.tags || []); }
      if (currentTab === 'applications') {
        const result = await api.authorRequests({ ...(status ? {status} : {}), ...(search ? {q:search} : {}) });
        setApplications(result.applications || []);
      }
      if (currentTab === 'invitations') { const result = await api.invitations(); setInvitations(result.invitations || []); }
      if (currentTab === 'users' && isSuper) { const result = await api.users(); setUsers(result.users || []); }
      if (currentTab === 'appearance' && canEditWebsite) {
        const result = await api.adminAppearance();
        setAppearance({...defaultAppearance,...(result.draft || {}),lightPalette:{...defaultLightPalette,...(result.draft?.lightPalette||{})},darkPalette:{...defaultDarkPalette,...(result.draft?.darkPalette||{})}});
        setAppearanceHasPublished(Boolean(result.hasPublished));
      }
    } catch (e) { setError(e.message || 'Could not load CMS data.'); }
  }

  useEffect(() => {
    api.me().then(result => setUser(result.user)).catch(e => setError(e.message || 'Please sign in.')).finally(() => setChecked(true));
  }, []);
  useEffect(() => { if (user) loadAll(tab); }, [user,tab]);
  useEffect(() => {
    if (user && canEditWebsite && !canManageRole && tab!=='appearance') {
      setTab('appearance');
      navigate('/cms/settings/appearance',{replace:true,state:{tab:'appearance'}});
    }
  }, [user,canEditWebsite,canManageRole,tab,navigate]);

  async function action(fn, success) {
    setBusy(true); setError(''); setMessage('');
    try { const result = await fn(); setMessage(success); await loadAll(tab); return result; }
    catch (e) { setError(e.message || 'Action failed.'); return null; }
    finally { setBusy(false); }
  }
  async function inviteApplicant(application) {
    setEmail(application.email); setRole('author');
    const result = await action(() => api.createInvitation(application.email,'author'), 'Invitation created.');
    showInvitationDelivery(result,application.email,'Invitation');
  }
  async function createInvite(e) {
    e.preventDefault();
    const recipient=email;
    const result = await action(() => api.createInvitation(email,role), 'Invitation created.');
    showInvitationDelivery(result,recipient,'Invitation');
    setEmail('');
  }
  async function refreshInvite(id) {
    const recipient=invitations.find(item=>String(item.id)===String(id))?.email||'the invitee';
    const result = await action(() => api.resendInvitation(id), 'Invitation link regenerated.');
    showInvitationDelivery(result,recipient,'Resent invitation');
  }
  function showInvitationDelivery(result,recipient,label) {
    if(!result) return;
    if(result.delivery==='email') {
      setInviteLink('');
      setInviteLinkNote('');
      setMessage(`${label} email sent to ${recipient}.`);
      return;
    }
    if(result.acceptanceUrl) {
      setInviteLink(new URL(result.acceptanceUrl,window.location.origin).toString());
      setInviteLinkNote(result.deliveryReason==='not_configured'
        ? 'SMTP is not configured. Copy and send this one-time link manually.'
        : result.deliveryReason==='configuration'
          ? `${result.deliveryMessage || 'SMTP settings are incomplete.'} Copy and send this one-time link manually.`
          : `Email delivery failed${result.deliveryCode ? ` (${result.deliveryCode})` : ''}. Copy and send this one-time link manually; check the API log and SMTP settings.`);
      setMessage(`${label} created, but email was not sent.`);
    }
  }
  async function sendTestEmail() { await action(()=>api.testEmail(),'Test email sent to your account inbox.'); }
  async function updateApplication(id,newStatus) {
    await action(() => api.updateAuthorRequest(id,{status:newStatus,review_notes:notes[id] || ''}), `Application marked ${newStatus}.`);
  }
  async function updateAccount(id,data) { await action(() => api.updateUser(id,data),'User account updated.'); }
  async function saveAppearance(e) { e.preventDefault(); await action(() => api.updateAppearance(appearance),'Appearance settings saved.'); }
  async function publishAppearance() { const saved=await action(() => api.updateAppearance(appearance),'Appearance draft saved.'); if(!saved)return; const published=await action(() => api.publishAppearance(),'Appearance changes published to the public website.'); if(published){setAppearanceHasPublished(true);window.dispatchEvent(new Event('siteSettingsUpdated'));} }
  function updatePalette(mode,key,value) { setAppearance(current=>({...current,[mode]:{...current[mode],[key]:value}})); }
  async function uploadBrandAsset(key,file) { if(!file) return; setBusy(true);setError('');try{const result=await api.uploadImage(file);setAppearance(current=>({...current,[key]:result.url}));setMessage('Image uploaded. Save the appearance draft to keep this setting.');}catch(e){setError(e.message||'Image upload failed.');}finally{setBusy(false);} }
  function moveHomepageSection(index,delta) { setAppearance(current=>{ const next=[...current.homepageOrder];const target=index+delta;if(target<0||target>=next.length)return current;[next[index],next[target]]=[next[target],next[index]];return {...current,homepageOrder:next}; }); }
  async function saveCategory(e) { e.preventDefault(); const {id,...data}=categoryForm; const result=await action(() => id ? api.updateCategory(id,data) : api.createCategory(data),id?'Category updated.':'Category created.'); if(result) setCategoryForm({name:'',description:'',is_active:true}); }
  async function saveTag(e) { e.preventDefault(); const {id,...data}=tagForm; const result=await action(() => id ? api.updateTag(id,data) : api.createTag(data),id?'Tag updated.':'Tag created.'); if(result) setTagForm({name:'',description:''}); }
  async function removeCategory(item) { if(item.article_count>0){await action(() => api.updateCategory(item.id,{is_active:false}),'Category deactivated to preserve article history.');return;} await action(() => api.deleteCategory(item.id),'Category deleted.'); }
  async function removeTag(item) { await action(() => api.deleteTag(item.id),'Tag deleted.'); }
  async function removeMedia(asset) { if(asset.reference_count) return; if(!window.confirm(`Delete ${asset.url.split('/').pop()}?`)) return; await action(() => api.deleteMedia(asset.id),'Media asset deleted.'); }
  const navigation = [
    ...(canManageRole ? [['overview','Overview',ShieldCheck],['reviews','Pending reviews',ClipboardList],['media','Media library',Palette],['applications','Author requests',ClipboardList]] : []),
    ...(canTaxonomy ? [['categories','Categories',Palette],['tags','Tags',ClipboardList]] : []),
    ...(canInvite ? [['invitations','Invitations',UserPlus]] : []),
    ...(isSuper ? [['users','User management',Users]] : []),
    ...(canEditWebsite ? [['appearance','Edit Website',Globe]] : [])
  ];
  const stats = dashboard?.stats || {};
  const filteredUsers = useMemo(() => users, [users]);

  if (!checked) return <div className="cms-shell"><div className="loading-line">Checking management access…</div></div>;
  if (!user) return <div className="cms-shell"><main className="cms-main"><div className="empty-state"><h2>Sign in required</h2><p>{error || 'Please sign in to open CMS management.'}</p><Link className="button button-dark" to="/cms">Open CMS login</Link></div></main></div>;
  if (!canManage) return <div className="cms-shell"><main className="cms-main"><div className="empty-state"><h2>Access restricted</h2><p>Your account does not have permission to manage this area.</p><Link className="button button-dark" to="/cms">Back to CMS</Link></div></main></div>;

  return <div className="cms-shell">
    <header className="cms-topbar"><Link to="/cms" className="brand">ByteJournal<span className="brand-dot">.</span></Link><div className="cms-top-actions"><span className="admin-label"><ShieldCheck size={15}/> {user.role.replace('_',' ').toUpperCase()}</span><ThemeButton theme={theme} toggle={toggle}/><Link to="/cms" className="button button-outline button-small">Article desk</Link></div></header>
    <main className="cms-main">
      <div className="cms-welcome"><div><div className="section-kicker">BYTEJOURNAL CONTROL ROOM</div><h1>Workspace <em>management.</em></h1><p>Review contributors, administer accounts, invite writers and edit the main website.</p></div><Link to="/cms" className="button button-outline"><ArrowLeft size={15}/> Back to articles</Link></div>
      <nav className="management-tabs" aria-label="Management sections">{navigation.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>{setTab(id);navigate(id==='appearance'?'/cms/settings/appearance':'/cms/management',{state:{tab:id}});setMessage('');setError('')}}><Icon size={15}/>{label}</button>)}</nav>
      {message && <div className="notice notice-success"><Check size={16}/>{message}</div>}{error && <div className="notice notice-error">{error}</div>}
      {tab==='overview' && <section className="management-grid">
        <div className="cms-stats"><div><span>Articles</span><strong>{stats.total ?? '—'}</strong><small>Current article count</small></div><div><span>Published</span><strong>{stats.published ?? '—'}</strong><small>Publicly available</small></div><div><span>Drafts</span><strong>{stats.drafts ?? '—'}</strong><small>Not currently published</small></div><div><span>Awaiting review</span><strong>{stats.pending_reviews ?? '—'}</strong><small>Submitted by authors</small></div><div><span>Active authors</span><strong>{stats.authors ?? '—'}</strong><small>Enabled author accounts</small></div><div><span>Author requests</span><strong>{stats.pending_author_requests ?? '—'}</strong><small>Pending or under review</small></div></div>
        <div className="editor-panel"><div className="panel-heading"><div><span className="section-kicker">RECENT ACTIVITY</span><h2>Recently updated articles</h2></div><button className="icon-button" onClick={()=>loadAll('overview')}><RefreshCw size={15}/></button></div>{(dashboard?.recent||[]).length ? <CmsPaginatedList items={dashboard.recent} itemLabel="articles" renderItem={item=><div key={item.id}><div><strong>{item.title}</strong><span>{item.status} · {item.publication_status} · {formatDate(item.updated_at)}</span></div><CmsRowActions ariaLabel={`Actions for ${item.title}`}><Link to={`/cms/articles/${item.id}/edit`}>Open article</Link></CmsRowActions></div>}/> : <p className="muted-copy">No articles found.</p>}</div>
      </section>}
      {tab==='reviews' && <section className="editor-panel"><div className="panel-heading"><div><span className="section-kicker">EDITORIAL WORKFLOW</span><h2>Pending article reviews</h2></div><button className="button button-outline button-small" onClick={()=>loadAll('reviews')}><RefreshCw size={14}/> Refresh</button></div>
        {reviewArticles.length ? <CmsPaginatedList items={reviewArticles} itemLabel="reviews" renderItem={article=><article className="application-card" key={article.id}><div className="application-title"><div><h3>{article.title}</h3><span>{article.author} · {article.category} · {article.publication_status}</span></div><b className="application-status">{article.publication_status}</b></div><p>{article.excerpt}</p><label className="field-label">Review comment<textarea rows="2" value={reviewNotes[article.id]||''} onChange={e=>setReviewNotes(v=>({...v,[article.id]:e.target.value}))}/></label><CmsRowActions ariaLabel={`Actions for ${article.title}`}>{article.publication_status==='submitted' && <><button type="button" disabled={busy} onClick={()=>action(()=>api.reviewArticle(article.id,'approved',reviewNotes[article.id]||''),'Article approved. It can now be published.')}>Approve</button><button type="button" disabled={busy} onClick={()=>action(()=>api.reviewArticle(article.id,'revision_requested',reviewNotes[article.id]||''),'Revision requested from author.')}>Request revisions</button><button type="button" disabled={busy} onClick={()=>action(()=>api.reviewArticle(article.id,'rejected',reviewNotes[article.id]||''),'Article rejected.')}>Reject</button></>}{article.publication_status==='approved' && <button type="button" disabled={busy} onClick={()=>action(()=>api.reviewArticle(article.id,'published',reviewNotes[article.id]||''),'Article published.')}>Publish article</button>}<Link to={`/cms/articles/${article.id}/edit`}>Open editor</Link></CmsRowActions></article>}/> : <p className="muted-copy">No articles are waiting for review.</p>}
      </section>}
      {tab==='media' && <section className="editor-panel"><div className="panel-heading"><div><span className="section-kicker">UPLOADED ASSETS</span><h2>Media library</h2></div><button className="button button-outline button-small" onClick={()=>loadAll('media')}><RefreshCw size={14}/> Refresh</button></div>
        <p className="muted-copy">Images uploaded through the article editor are recorded here. To upload new media, open an article and use its image or cover upload field.</p>
        {media.length ? <CmsPaginatedList items={media} itemLabel="media items" className="media-library-grid" renderItem={asset=><article className="media-library-card" key={asset.id}><img src={api.assetUrl(asset.url)} alt="Uploaded media asset" loading="lazy"/><div><strong>{asset.url.split('/').pop()}</strong><span>{asset.mime_type} · {Math.round(asset.size_bytes/1024)} KB</span><span>{asset.uploaded_by||'Former user'} · {formatDate(asset.created_at)}</span><span>{asset.reference_count} active references</span><CmsRowActions ariaLabel={`Actions for ${asset.url.split('/').pop()}`}><button type="button" onClick={()=>navigator.clipboard?.writeText(`${window.location.origin}${asset.url}`)}><Copy size={13}/> Copy URL</button><button type="button" disabled={busy||asset.reference_count>0||!['super_admin','admin','editor'].includes(user.role)} onClick={()=>removeMedia(asset)}>Delete unused asset</button></CmsRowActions></div></article>}/> : <p className="muted-copy">No media has been uploaded yet.</p>}
      </section>}
      {tab==='categories' && canTaxonomy && <section className="editor-panel"><div className="panel-heading"><div><span className="section-kicker">ARTICLE TAXONOMY</span><h2>Categories</h2></div><button className="button button-outline button-small" onClick={()=>loadAll('categories')}><RefreshCw size={14}/> Refresh</button></div>
        <form className="management-invite-form" onSubmit={saveCategory}><label className="field-label">Category name<input value={categoryForm.name} onChange={e=>setCategoryForm(v=>({...v,name:e.target.value}))} required maxLength="100" placeholder="Web development"/></label><label className="field-label">Description<input value={categoryForm.description||''} onChange={e=>setCategoryForm(v=>({...v,description:e.target.value}))} maxLength="2000" placeholder="Optional description"/></label>{categoryForm.id&&<label className="taxonomy-active-toggle"><input type="checkbox" checked={categoryForm.is_active} onChange={e=>setCategoryForm(v=>({...v,is_active:e.target.checked}))}/> Active</label>}<button className="button button-dark" disabled={busy}>{categoryForm.id?'Save category':'Add category'}</button>{categoryForm.id&&<button type="button" className="button button-outline" onClick={()=>setCategoryForm({name:'',description:'',is_active:true})}>Cancel</button>}</form>
        {categories.length ? <CmsPaginatedList items={categories} itemLabel="categories" renderItem={item=><div className="user-row" key={item.id}><div><strong><Link className="taxonomy-name-link" to={`/categories/${item.slug}`}>{item.name}</Link></strong><span>/{item.slug} · {item.article_count} published articles · {item.is_active?'Active':'Inactive'}</span><span>{item.description||'No description'}</span></div><CmsRowActions ariaLabel={`Actions for ${item.name}`}><button type="button" onClick={()=>setCategoryForm({id:item.id,name:item.name,description:item.description||'',is_active:item.is_active})}>Edit</button><button type="button" disabled={busy||(!item.is_active&&item.article_count>0)} onClick={()=>removeCategory(item)}>{item.article_count>0?(item.is_active?'Deactivate':'In use'):'Delete'}</button></CmsRowActions></div>}/>:<p className="muted-copy">No categories yet. Add one above to make it available in article category suggestions.</p>}
      </section>}
      {tab==='tags' && canTaxonomy && <section className="editor-panel"><div className="panel-heading"><div><span className="section-kicker">ARTICLE TAXONOMY</span><h2>Tags</h2></div><button className="button button-outline button-small" onClick={()=>loadAll('tags')}><RefreshCw size={14}/> Refresh</button></div>
        <form className="management-invite-form" onSubmit={saveTag}><label className="field-label">Tag name<input value={tagForm.name} onChange={e=>setTagForm(v=>({...v,name:e.target.value}))} required maxLength="80" placeholder="PostgreSQL"/></label><label className="field-label">Description<input value={tagForm.description||''} onChange={e=>setTagForm(v=>({...v,description:e.target.value}))} maxLength="2000" placeholder="Optional description"/></label><button className="button button-dark" disabled={busy}>{tagForm.id?'Save tag':'Add tag'}</button>{tagForm.id&&<button type="button" className="button button-outline" onClick={()=>setTagForm({name:'',description:''})}>Cancel</button>}</form>
        {tags.length ? <CmsPaginatedList items={tags} itemLabel="tags" renderItem={item=><div className="user-row" key={item.id}><div><strong><Link className="taxonomy-name-link" to={`/tags/${item.slug}?tag=${encodeURIComponent(item.name)}`}>{item.name}</Link></strong><span>/{item.slug} · {item.article_count} published articles</span><span>{item.description||'No description'}</span></div><CmsRowActions ariaLabel={`Actions for ${item.name}`}><button type="button" onClick={()=>setTagForm({id:item.id,name:item.name,description:item.description||''})}>Edit</button><button type="button" disabled={busy} onClick={()=>removeTag(item)}>Delete</button></CmsRowActions></div>}/>:<p className="muted-copy">No tags yet. Add one above to make it available in article tag suggestions.</p>}
      </section>}
      {tab==='applications' && <section className="editor-panel">
        <div className="panel-heading"><div><span className="section-kicker">CONTRIBUTOR PIPELINE</span><h2>Author requests</h2></div><button className="button button-outline button-small" onClick={()=>loadAll('applications')}><RefreshCw size={14}/> Refresh</button></div>
        <div className="management-filters"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email or expertise"/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{statusList.map(item=><option key={item}>{item}</option>)}</select><button className="button button-dark button-small" onClick={()=>loadAll('applications')}>Search</button></div>
        {applications.length ? <CmsPaginatedList items={applications} itemLabel="author requests" renderItem={a=><article className="application-card" key={a.id}><div className="application-title"><div><h3>{a.full_name}</h3><span>{a.email} · {a.expertise} · {formatDate(a.created_at)}</span></div><b className={`application-status status-${a.status.toLowerCase().replaceAll(' ','-')}`}>{a.status}</b></div><p>{a.biography}</p><p><strong>Why ByteJournal:</strong> {a.motivation}</p><div className="application-links">{a.portfolio_url&&<a href={a.portfolio_url} target="_blank" rel="noreferrer">Portfolio</a>}{a.github_url&&<a href={a.github_url} target="_blank" rel="noreferrer">GitHub</a>}{a.linkedin_url&&<a href={a.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>}{a.sample_article_url&&<a href={a.sample_article_url} target="_blank" rel="noreferrer">Writing sample</a>}</div><label className="field-label">Internal review notes<textarea rows="2" value={notes[a.id] ?? a.review_notes ?? ''} onChange={e=>setNotes(v=>({...v,[a.id]:e.target.value}))}/></label>{['super_admin','admin'].includes(user.role)&&<CmsRowActions ariaLabel={`Actions for ${a.full_name}`}><button type="button" disabled={busy} onClick={()=>updateApplication(a.id,'Under Review')}>Under review</button><button type="button" disabled={busy} onClick={()=>updateApplication(a.id,'Approved')}>Approve</button><button type="button" disabled={busy} onClick={()=>updateApplication(a.id,'Rejected')}>Reject</button>{a.status==='Approved'&&<button type="button" className="button-dark" disabled={busy} onClick={()=>inviteApplicant(a)}>Invite author</button>}</CmsRowActions>}</article>}/> : <p className="muted-copy">No applications match these filters.</p>}
      </section>}
      {tab==='invitations' && <section className="editor-panel">
        <div className="panel-heading"><div><span className="section-kicker">ACCOUNT ONBOARDING</span><h2>Invitations</h2></div><div className="panel-heading-actions"><button className="button button-outline button-small" disabled={busy} onClick={sendTestEmail}><Mail size={14}/> Send test email</button><button className="button button-outline button-small" onClick={()=>loadAll('invitations')}><RefreshCw size={14}/> Refresh</button></div></div>
        {canInvite && <form className="management-invite-form" onSubmit={createInvite}><label className="field-label">Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength="254" placeholder="writer@example.com"/></label><label className="field-label">Role<select value={role} onChange={e=>setRole(e.target.value)}>{(isSuper?['author','editor','admin']:['author']).map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}</select></label><button className="button button-dark" disabled={busy}>Create invitation <UserPlus size={15}/></button></form>}
        {inviteLink && <div className="invite-link-box"><label className="field-label">One-time invitation URL<input readOnly value={inviteLink}/></label><button className="button button-outline button-small" onClick={()=>navigator.clipboard?.writeText(inviteLink)}><Copy size={14}/> Copy link</button><small>{inviteLinkNote} Send it only to the intended recipient. It expires in 72 hours.</small></div>}
        {invitations.length ? <CmsPaginatedList items={invitations} itemLabel="invitations" renderItem={inv=><div className="invitation-row" key={inv.id}><div><strong>{inv.email}</strong><span>{inv.role} · Expires {formatDate(inv.expires_at)}</span><span>{inv.accepted_at?'Accepted':inv.revoked_at?'Revoked':new Date(inv.expires_at)<new Date()?'Expired':'Pending'}</span></div>{canInvite && !inv.accepted_at && !inv.revoked_at && <CmsRowActions ariaLabel={`Actions for invitation to ${inv.email}`}><button type="button" disabled={busy} onClick={()=>refreshInvite(inv.id)}>Regenerate link</button><button type="button" disabled={busy} onClick={()=>action(()=>api.revokeInvitation(inv.id),'Invitation revoked.')}>Revoke</button></CmsRowActions>}</div>}/> : <p className="muted-copy">No invitations created yet.</p>}
      </section>}
      {tab==='users' && isSuper && <section className="editor-panel"><div className="panel-heading"><div><span className="section-kicker">ACCESS CONTROL</span><h2>User management</h2></div><button className="button button-outline button-small" onClick={()=>loadAll('users')}><RefreshCw size={14}/> Refresh</button></div>
        {filteredUsers.length ? <CmsPaginatedList items={filteredUsers} itemLabel="users" renderItem={u=><div className="user-row user-admin-row" key={u.id}><div><strong>{u.name}</strong><span>{u.email} · {u.active?'Active':'Inactive'}</span></div><select aria-label={`Role for ${u.email}`} value={u.role} onChange={e=>updateAccount(u.id,{role:e.target.value})}>{roles.map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}</select><label className="website-permission-toggle"><input type="checkbox" checked={u.role==='super_admin'||u.role==='admin'||Boolean(u.can_edit_website)} disabled={busy||u.role==='super_admin'||u.role==='admin'} onChange={e=>updateAccount(u.id,{can_edit_website:e.target.checked})}/><span>Edit Website{u.role==='super_admin'||u.role==='admin'?' (always allowed)':''}</span></label><CmsRowActions ariaLabel={`Actions for ${u.name}`}><button type="button" disabled={busy || String(u.id)===String(user.id)} onClick={()=>updateAccount(u.id,{active:!u.active})}>{u.active?'Deactivate':'Activate'}</button></CmsRowActions></div>}/> : <p className="muted-copy">No user accounts found.</p>}
      </section>}
      {tab==='appearance' && canEditWebsite && <section className="editor-panel">
        <div className="panel-heading"><div><span className="section-kicker">MAIN WEBSITE</span><h2>Edit Website</h2></div><span className={`application-status ${appearanceHasPublished?'status-approved':'status-pending'}`}>{appearanceHasPublished?'Published version active':'Draft only'}</span></div>
        <form onSubmit={saveAppearance}>
          <h3 className="appearance-subheading">Branding</h3>
          <div className="form-two-col"><label className="field-label">Website name<input value={appearance.siteName||''} onChange={e=>setAppearance(v=>({...v,siteName:e.target.value}))} required maxLength="80"/></label><label className="field-label">Tagline<input value={appearance.tagline||''} onChange={e=>setAppearance(v=>({...v,tagline:e.target.value}))} maxLength="180"/></label><label className="field-label">Browser title<input value={appearance.browserTitle||''} onChange={e=>setAppearance(v=>({...v,browserTitle:e.target.value}))} maxLength="120"/></label><label className="field-label">Default social image URL<input value={appearance.defaultSocialImage||''} onChange={e=>setAppearance(v=>({...v,defaultSocialImage:e.target.value}))} placeholder="/uploads/image.png or https://…"/></label></div>
          <div className="appearance-asset-grid">{[['logoUrl','Website logo'],['faviconUrl','Favicon'],['defaultSocialImage','Default social image']].map(([key,label])=><label className="field-label" key={key}>{label}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{uploadBrandAsset(key,e.target.files?.[0]);e.target.value='';}}/>{appearance[key]&&<span className="appearance-asset-preview"><img src={api.assetUrl(appearance[key])} alt={`${label} preview`}/><button type="button" className="button button-outline button-small" onClick={()=>setAppearance(v=>({...v,[key]:''}))}>Remove</button></span>}<small>Upload a JPG, PNG, WEBP or GIF up to 5 MB.</small></label>)}</div>

          <h3 className="appearance-subheading">Colors</h3>
          <p className="muted-copy">Choose colors independently for light and dark website themes.</p>
          <div className="appearance-theme-palettes">{[['lightPalette','Light mode',defaultLightPalette],['darkPalette','Dark mode',defaultDarkPalette]].map(([mode,label,defaults])=><section className="appearance-theme-palette" key={mode}>
            <div className="appearance-theme-palette-heading"><h4>{label}</h4><button type="button" className="button button-outline button-small" onClick={()=>setAppearance(current=>({...current,[mode]:{...defaults}}))}>Reset {label.toLowerCase()} palette</button></div>
            <div className="management-color-grid">{paletteFields.map(([key,name])=><label className="field-label" key={key}>{name}<span className="color-picker"><input type="color" value={appearance[mode]?.[key]||defaults[key]} onChange={event=>updatePalette(mode,key,event.target.value)}/><input value={appearance[mode]?.[key]||defaults[key]} onChange={event=>updatePalette(mode,key,event.target.value)} pattern="^#[0-9a-fA-F]{6}$"/></span></label>)}</div>
            <div className="appearance-preview" style={{background:appearance[mode]?.background||defaults.background,color:appearance[mode]?.primaryText||defaults.primaryText,borderColor:appearance[mode]?.borders||defaults.borders}}><span>{appearance.siteName||'ByteJournal'}</span><strong>{label} color preview</strong><button type="button" style={{background:appearance[mode]?.primaryAccent||defaults.primaryAccent,color:appearance[mode]?.accentText||defaults.accentText}}>Primary action</button></div>
          </section>)}</div>

          <h3 className="appearance-subheading">Typography and layout</h3>
          <div className="form-two-col">
            <label className="field-label">Heading font<select value={appearance.headingFont} onChange={e=>setAppearance(v=>({...v,headingFont:e.target.value}))}><option value="manrope">Manrope</option><option value="system">System sans serif</option><option value="inter">Inter</option><option value="serif">Georgia</option></select></label>
            <label className="field-label">Body font<select value={appearance.bodyFont} onChange={e=>setAppearance(v=>({...v,bodyFont:e.target.value}))}><option value="system">System sans serif</option><option value="manrope">Manrope</option><option value="inter">Inter</option><option value="serif">Georgia</option></select></label>
            <label className="field-label">Code font<select value={appearance.codeFont} onChange={e=>setAppearance(v=>({...v,codeFont:e.target.value}))}><option value="mono">Monospace</option><option value="system">System sans serif</option><option value="serif">Georgia</option></select></label>
            <label className="field-label">Font size<select value={appearance.fontSize} onChange={e=>setAppearance(v=>({...v,fontSize:e.target.value}))}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>
            <label className="field-label">Header layout<select value={appearance.headerLayout} onChange={e=>setAppearance(v=>({...v,headerLayout:e.target.value}))}><option value="split">Split</option><option value="centered">Centered brand</option><option value="compact">Compact</option></select></label>
            <label className="field-label">Navigation layout<select value={appearance.navigationLayout} onChange={e=>setAppearance(v=>({...v,navigationLayout:e.target.value}))}><option value="links">Text links</option><option value="pills">Pills</option></select></label>
            <label className="field-label">Footer layout<select value={appearance.footerLayout} onChange={e=>setAppearance(v=>({...v,footerLayout:e.target.value}))}><option value="columns">Columns</option><option value="compact">Compact</option></select></label>
            <label className="field-label">Article cards<select value={appearance.articleCardStyle} onChange={e=>setAppearance(v=>({...v,articleCardStyle:e.target.value}))}><option value="bordered">Bordered</option><option value="minimal">Minimal</option><option value="filled">Filled</option></select></label>
            <label className="field-label">Homepage layout<select value={appearance.homepageLayout} onChange={e=>setAppearance(v=>({...v,homepageLayout:e.target.value}))}><option value="editorial">Editorial</option><option value="grid">Grid</option><option value="list">List</option></select></label>
            <label className="field-label">Border radius (px)<input type="number" min="0" max="24" value={appearance.borderRadius} onChange={e=>setAppearance(v=>({...v,borderRadius:Number(e.target.value)}))}/></label>
            <label className="field-label">Content width (px)<input type="number" min="900" max="1600" value={appearance.contentWidth} onChange={e=>setAppearance(v=>({...v,contentWidth:Number(e.target.value)}))}/></label>
          </div>

          <h3 className="appearance-subheading">Homepage</h3>
          <label className="field-label">Introduction<textarea rows="3" maxLength="500" value={appearance.homepageIntro} onChange={e=>setAppearance(v=>({...v,homepageIntro:e.target.value}))}/></label>
          <div className="appearance-section-toggles"><label><input type="checkbox" checked={appearance.showFeatured} onChange={e=>setAppearance(v=>({...v,showFeatured:e.target.checked}))}/> Featured articles</label><label><input type="checkbox" checked={appearance.showLatest} onChange={e=>setAppearance(v=>({...v,showLatest:e.target.checked}))}/> Latest articles</label><label><input type="checkbox" checked={appearance.showPopular} onChange={e=>setAppearance(v=>({...v,showPopular:e.target.checked}))}/> Popular articles</label></div>
          <div className="form-two-col"><label className="field-label">Featured articles to show<input type="number" min="1" max="8" value={appearance.featuredCount} onChange={e=>setAppearance(v=>({...v,featuredCount:Number(e.target.value)}))}/></label><label className="field-label">Latest articles to load<input type="number" min="1" max="12" value={appearance.latestCount} onChange={e=>setAppearance(v=>({...v,latestCount:Number(e.target.value)}))}/></label><label className="field-label">Popular articles to show<input type="number" min="1" max="12" value={appearance.popularCount} onChange={e=>setAppearance(v=>({...v,popularCount:Number(e.target.value)}))}/></label><label className="field-label">Homepage categories<input value={(appearance.homepageCategories||[]).join(', ')} onChange={e=>setAppearance(v=>({...v,homepageCategories:e.target.value.split(',').map(value=>value.trim()).filter(Boolean).slice(0,12)}))} placeholder="Web development, System design"/><small>Separate category names with commas.</small></label></div>
          <div className="appearance-order"><strong>Homepage section order</strong>{appearance.homepageOrder.map((section,index)=><div key={section}><span>{index+1}. {section[0].toUpperCase()+section.slice(1)}</span><button type="button" disabled={index===0} onClick={()=>moveHomepageSection(index,-1)} aria-label={`Move ${section} up`}>↑</button><button type="button" disabled={index===appearance.homepageOrder.length-1} onClick={()=>moveHomepageSection(index,1)} aria-label={`Move ${section} down`}>↓</button></div>)}</div>
          <label className="field-label">Theme preference<select value={appearance.themePreference} onChange={e=>setAppearance(v=>({...v,themePreference:e.target.value}))}><option value="system">Follow reader's system preference</option><option value="light">Light mode</option><option value="dark">Dark mode</option></select></label>

          <div className="appearance-actions"><button className="button button-dark" disabled={busy}>Save changes</button><button type="button" className="button button-outline" disabled={busy} onClick={publishAppearance}>Publish appearance</button><button type="button" className="button button-outline" onClick={()=>setAppearance(defaultAppearance)}>Reset to defaults</button></div>
          <p className="muted-copy">Edits save as a draft. Publishing makes them active for public visitors; the current published version stays live until then.</p>
        </form>
      </section>}
      {tab==='appearance' && !canEditWebsite && <section className="editor-panel"><div className="empty-state"><h2>Access restricted</h2><p>You do not have permission to edit the main website.</p></div></section>}
      <div className="cms-footer-note"><ShieldCheck size={15}/> Signed in as <strong>{user.email}</strong>. <button className="text-link" onClick={()=>api.logout().then(()=>window.location.assign('/cms'))}>Sign out</button></div>
    </main>
  </div>;
}
