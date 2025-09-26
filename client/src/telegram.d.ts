import type { TelegramUser } from './types';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          user?: TelegramUser;
        };
        ready: () => void;
        expand: () => void;

        colorScheme?: 'light' | 'dark' | string;
        setBackgroundColor?: (color: string) => void;
        setHeaderColor?: (color: string) => void;
        safeAreaInset?: {
          top?: number;
          bottom?: number;
          left?: number;
          right?: number;
        };
        contentSafeAreaInset?: {
          top?: number;
          bottom?: number;
          left?: number;
          right?: number;
        };
        platform?: 'ios' | 'android' | 'android_x' | string;
        viewportHeight?: number;
        viewportStableHeight?: number;
        onEvent?: (eventType: string, handler: () => void) => void;
        offEvent?: (eventType: string, handler: () => void) => void;

        openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
      };
    };
  }
}

export {};
