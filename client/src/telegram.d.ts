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
        colorScheme?: string;
        setBackgroundColor?: (color: string) => void;
        setHeaderColor?: (color: string) => void;
      };
    };
  }
}

export {};
