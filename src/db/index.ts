import { config } from '../config';
import {
  AdminProjectStats,
  AdminSurveyRecord,
  DatabaseAdapter,
  ProjectSummary,
  SurveyCreationResult,
} from './types';
import { createSqliteAdapter } from './sqlite';
import { createPostgresAdapter } from './postgres';
import { SurveyAnswers, SurveyRecord, TelegramUser } from '../types';

const DEFAULT_INIT_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 750;

let adapter: DatabaseAdapter | null = null;

function requireAdapter(): DatabaseAdapter {
  if (!adapter) {
    throw new Error('Database adapter has not been initialized. Call initDB() before using it.');
  }

  return adapter;
}

async function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function initWithRetry(db: DatabaseAdapter, attempts = DEFAULT_INIT_ATTEMPTS): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await db.init();
      return;
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        const backoff = RETRY_BASE_DELAY_MS * attempt;
        // eslint-disable-next-line no-console
        console.warn(
          `Database init attempt ${attempt} failed. Retrying in ${backoff}ms...`,
          error,
        );
        await sleep(backoff);
      }
    }
  }

  throw lastError;
}

async function createAdapter(): Promise<void> {
  if (adapter) {
    return;
  }

  if (config.databaseUrl) {
    const postgres = createPostgresAdapter(config.databaseUrl);
    try {
      await initWithRetry(postgres);
      adapter = postgres;
      return;
    } catch (error) {
      await postgres.close().catch(() => undefined);
      // eslint-disable-next-line no-console
      console.warn(
        'Failed to connect using DATABASE_URL. Falling back to alternative database adapters.',
        error,
      );
    }
  }

  if (config.useSupabaseDefault) {
    const supabase = createPostgresAdapter(config.supabaseDefaultUrl);
    try {
      await initWithRetry(supabase);
      adapter = supabase;
      return;
    } catch (error) {
      await supabase.close().catch(() => undefined);
      // eslint-disable-next-line no-console
      console.warn(
        'Failed to connect to the default Supabase database. Falling back to the local SQLite storage.',
        error,
      );
    }
  }

  const sqlite = createSqliteAdapter(config.databaseFile);
  await sqlite.init();
  adapter = sqlite;
}

export async function initDB(): Promise<void> {
  await createAdapter();
}

export function ensureUser(user: TelegramUser): Promise<void> {
  return requireAdapter().ensureUser(user);
}

export function listProjects(search: string | undefined, limit: number): Promise<ProjectSummary[]> {
  return requireAdapter().listProjects(search, limit);
}

export function createProject(name: string, createdBy?: number): Promise<ProjectSummary> {
  return requireAdapter().createProject(name, createdBy);
}

export function updateProjectName(id: number, name: string): Promise<ProjectSummary | undefined> {
  return requireAdapter().updateProjectName(id, name);
}

export function deleteProject(id: number): Promise<void> {
  return requireAdapter().deleteProject(id);
}

export function deleteSurvey(id: number): Promise<void> {
  return requireAdapter().deleteSurvey(id);
}

export function updateSurveyAnswers(id: number, updates: SurveyAnswers): Promise<SurveyRecord | undefined> {
  return requireAdapter().updateSurveyAnswers(id, updates);
}

export function getSurveyById(id: number, userId: number): Promise<SurveyRecord | undefined> {
  return requireAdapter().getSurveyById(id, userId);
}

export function listSurveys(userId: number, projectId?: number): Promise<SurveyRecord[]> {
  return requireAdapter().listSurveys(userId, projectId);
}

export function createSurvey(userId: number, projectId: number, surveyDate?: string): Promise<SurveyCreationResult> {
  return requireAdapter().createSurvey(userId, projectId, surveyDate);
}

export function updateSurvey(id: number, userId: number, updates: SurveyAnswers): Promise<SurveyRecord> {
  return requireAdapter().updateSurvey(id, userId, updates);
}

export function listAdminProjects(): Promise<AdminProjectStats[]> {
  return requireAdapter().listAdminProjects();
}

export function listAdminProjectResponses(projectId: number): Promise<AdminSurveyRecord[]> {
  return requireAdapter().listAdminProjectResponses(projectId);
}
