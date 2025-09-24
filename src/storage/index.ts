import { config } from '../config';
import type { AdminProjectStats, AdminSurveyRecord, ProjectSummary, SurveyCreationResult } from './types';
import type { SurveyAnswers, SurveyRecord, TelegramUser } from '../types';
import type { DataStore } from './types';
import { createSqliteStore } from './sqliteStore';
import { createPostgresStore } from './postgresStore';

let store: DataStore | null = null;

function ensureStore(): DataStore {
  if (!store) {
    store = config.supabase.databaseUrl ? createPostgresStore() : createSqliteStore();
  }

  return store;
}

export async function initStore(): Promise<void> {
  await ensureStore().init();
}

export async function ensureUser(user: TelegramUser): Promise<void> {
  await ensureStore().ensureUser(user);
}

export async function listProjects(search: string | undefined, limit: number): Promise<ProjectSummary[]> {
  return ensureStore().listProjects(search, limit);
}

export async function createProject(name: string, userId: number): Promise<ProjectSummary> {
  return ensureStore().createProject(name, userId);
}

export async function getSurveyById(id: number, userId: number): Promise<SurveyRecord | null> {
  return ensureStore().getSurveyById(id, userId);
}

export async function listSurveys(userId: number, projectId?: number): Promise<SurveyRecord[]> {
  return ensureStore().listSurveys(userId, projectId);
}

export async function createSurvey(
  userId: number,
  projectId: number,
  surveyDate?: string,
): Promise<SurveyCreationResult> {
  return ensureStore().createSurvey(userId, projectId, surveyDate);
}

export async function updateSurvey(id: number, userId: number, updates: SurveyAnswers): Promise<SurveyRecord> {
  return ensureStore().updateSurvey(id, userId, updates);
}

export async function listAdminProjects(): Promise<AdminProjectStats[]> {
  return ensureStore().listAdminProjects();
}

export async function listAdminProjectResponses(projectId: number): Promise<AdminSurveyRecord[]> {
  return ensureStore().listAdminProjectResponses(projectId);
}

export type { ProjectSummary, AdminProjectStats, AdminSurveyRecord, SurveyCreationResult } from './types';
