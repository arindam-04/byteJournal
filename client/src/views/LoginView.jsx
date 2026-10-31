import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { api } from '../api';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';
import './PublicPages.css';
export default function LoginView(){
  const page=useSitePageContent('login');
  useEffect(()=>{document.title=`${page.title||'Login'} | ByteJournal`},[page.title]);
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const navigate=useNavigate();const [params]=useSearchParams();
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{await api.login(email.trim(),password);const next=params.get('next');navigate(next&&next.startsWith('/')&&!next.startsWith('//')?next:'/dashboard',{replace:true})}catch(err){setError(err.message||'Sign in failed.')}finally{setBusy(false)}}
  return <main className="public-page bj-auth-page"><section className="bj-auth-card"><span className="bj-auth-icon"><LockKeyhole size={22}/></span><span className="section-kicker">MEMBER ACCESS</span><h1>{page.title||<>Welcome <em>back.</em></>}</h1><p>{page.intro||'Sign in to your ByteJournal publishing account.'}</p><SitePageBody page={page} className="auth-page-custom-content"/><form onSubmit={submit}><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>{error&&<div className="bj-form-alert" role="alert">{error}</div>}<button className="button button-dark full-button" disabled={busy}>{busy?'Signing in…':'Sign in'} <ArrowRight size={16}/></button></form><div className="bj-auth-links"><Link to="/cms/reset-password">Forgot password?</Link><span>Invited to contribute? <Link to="/register">Activate account</Link></span></div><p className="bj-auth-note">ByteJournal accounts are currently created by invitation. This sign-in uses the existing secure publishing authentication.</p></section></main>;
}
