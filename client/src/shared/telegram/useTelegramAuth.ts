import { useEffect, useState } from 'react';
import type { ApiAuthContext } from '../api/httpClient';
import type { TelegramUser } from '../types/api';
import { createFallbackUser } from './createFallbackUser';

interface TelegramAuthState {
  auth: ApiAuthContext;
  user: TelegramUser | null;
  ready: boolean;
}

export function useTelegramAuth(): TelegramAuthState {
  const [auth, setAuth] = useState<ApiAuthContext>({ initDataRaw: null, debugUser: null });
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (webApp) {
      webApp.ready();
      webApp.expand?.();

      const initData = webApp.initData && webApp.initData.length > 0 ? webApp.initData : null;
      setAuth({ initDataRaw: initData, debugUser: null });
      setUser(webApp.initDataUnsafe?.user ?? null);
    } else {
      const fallback = createFallbackUser();
      setAuth({ initDataRaw: null, debugUser: fallback });
      setUser(fallback);
    }

    setReady(true);
  }, []);

  return { auth, user, ready };
}
