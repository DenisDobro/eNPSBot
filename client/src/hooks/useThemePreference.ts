import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'system' | ThemeMode;

const TELEGRAM_THEME_COLORS: Record<ThemeMode, { background: string; header: string }> = {
  dark: { background: '#080F2B', header: '#101940' },
  light: { background: '#F6F7FB', header: '#FFFFFF' },
};

export function useThemePreference(): {
  theme: ThemeMode;
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
} {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') {
      return 'system';
    }

    const stored = window.localStorage?.getItem('themePreference');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }

    return 'system';
  });

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');

    if (preference === 'light' || preference === 'dark') {
      setTheme(preference);
      return undefined;
    }

    const resolveTheme = (): ThemeMode => {
      if (webApp?.colorScheme === 'dark' || webApp?.colorScheme === 'light') {
        return webApp.colorScheme;
      }

      return mediaQuery?.matches ? 'dark' : 'light';
    };

    setTheme(resolveTheme());

    const handleTelegramTheme = () => {
      setTheme(resolveTheme());
    };

    const handleSystemTheme = (event: MediaQueryListEvent) => {
      if (webApp?.colorScheme === 'dark' || webApp?.colorScheme === 'light') {
        return;
      }

      setTheme(event.matches ? 'dark' : 'light');
    };

    if (webApp?.onEvent) {
      webApp.onEvent('themeChanged', handleTelegramTheme);
    }

    if (mediaQuery) {
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemTheme);
      } else {
        mediaQuery.addListener(handleSystemTheme);
      }
    }

    return () => {
      if (webApp?.offEvent) {
        webApp.offEvent('themeChanged', handleTelegramTheme);
      }

      if (mediaQuery) {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleSystemTheme);
        } else {
          mediaQuery.removeListener(handleSystemTheme);
        }
      }
    };
  }, [preference]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.theme = theme;
      document.documentElement.style.setProperty('color-scheme', theme);
    }

    const webApp = window.Telegram?.WebApp;
    if (webApp) {
      const palette = TELEGRAM_THEME_COLORS[theme];
      webApp.setBackgroundColor?.(palette.background);
      webApp.setHeaderColor?.(palette.header);
    }
  }, [theme]);

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem('themePreference', value);
    }

    if (value === 'light' || value === 'dark') {
      setTheme(value);
    }
  }, []);

  return { theme, preference, setPreference };
}
