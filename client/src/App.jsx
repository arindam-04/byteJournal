import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import useTheme from './controllers/useTheme';
import PublicLayout from './layouts/PublicLayout';
import HomeView from './views/HomeView';
import ArticleView from './views/ArticleView';
import CMSView from './views/CMSView';
import NotFoundView from './views/NotFoundView';
import BecomeAuthorView from './views/BecomeAuthorView';
import CMSManagementView from './views/CMSManagementView';
import AcceptInvitationView from './views/AcceptInvitationView';
import AuthorProfileView from './views/AuthorProfileView';
import ContactView from './views/ContactView';
import LegalView from './views/LegalView';
import ArticlesView from './views/ArticlesView';
import CategoriesView from './views/CategoriesView';
import CategoryDetailView from './views/CategoryDetailView';
import TagDetailView from './views/TagDetailView';
import { TutorialsView, TechNewsView } from './views/TopicCollectionView';
import AboutView from './views/AboutView';
import SearchView from './views/SearchView';
import LoginView from './views/LoginView';
import RegisterView from './views/RegisterView';
import DashboardView from './views/DashboardView';
import FaqsView from './views/FaqsView';
import { api } from './api';
import { SitePagesProvider } from './controllers/sitePageContent';

export default function App() {
  const [theme, toggle, setTheme] = useTheme();
  const [siteSettings,setSiteSettings] = useState({siteName:'ByteJournal', tagline:'A journal for curious builders.'});
  useEffect(() => {
    let active = true;
    const refreshSiteSettings=()=>api.settings().then(({settings={},pages={}}) => { if (active) setSiteSettings({...settings,pages}); }).catch(() => {});
    refreshSiteSettings();
    const refresh=()=>refreshSiteSettings();
    window.addEventListener('siteSettingsUpdated',refresh);
    return () => { active = false; window.removeEventListener('siteSettingsUpdated',refresh); };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    const safeSet = (value,variable) => /^#[0-9a-fA-F]{6}$/.test(value || '')
      ? root.style.setProperty(variable,value) : root.style.removeProperty(variable);
    const palette=theme==='light'?siteSettings.lightPalette:siteSettings.darkPalette;
    const paletteVariables={background:'--bg',surface:'--surface',elevatedSurface:'--soft',primaryText:'--text',secondaryText:'--secondary-text',mutedText:'--muted',primaryAccent:'--primary-color',accentHover:'--accent-hover',accentText:'--accent-text',links:'--link-color',borders:'--line',inputs:'--input-bg'};
    Object.entries(paletteVariables).forEach(([key,variable])=>safeSet(palette?.[key],variable));
    safeSet(palette?.primaryAccent,'--accent');
    safeSet(palette?.accentText,'--secondary-color');
    const fontMap = {system:'system-ui, sans-serif',manrope:'Manrope, sans-serif',serif:'Georgia, serif',inter:'Inter, sans-serif',mono:'DM Mono, monospace'};
    root.style.setProperty('--font-heading',fontMap[siteSettings.headingFont]||fontMap.manrope);
    root.style.setProperty('--font-body',fontMap[siteSettings.bodyFont]||fontMap.system);
    root.style.setProperty('--font-code',fontMap[siteSettings.codeFont]||fontMap.mono);
    root.style.setProperty('--site-radius',`${Math.min(24,Math.max(0,Number(siteSettings.borderRadius??8)))}px`);
    root.dataset.headerLayout = siteSettings.headerLayout || 'split';
    root.dataset.navigationLayout = siteSettings.navigationLayout || 'links';
    root.dataset.footerLayout = siteSettings.footerLayout || 'columns';
    root.dataset.articleCardStyle = siteSettings.articleCardStyle || 'bordered';
    root.dataset.homepageLayout = siteSettings.homepageLayout || 'editorial';
    root.dataset.fontSize = siteSettings.fontSize || 'medium';
    if (siteSettings.contentWidth && Number.isFinite(Number(siteSettings.contentWidth))) root.style.setProperty('--content-width',`${Math.min(1600,Math.max(900,Number(siteSettings.contentWidth)))}px`);
    else root.style.removeProperty('--content-width');
    if (window.location.pathname === '/') document.title = siteSettings.pages?.home?.title?.trim()
      ? `${siteSettings.pages.home.title.trim()} | ${siteSettings.siteName || 'ByteJournal'}`
      : siteSettings.browserTitle || document.title;
    let icon=document.querySelector('link[rel="icon"]');
    if (siteSettings.faviconUrl) { if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.appendChild(icon);} icon.href=api.assetUrl(siteSettings.faviconUrl); }
    else if(icon) icon.removeAttribute('href');
    if (siteSettings.defaultSocialImage) { let social=document.querySelector('meta[property="og:image"]'); if(!social){social=document.createElement('meta');social.setAttribute('property','og:image');document.head.appendChild(social);} social.content=api.assetUrl(siteSettings.defaultSocialImage); }
  }, [theme,siteSettings]);
  useEffect(() => { if (siteSettings.themePreference === 'light' || siteSettings.themePreference === 'dark') setTheme(siteSettings.themePreference); }, [siteSettings.themePreference,setTheme]);

  const publicLayout = <SitePagesProvider pages={siteSettings.pages}><PublicLayout theme={theme} toggle={toggle} siteName={siteSettings.siteName || 'ByteJournal'} tagline={siteSettings.tagline || ''} settings={siteSettings}/></SitePagesProvider>;
  return (
    <Routes>
      <Route element={publicLayout}>
        <Route index element={<HomeView siteName={siteSettings.siteName || 'ByteJournal'} tagline={siteSettings.tagline || ''} settings={siteSettings}/>} />
        <Route path="/articles" element={<ArticlesView/>}/>
        <Route path="/articles/:slug" element={<ArticleView siteName={siteSettings.siteName||'ByteJournal'} browserTitle={siteSettings.browserTitle||'ByteJournal — Technical Journal'} defaultSocialImage={siteSettings.defaultSocialImage||''}/>}/>
        <Route path="/article/:slug" element={<ArticleView siteName={siteSettings.siteName||'ByteJournal'} browserTitle={siteSettings.browserTitle||'ByteJournal — Technical Journal'} defaultSocialImage={siteSettings.defaultSocialImage||''}/>}/>
        <Route path="/categories" element={<CategoriesView/>}/>
        <Route path="/categories/:categorySlug" element={<CategoryDetailView/>}/>
        <Route path="/tags/:tagSlug" element={<TagDetailView/>}/>
        <Route path="/tutorials" element={<TutorialsView/>}/>
        <Route path="/faqs" element={<FaqsView/>}/>
        <Route path="/tech-news" element={<TechNewsView/>}/>
        <Route path="/about" element={<AboutView/>}/>
        <Route path="/become-author" element={<BecomeAuthorView/>}/>
        <Route path="/become-an-author" element={<BecomeAuthorView/>}/>
        <Route path="/authors/:id" element={<AuthorProfileView/>}/>
        <Route path="/search" element={<SearchView/>}/>
        <Route path="/login" element={<LoginView/>}/>
        <Route path="/register" element={<RegisterView/>}/>
        <Route path="/dashboard" element={<DashboardView/>}/>
        <Route path="/contact" element={<ContactView/>}/>
        <Route path="/privacy-policy" element={<LegalView slugOverride="privacy-policy" siteName={siteSettings.siteName || 'ByteJournal'}/>} />
        <Route path="/terms" element={<LegalView slugOverride="terms" siteName={siteSettings.siteName || 'ByteJournal'}/>} />
        <Route path="/cookie-policy" element={<LegalView slugOverride="cookies" siteName={siteSettings.siteName || 'ByteJournal'}/>} />
        <Route path="/disclaimer" element={<LegalView slugOverride="disclaimer" siteName={siteSettings.siteName || 'ByteJournal'}/>} />
        <Route path="/legal/:slug" element={<LegalView siteName={siteSettings.siteName || 'ByteJournal'}/>} />
        <Route path="/accept-invitation" element={<AcceptInvitationView/>}/>
        <Route path="*" element={<NotFoundView/>}/>
      </Route>
      <Route path="/cms" element={<CMSView/>}/>
      <Route path="/cms/reset-password" element={<CMSView/>}/>
      <Route path="/cms/articles" element={<CMSView/>}/>
      <Route path="/cms/profile" element={<CMSView/>}/>
      <Route path="/cms/articles/new" element={<CMSView/>}/>
      <Route path="/cms/articles/:id/edit" element={<CMSView/>}/>
      <Route path="/cms/management" element={<CMSManagementView/>}/>
      <Route path="/cms/settings/appearance" element={<CMSManagementView/>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  );
}
