import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import InlineWebsiteEditor from '../components/InlineWebsiteEditor';
import { api } from '../api';

const pageDescriptions = [
  [/^\/$/, 'Technology, programming, software development, AI, and engineering ideas for curious builders.'],
  [/^\/articles$/, 'Browse practical engineering articles, software explainers, and technical field notes.'],
  [/^\/categories$/, 'Explore ByteJournal technology categories, from web development and programming to security and cloud.'],
  [/^\/categories\//, 'Browse published articles and technical resources in this ByteJournal topic.'],
  [/^\/tags\//, 'Browse published ByteJournal articles grouped by tag.'],
  [/^\/tutorials$/, 'Learn software development through practical tutorials, developer guides, and code examples.'],
  [/^\/tech-news$/, 'Read recent technology updates and engineering developments from ByteJournal contributors.'],
  [/^\/about$/, 'Learn about ByteJournal’s mission, editorial values, and approach to technical publishing.'],
  [/^\/become-author$/, 'Share your technical knowledge with ByteJournal. Review contributor information and apply to write.'],
  [/^\/search$/, 'Search ByteJournal articles by topic, technology, author, or keyword.'],
  [/^\/login$/, 'Sign in to your ByteJournal publishing account.'],
  [/^\/register$/, 'Activate your ByteJournal contributor account using an invitation token.'],
  [/^\/dashboard$/, 'Manage your ByteJournal account, saved articles, and publishing activity.'],
  [/^\/contact$/, 'Contact the ByteJournal team with questions, feedback, or editorial enquiries.'],
  [/^\/privacy-policy$/, 'Read the ByteJournal privacy policy and information about submitted data.'],
  [/^\/terms$/, 'Read the terms and conditions for using ByteJournal.'],
  [/^\/cookie-policy$/, 'Learn how ByteJournal uses essential cookies and browser storage.'],
  [/^\/disclaimer$/, 'Read the ByteJournal educational content and technical information disclaimer.'],
  [/^\/faqs$/, 'Find answers about reading ByteJournal, contributing articles, and using the website.']
];

export default function PublicLayout({ theme, toggle, siteName, tagline, settings = {} }) {
  const location = useLocation();
  const pageKey = location.pathname === '/' ? 'home'
    : location.pathname === '/articles' ? 'articles'
    : location.pathname.startsWith('/articles/') || location.pathname.startsWith('/article/') ? 'articleDetail'
    : location.pathname === '/categories' ? 'categories'
    : location.pathname.startsWith('/categories/') ? 'categoryDetail'
    : location.pathname.startsWith('/tags/') ? 'tagDetail'
    : location.pathname === '/tutorials' ? 'tutorials'
    : location.pathname === '/tech-news' ? 'techNews'
    : location.pathname === '/about' ? 'about'
    : ['/become-author','/become-an-author'].includes(location.pathname) ? 'becomeAuthor'
    : location.pathname === '/search' ? 'search'
    : location.pathname === '/faqs' ? 'faqs'
    : location.pathname === '/contact' ? 'contact'
    : location.pathname === '/login' ? 'login'
    : location.pathname === '/register' ? 'register'
    : location.pathname === '/accept-invitation' ? 'acceptInvitation'
    : location.pathname.startsWith('/authors/') ? 'authorProfile'
    : location.pathname === '/dashboard' ? 'dashboard'
    : location.pathname === '/privacy-policy' ? 'privacyPolicy'
    : location.pathname === '/terms' ? 'terms'
    : location.pathname === '/cookie-policy' ? 'cookiePolicy'
    : location.pathname === '/disclaimer' ? 'disclaimer'
    : location.pathname.startsWith('/legal/') ? ({'privacy-policy':'privacyPolicy',terms:'terms','cookie-policy':'cookiePolicy',disclaimer:'disclaimer'}[location.pathname.split('/').pop()]||'disclaimer')
    : 'notFound';
  const routeScope=['articleDetail','categoryDetail','authorProfile','notFound'].includes(pageKey)?location.pathname:pageKey;
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [location.pathname]);
  useEffect(() => {
    // ArticleView owns its richer SEO metadata. All other public routes update
    // the shared description so metadata from the previously viewed article
    // cannot leak onto a different page during client-side navigation.
    if (location.pathname.startsWith('/articles/') || location.pathname.startsWith('/article/')) return;
    const description = settings.pages?.[pageKey]?.intro || pageDescriptions.find(([pattern]) => pattern.test(location.pathname))?.[1]
      || `${siteName || 'ByteJournal'} — technology, programming, software development, and innovation.`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
    meta.content = description;
    const customTitle=settings.pages?.[pageKey]?.title?.trim();
    if(customTitle) document.title=`${customTitle} | ${siteName||'ByteJournal'}`;
    else if (settings.browserTitle) document.title = settings.browserTitle;
    const setMeta=(selector,attribute,name,value)=>{let element=document.querySelector(selector);if(value){if(!element){element=document.createElement('meta');element.setAttribute(attribute,name);document.head.appendChild(element);}element.content=value;}else if(element)element.remove();};
    setMeta('meta[property="og:image"]','property','og:image',settings.defaultSocialImage?api.assetUrl(settings.defaultSocialImage):'');
    setMeta('meta[name="twitter:image"]','name','twitter:image',settings.defaultSocialImage?api.assetUrl(settings.defaultSocialImage):'');
  }, [location.pathname, location.search, siteName, settings.browserTitle, settings.pages, pageKey]);
  return <>
    <Header theme={theme} toggle={toggle} siteName={siteName} logoUrl={settings.logoUrl}/>
    <Outlet/>
    <InlineWebsiteEditor pageKey={pageKey} routePath={routeScope} publishedPages={settings.pages||{}}/>
    <Footer siteName={siteName} tagline={tagline} logoUrl={settings.logoUrl}/>
  </>;
}
