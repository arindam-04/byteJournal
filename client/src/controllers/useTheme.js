import { useEffect, useState } from 'react';
export default function useTheme() {
  const [theme, setTheme] = useState(() => { const saved = localStorage.getItem('bytejournal-theme'); if (saved) return saved; return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; });
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('bytejournal-theme', theme); }, [theme]);
  return [theme, () => setTheme(t => t === 'light' ? 'dark' : 'light'), setTheme];
}
