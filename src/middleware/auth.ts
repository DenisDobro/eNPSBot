import { NextFunction, Request, Response } from 'express';
import { ensureUser } from '../db';
import { config, requireBotToken } from '../config';
import { TelegramUser } from '../types';
import { validateTelegramInitData } from '../telegram';

declare global {
  namespace Express {
    interface Request {
      telegramUser?: TelegramUser;
      initDataRaw?: string;
    }
  }
}

const DEBUG_USER_HEADER = 'x-debug-user';
const TELEGRAM_INIT_HEADER = 'x-telegram-init-data';

export function telegramAuth(req: Request, res: Response, next: NextFunction): void {
  const initDataRaw = req.header(TELEGRAM_INIT_HEADER);

  if (!initDataRaw) {
    if (!config.allowInsecureInitData) {
      res.status(401).json({ error: 'Missing Telegram init data header' });
      return;
    }

    const debugHeader = req.header(DEBUG_USER_HEADER);
    if (!debugHeader) {
      res.status(401).json({ error: 'Missing debug user header in insecure mode' });
      return;
    }

    try {
      const debugUser = JSON.parse(debugHeader) as TelegramUser;
      if (typeof debugUser?.id !== 'number' || !debugUser.first_name) {
        throw new Error('Invalid debug user payload');
      }

      ensureUser(debugUser);
      req.telegramUser = debugUser;
      req.initDataRaw = 'debug';
      next();
      return;
    } catch (error) {
      res.status(401).json({ error: 'Failed to parse debug user payload' });
      return;
    }
  }

  try {
    const botToken = requireBotToken();
    const { user } = validateTelegramInitData(initDataRaw, botToken);
    ensureUser(user);
    req.telegramUser = user;
    req.initDataRaw = initDataRaw;
    next();
  } catch (error) {
    res.status(401).json({ error: (error as Error).message });
  }
}
