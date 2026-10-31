import { Link } from 'react-router-dom';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';

export default function NotFoundView() { const page=useSitePageContent('notFound');return <main className="empty-state not-found"><h1>{page.title||'404'}</h1>{page.body?.trim()?<SitePageBody page={page}/>:<h2>Nothing here but whitespace.</h2>}{page.intro&&<p>{page.intro}</p>}<Link to="/" className="button button-dark">Return home</Link></main>; }
