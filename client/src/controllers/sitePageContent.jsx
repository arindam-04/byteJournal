import { createContext, useContext } from 'react';
import DOMPurify from 'dompurify';

const SitePagesContext = createContext({});

export function SitePagesProvider({ pages, children }) {
  return <SitePagesContext.Provider value={pages || {}}>{children}</SitePagesContext.Provider>;
}

export function useSitePageContent(key) {
  const pages = useContext(SitePagesContext);
  return pages[key] || { title: '', intro: '', body: '' };
}

export function SitePageBody({ page, className = 'site-page-custom-content' }) {
  if (!page?.body?.trim()) return null;
  return <section className={className} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.body) }} />;
}
