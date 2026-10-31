import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';
export default function AcceptInvitationView(){
  const page=useSitePageContent('acceptInvitation');
  useEffect(()=>{document.title=`${page.title||'Accept invitation'} | ByteJournal`},[page.title]);
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [name,setName] = useState('');
  const [password,setPassword] = useState('');
  const [confirm,setConfirm] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [done,setDone] = useState(false);
  async function submit(e){e.preventDefault();setError('');if(password!==confirm){setError('Passwords do not match.');return;}setBusy(true);try{await api.acceptInvitation(token,name,password);setDone(true);}catch(err){setError(err.message||'Could not accept this invitation.');}finally{setBusy(false);}}
  return <main className="article-page invitation-page"><Link to="/" className="back-link">← Back to ByteJournal</Link><div className="article-detail-header"><span className="category-label">SECURE ACCOUNT ACTIVATION</span><h1>{page.title||'Accept your invitation'}</h1><p className="article-deck">{page.intro||'Create your ByteJournal account using the invitation link supplied by an administrator.'}</p></div><SitePageBody page={page} className="invitation-page-custom-content"/>
    {done ? <div className="empty-state"><h2>Account created</h2><p>Your account is ready. You can now sign in to the CMS.</p><Link to="/cms" className="button button-dark">Go to CMS login</Link></div> : !token ? <div className="notice notice-error">This invitation URL does not contain a token.</div> : <form className="login-card invitation-card" onSubmit={submit}><label className="field-label">Full name<input value={name} onChange={e=>setName(e.target.value)} required minLength="2" maxLength="120" autoComplete="name"/></label><label className="field-label">Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength="12" maxLength="200" autoComplete="new-password"/><small>Use at least 12 characters.</small></label><label className="field-label">Confirm password<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required autoComplete="new-password"/></label>{error&&<div className="notice notice-error" role="alert">{error}</div>}<button className="button button-dark" disabled={busy}>{busy?'Creating account…':'Activate account'}</button></form>}
  </main>;
}
