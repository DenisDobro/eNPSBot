import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 3000),
  botToken: process.env.BOT_TOKEN ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
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
