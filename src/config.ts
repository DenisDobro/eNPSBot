import dotenv from 'dotenv';

dotenv.config();

function buildDatabaseUrlFromParts(): string | null {
  const host = process.env.PGHOST ?? process.env.POSTGRES_HOST ?? null;
  const user = process.env.PGUSER ?? process.env.POSTGRES_USER ?? 'postgres';
  const password = process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD ?? null;
  const database = process.env.PGDATABASE ?? process.env.POSTGRES_DB ?? 'postgres';
  const port = process.env.PGPORT ?? process.env.POSTGRES_PORT ?? '5432';

  if (!host || !password) {
    return null;
  }

  const encodedPassword = encodeURIComponent(password);
  const sslMode = process.env.PGSSLMODE ?? 'require';

  return `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}?sslmode=${sslMode}`;
}

function resolveDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const fromParts = buildDatabaseUrlFromParts();
  if (fromParts) {
    return fromParts;
  }

  const supabase = process.env.SUPABASE_DB_URL?.trim() ?? process.env.SUPABASE_DB_CONNECTION_STRING?.trim();
  if (supabase) {
    return supabase;
  }

  return '';
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  botToken: process.env.BOT_TOKEN ?? '',
  databaseUrl: resolveDatabaseUrl(),
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
