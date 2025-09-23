import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_DB_PATH = path.resolve(ROOT_DIR, 'data', 'enps.sqlite');

const DEFAULT_FEATURE_FLAGS = {
  analyticsDashboard: true,
  projectCreation: true,
  responseEditing: true,
} as const;

type FeatureFlagName = keyof typeof DEFAULT_FEATURE_FLAGS;

function parseFeatureFlags(raw: string | undefined): Partial<Record<FeatureFlagName, boolean>> {
  if (!raw) {
    return {};
  }

  return raw
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .reduce<Partial<Record<FeatureFlagName, boolean>>>((acc, token) => {
      const [flagKey, flagValue] = token.split('=').map((segment) => segment.trim());
      if (!flagKey || !(flagKey in DEFAULT_FEATURE_FLAGS)) {
        return acc;
      }

      const normalizedValue = flagValue?.toLowerCase();
      const enabled = normalizedValue === undefined ? true : normalizedValue !== 'false' && normalizedValue !== '0';
      acc[flagKey as FeatureFlagName] = enabled;
      return acc;
    }, {});
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  botToken: process.env.BOT_TOKEN ?? '',
  databaseFile: process.env.DATABASE_FILE
    ? path.resolve(ROOT_DIR, process.env.DATABASE_FILE)
    : DEFAULT_DB_PATH,
  allowInsecureInitData: process.env.ALLOW_INSECURE_INIT_DATA === 'true',
  serveFrontend: process.env.SERVE_FRONTEND !== 'false',
};

const featureFlagOverrides = parseFeatureFlags(process.env.FEATURE_FLAGS);

export const featureFlags: Record<FeatureFlagName, boolean> = {
  ...DEFAULT_FEATURE_FLAGS,
  ...featureFlagOverrides,
};

export function isFeatureEnabled(flag: FeatureFlagName): boolean {
  return featureFlags[flag];
}

export type { FeatureFlagName };

export function requireBotToken(): string {
  if (!config.botToken && !config.allowInsecureInitData) {
    throw new Error('BOT_TOKEN must be provided unless ALLOW_INSECURE_INIT_DATA is true');
  }

  return config.botToken;
}
