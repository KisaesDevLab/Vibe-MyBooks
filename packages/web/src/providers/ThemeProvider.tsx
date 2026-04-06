import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { ThemeMode, FontScaleLevel, DisplayPreferences } from '@kis-books/shared';
import { FONT_SCALE_VALUES } from '@kis-books/shared';
import { apiClient } from '../api/client';

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  fontScale: number;
  fontScaleLevel: FontScaleLevel;
  setTheme: (theme: ThemeMode) => void;
  setFontScale: (level: FontScaleLevel) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'kis-display-prefs';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

function scaleToLevel(scale: number): FontScaleLevel {
  const entries = Object.entries(FONT_SCALE_VALUES) as [string, number][];
  const match = entries.find(([, v]) => Math.abs(v - scale) < 0.01);
  return (match ? parseInt(match[0]) : 3) as FontScaleLevel;
}

function applyToDOM(theme: ThemeMode, fontScale: number) {
  const resolved = resolveTheme(theme);
  document.documentElement.setAttribute('data-theme', theme === 'system' ? 'system' : resolved);
  // Set font-size directly on the html element — this is what rem units reference
  document.documentElement.style.fontSize = `${16 * fontScale}px`;
}

function saveToStorage(prefs: DisplayPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function loadFromStorage(): DisplayPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { fontScale: 1, theme: 'system' };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const cached = loadFromStorage();
  const [theme, setThemeState] = useState<ThemeMode>(cached.theme);
  const [fontScale, setFontScaleState] = useState(cached.fontScale);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(resolveTheme(cached.theme));

  // Apply on mount
  useEffect(() => {
    applyToDOM(theme, fontScale);
    // Remove no-transition class after first paint
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('no-transition');
    });
  }, []);

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') {
        setResolvedTheme(getSystemTheme());
        applyToDOM('system', fontScale);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, fontScale]);

  const persistToServer = useCallback((prefs: Partial<DisplayPreferences>) => {
    apiClient('/auth/me/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }).catch(() => {}); // fire and forget
  }, []);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    setResolvedTheme(resolveTheme(newTheme));
    applyToDOM(newTheme, fontScale);
    const prefs = { fontScale, theme: newTheme };
    saveToStorage(prefs);
    persistToServer({ theme: newTheme });
  }, [fontScale, persistToServer]);

  const setFontScale = useCallback((level: FontScaleLevel) => {
    const newScale = FONT_SCALE_VALUES[level];
    setFontScaleState(newScale);
    applyToDOM(theme, newScale);
    const prefs = { fontScale: newScale, theme };
    saveToStorage(prefs);
    persistToServer({ fontScale: newScale });
  }, [theme, persistToServer]);

  const fontScaleLevel = scaleToLevel(fontScale);

  const increaseFontSize = useCallback(() => {
    if (fontScaleLevel < 7) setFontScale((fontScaleLevel + 1) as FontScaleLevel);
  }, [fontScaleLevel, setFontScale]);

  const decreaseFontSize = useCallback(() => {
    if (fontScaleLevel > 1) setFontScale((fontScaleLevel - 1) as FontScaleLevel);
  }, [fontScaleLevel, setFontScale]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, fontScale, fontScaleLevel, setTheme, setFontScale, increaseFontSize, decreaseFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
