import type { TelegramUser } from '../types/api';

export function createFallbackUser(): TelegramUser {
  return {
    id: 1,
    first_name: 'Metallamp',
    last_name: 'Team',
    username: 'metallamp',
  };
}
