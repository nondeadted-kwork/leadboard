import { useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'leadboard-theme';

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system'; // private mode or blocked storage
  }
}

/** Light / dark / system. The choice lives in <html data-theme>, CSS does the rest. */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeChoice>(read);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try {
      if (theme === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      /* not critical */
    }
  }, [theme]);
  return [theme, setTheme] as const;
}
