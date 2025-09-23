import crypto from 'crypto';
import { TelegramUser } from './types';

export interface TelegramAuthPayload {
  user: TelegramUser;
  query: Record<string, string>;
}

export function parseTelegramInitData(rawData: string): Record<string, string> {
  const params = new URLSearchParams(rawData);
  const entries: Record<string, string> = {};

  params.forEach((value, key) => {
    entries[key] = value;
  });

  return entries;
}

export function validateTelegramInitData(
  rawData: string,
  botToken: string,
): TelegramAuthPayload {
  const parsed = parseTelegramInitData(rawData);
  const hashHex = parsed.hash;

  if (!hashHex) {
    throw new Error('Missing hash in init data');
  }

  const dataCheckArr: string[] = [];

  for (const key of Object.keys(parsed).filter((key) => key !== 'hash').sort()) {
    dataCheckArr.push(`${key}=${parsed[key]}`);
  }

  const dataCheckString = dataCheckArr.join('\n');
  const hashBuffer = Buffer.from(hashHex, 'hex');

  const calculateSignature = (secret: Buffer): Buffer =>
    crypto.createHmac('sha256', secret).update(dataCheckString).digest();

  const webAppSecret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const legacySecret = crypto.createHash('sha256').update(botToken).digest();

  const signatures = [calculateSignature(webAppSecret), calculateSignature(legacySecret)];

  const isValidSignature = signatures.some((signature) => {
    if (signature.length !== hashBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signature, hashBuffer);
  });

  if (!isValidSignature) {
    throw new Error('Invalid init data hash');
  }

  const userPayload = parsed.user;

  if (!userPayload) {
    throw new Error('Missing user information in init data');
  }

  let user: TelegramUser;

  try {
    user = JSON.parse(userPayload);
  } catch (error) {
    throw new Error('Failed to parse Telegram user payload');
  }

  if (typeof user.id !== 'number') {
    throw new Error('Invalid Telegram user payload');
  }

  return { user, query: parsed };
}
