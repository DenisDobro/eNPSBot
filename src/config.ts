import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data', 'enps.sqlite');

export const config = {
  port: Number(process.env.PORT ?? 3000),
  botToken: process.env.BOT_TOKEN ?? '',
  databaseFile: process.env.DATABASE_FILE
    ? path.resolve(process.cwd(), process.env.DATABASE_FILE)
    : DEFAULT_DB_PATH,
  allowInsecureInitData: process.env.ALLOW_INSECURE_INIT_DATA === 'true',
  serveFrontend: process.env.SERVE_FRONTEND !== 'false',
};

export function requireBotToken(): string {
  if (!config.botToken && !config.allowInsecureInitData) {
    throw new Error('BOT_TOKEN must be provided unless ALLOW_INSECURE_INIT_DATA is true');
  }

  return config.botToken;
}
