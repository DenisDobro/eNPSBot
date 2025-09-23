import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const TELEGRAM_THEME_COLORS: Record<ThemeMode, { background: string; header: string }> = {
  dark: { background: '#080F2B', header: '#101940' },
  light: { background: '#F6F7FB', header: '#FFFFFF' },
};

function resolvePreferredTheme(): ThemeMode {
  const webApp = window.Telegram?.WebApp;
  if (webApp?.colorScheme === 'dark' || webApp?.colorScheme === 'light') {
    return webApp.colorScheme;
  }

  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export function useMetalampTheme(): ThemeMode {
  const [theme, setTheme] = useState<ThemeMode>(() => resolvePreferredTheme());

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');

    const applyTheme = (mode: ThemeMode) => {
      setTheme(mode);
      document.body.dataset.theme = mode;
      document.documentElement.style.setProperty('color-scheme', mode);
      if (webApp) {
        const palette = TELEGRAM_THEME_COLORS[mode];
        webApp.setBackgroundColor?.(palette.background);
        webApp.setHeaderColor?.(palette.header);
      }
    };

    applyTheme(resolvePreferredTheme());

    const handleTelegramTheme = () => {
      applyTheme(resolvePreferredTheme());
    };

    const handleSystemTheme = (event: MediaQueryListEvent) => {
      if (webApp?.colorScheme === 'dark' || webApp?.colorScheme === 'light') {
        return;
      }

      applyTheme(event.matches ? 'dark' : 'light');
    };

    webApp?.onEvent?.('themeChanged', handleTelegramTheme);

    if (mediaQuery) {
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemTheme);
      } else {
        mediaQuery.addListener(handleSystemTheme);
      }
    }

    return () => {
      webApp?.offEvent?.('themeChanged', handleTelegramTheme);

      if (mediaQuery) {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleSystemTheme);
        } else {
          mediaQuery.removeListener(handleSystemTheme);
        }
      }
    };
  }, []);

  return theme;
}
