import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_DB_PATH = path.resolve(ROOT_DIR, 'data', 'enps.sqlite');
const DEFAULT_SUPABASE_URL =
  'postgresql://postgres.xaprakcfyozyquooagez:MetaLampPMO@aws-1-us-east-2.pooler.supabase.com:6543/postgres';

const envDatabaseUrl = process.env.DATABASE_URL;
const useSupabaseDefault = process.env.USE_SUPABASE_DEFAULT !== 'false';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  botToken: process.env.BOT_TOKEN ?? '',
  databaseFile: process.env.DATABASE_FILE
    ? path.resolve(ROOT_DIR, process.env.DATABASE_FILE)
    : DEFAULT_DB_PATH,
  databaseUrl: envDatabaseUrl ?? '',
  supabaseDefaultUrl: DEFAULT_SUPABASE_URL,
  useSupabaseDefault,
  allowInsecureInitData: process.env.ALLOW_INSECURE_INIT_DATA === 'true',
  serveFrontend: process.env.SERVE_FRONTEND !== 'false',
  adminToken: process.env.ADMIN_TOKEN ?? '',
};

export function requireBotToken(): string {
  if (!config.botToken && !config.allowInsecureInitData) {
    throw new Error('BOT_TOKEN must be provided unless ALLOW_INSECURE_INIT_DATA is true');
  }

  return config.botToken;
}

export function ensureAdminAccessConfigured(): void {
  if (!config.adminToken) {
    throw new Error('ADMIN_TOKEN is not configured');
  }
}
