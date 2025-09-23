import type { TelegramUser } from './shared/types/api';

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
        onEvent?: (eventType: string, handler: () => void) => void;
        offEvent?: (eventType: string, handler: () => void) => void;
      };
    };
  }
}

export {};
