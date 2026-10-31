import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MailCheck, ArrowRight } from 'lucide-react';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';
import './PublicPages.css';
export default function RegisterView(){
  const page=useSitePageContent('register');
  useEffect(()=>{document.title=`${page.title||'Register'} | ByteJournal`},[page.title]);
  const [token,setToken]=useState('');const navigate=useNavigate();
  function submit(e){e.preventDefault();if(token.trim())navigate(`/accept-invitation?token=${encodeURIComponent(token.trim())}`)}
  return <main className="public-page bj-auth-page"><section className="bj-auth-card"><span className="bj-auth-icon"><MailCheck size={22}/></span><span className="section-kicker">JOIN THE PUBLICATION</span><h1>{page.title||<>Create your <em>account.</em></>}</h1><p>{page.intro||'ByteJournal publishing accounts are invitation-only. Enter the invitation token from your email to activate your account.'}</p><SitePageBody page={page} className="auth-page-custom-content"/><form onSubmit={submit}><label>Invitation token<input value={token} onChange={e=>setToken(e.target.value)} required autoComplete="one-time-code" placeholder="Paste your invitation token"/></label><button className="button button-dark full-button">Continue to registration <ArrowRight size={16}/></button></form><div className="bj-auth-links"><span>Already have an account? <Link to="/login">Sign in</Link></span><Link to="/become-author">Apply to become an author</Link></div><p className="bj-auth-note">There is no public self-service account creation endpoint in the current backend. If you want to contribute, submit an author application first.</p></section></main>;
}
