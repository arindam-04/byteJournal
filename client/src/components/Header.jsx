import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown, Search, X, Menu, Sun, Moon, UserRound, LogOut,
  LayoutDashboard, PenLine, Code2, ArrowUpRight
} from 'lucide-react';
import { api } from '../api';
import './Header.css';

export const headerCategories = [
  ['Web Development', 'web-development'],
  ['Programming Languages', 'programming-languages'],
  ['Artificial Intelligence & Machine Learning', 'artificial-intelligence'],
  ['Data Structures & Algorithms', 'data-structures-algorithms'],
  ['System Design', 'system-design'],
  ['Cloud Computing & DevOps', 'cloud-computing-devops'],
  ['Cybersecurity', 'cybersecurity'],
  ['Database Management', 'database-management'],
  ['Computer Networks', 'computer-networks'],
  ['Open Source', 'open-source']
];

export default function Header({ theme = 'light', toggle = () => {}, siteName = 'ByteJournal', logoUrl = '' }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [websiteEditMode,setWebsiteEditMode] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);

  useEffect(() => {
    let active = true;
    api.me().then(({ user: current }) => { if (active) setUser(current || null); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, [location.pathname]);

  useEffect(() => {
    setMobileOpen(false);
    setCategoriesOpen(false);
    setProfileOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const updateEditMode=event=>setWebsiteEditMode(Boolean(event.detail?.active));
    window.addEventListener('bj-website-inline-edit-state',updateEditMode);
    return ()=>window.removeEventListener('bj-website-inline-edit-state',updateEditMode);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!mobileOpen && !categoriesOpen && !profileOpen && !searchOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false); setCategoriesOpen(false); setProfileOpen(false); setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, categoriesOpen, profileOpen, searchOpen]);

  function handleMenuKeyDown(event) {
    const items = [...event.currentTarget.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')];
    if (!items.length) return;
    const current = items.indexOf(document.activeElement);
    let next = null;
    if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length;
    else if (event.key === 'ArrowUp') next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    if (next !== null) { event.preventDefault(); items[next].focus(); }
  }

  function submitSearch(event) {
    event.preventDefault();
    const term = query.trim();
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : '/search');
    setSearchOpen(false);
    setMobileOpen(false);
  }

  async function logout() {
    await api.logout().catch(() => {});
    setUser(null);
    setProfileOpen(false);
    navigate('/');
  }

  const activeCategory = location.pathname.startsWith('/categories');
  const canEditWebsite = Boolean(user && (user.role === 'super_admin' || user.role === 'admin' || user.can_edit_website));
  const linkClass = ({ isActive }) => `bj-nav-link${isActive ? ' is-active' : ''}`;

  return (
    <header className="bj-header">
      <div className="bj-header-inner">
        <Link to="/" className="bj-brand" aria-label={`${siteName} home`}>
          <span className="bj-brand-mark">{logoUrl ? <img src={api.assetUrl(logoUrl)} alt="" /> : <Code2 size={19} aria-hidden="true" />}</span>
          <span>{siteName}<i>.</i></span>
        </Link>

        <nav id="bj-mobile-navigation" className={`bj-primary-nav${mobileOpen ? ' bj-nav-open' : ''}`} aria-label="Main navigation">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/articles" className={linkClass}>Articles</NavLink>
          <div className={`bj-nav-dropdown${activeCategory ? ' is-active' : ''}`} onPointerEnter={event => { if (event.pointerType === 'mouse') setCategoriesOpen(true); }} onPointerLeave={event => { if (event.pointerType === 'mouse' && !event.currentTarget.contains(document.activeElement)) setCategoriesOpen(false); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setCategoriesOpen(false); }}>
            <button type="button" className={`bj-nav-link bj-dropdown-trigger${categoriesOpen ? ' is-expanded' : ''}`} aria-haspopup="true" aria-expanded={categoriesOpen} aria-controls="bj-category-menu" onClick={() => { setCategoriesOpen(value => !value); setProfileOpen(false); }}>
              Categories <ChevronDown size={14} aria-hidden="true" />
            </button>
            <div id="bj-category-menu" className={`bj-dropdown-panel bj-category-panel${categoriesOpen ? ' is-open' : ''}`} role="menu" aria-label="Technology categories" onKeyDown={handleMenuKeyDown}>
              <div className="bj-dropdown-heading"><span>EXPLORE THE STACK</span><Link role="menuitem" to="/categories" onClick={() => setCategoriesOpen(false)}>All categories <ArrowUpRight size={13}/></Link></div>
              <div className="bj-category-menu-grid">
                {headerCategories.map(([label, slug]) => <Link role="menuitem" key={slug} to={`/categories/${slug}`} onClick={() => setCategoriesOpen(false)}>{label}<ArrowUpRight size={12} aria-hidden="true"/></Link>)}
              </div>
            </div>
          </div>
          <NavLink to="/tutorials" className={linkClass}>Tutorials</NavLink>
          <NavLink to="/tech-news" className={linkClass}>Tech News</NavLink>
          <NavLink to="/about" className={linkClass}>About Us</NavLink>
          <div className="bj-mobile-extra">
            <Link to="/contact">Contact</Link>
            <Link to="/become-author">Write for Us</Link>
          </div>
        </nav>

        <div className="bj-header-actions">
          <div className="bj-search-wrap">
            {searchOpen && <form className="bj-search-form" role="search" onSubmit={submitSearch}>
              <label className="sr-only" htmlFor="bj-header-search">Search articles</label>
              <input ref={searchRef} id="bj-header-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search articles…" maxLength={100}/>
              <button type="submit" aria-label="Submit search"><Search size={16}/></button>
            </form>}
            <button className="bj-action-button" type="button" aria-label={searchOpen ? 'Close search' : 'Open search'} aria-expanded={searchOpen} onClick={() => setSearchOpen(value => !value)}>{searchOpen ? <X size={18}/> : <Search size={18}/>}</button>
          </div>

          <Link to="/become-author" className="bj-write-button" aria-label="Write for Us or become an author">Write for Us <PenLine size={15} aria-hidden="true"/></Link>

          <button className="bj-action-button bj-theme-button" type="button" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-pressed={theme === 'dark'} title="Toggle color theme">
            {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}
          </button>

          <div className="bj-profile-wrap" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setProfileOpen(false); }}>
            <button className={`bj-action-button bj-profile-button${profileOpen ? ' is-expanded' : ''}`} type="button" aria-label="User account menu" aria-haspopup="true" aria-expanded={profileOpen} aria-controls="bj-profile-menu" onClick={() => { setProfileOpen(value => !value); setCategoriesOpen(false); }}>
              <UserRound size={18}/>
            </button>
            <div id="bj-profile-menu" className={`bj-dropdown-panel bj-profile-panel${profileOpen ? ' is-open' : ''}`} role="menu" aria-label="Account menu" onKeyDown={handleMenuKeyDown}>
              {user ? <>
                <div className="bj-profile-summary"><strong>{user.name || 'ByteJournal member'}</strong><span>{user.email}</span></div>
                {canEditWebsite&&<button role="menuitem" type="button" className={`bj-profile-edit-website${websiteEditMode?' is-active':''}`} data-bj-inline-ui="true" aria-pressed={websiteEditMode} onClick={() => window.dispatchEvent(new Event('bj-toggle-website-inline-edit'))}><PenLine size={15} aria-hidden="true"/> {websiteEditMode?'Done editing':'Edit Website'}</button>}
                <Link role="menuitem" to="/dashboard" onClick={() => setProfileOpen(false)}><LayoutDashboard size={15}/> Dashboard</Link>
                <Link role="menuitem" to="/cms" onClick={() => setProfileOpen(false)}><PenLine size={15}/> Publishing workspace</Link>
                <button role="menuitem" type="button" onClick={logout}><LogOut size={15}/> Sign out</button>
              </> : <>
                <div className="bj-profile-summary"><strong>Welcome to {siteName}</strong><span>{authChecked ? 'Sign in to your publishing account' : 'Checking account…'}</span></div>
                <Link role="menuitem" to="/login" onClick={() => setProfileOpen(false)}>Login</Link>
                <Link role="menuitem" to="/register" onClick={() => setProfileOpen(false)}>Register</Link>
                <Link role="menuitem" to="/dashboard" onClick={() => setProfileOpen(false)}>Dashboard</Link>
              </>}
            </div>
          </div>

          <button className="bj-mobile-toggle" type="button" aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileOpen} aria-controls="bj-mobile-navigation" onClick={() => setMobileOpen(value => !value)}>
            {mobileOpen ? <X size={21}/> : <Menu size={21}/>}
          </button>
        </div>
      </div>
      {mobileOpen && <button type="button" className="bj-mobile-backdrop" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} />}
    </header>
  );
}
