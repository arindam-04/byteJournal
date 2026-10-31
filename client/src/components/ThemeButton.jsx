import { Moon, Sun } from 'lucide-react';

export default function ThemeButton({ theme, toggle }) {
  return <button className="icon-button" onClick={toggle} aria-label="Toggle color theme" title="Toggle theme">{theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button>;
}
