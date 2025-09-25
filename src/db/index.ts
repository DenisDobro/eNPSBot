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

let adapter: DatabaseAdapter | null = null;

function getAdapter(): DatabaseAdapter {
  if (!adapter) {
    if (config.databaseUrl) {
      adapter = createPostgresAdapter(config.databaseUrl);
    } else if (config.useSupabaseDefault) {
      adapter = createPostgresAdapter(config.supabaseDefaultUrl);
    } else {
      adapter = createSqliteAdapter(config.databaseFile);
    }
  }

  return adapter;
}

export function initDB(): Promise<void> {
  return getAdapter().init();
}

export function ensureUser(user: TelegramUser): Promise<void> {
  return getAdapter().ensureUser(user);
}

export function listProjects(search: string | undefined, limit: number): Promise<ProjectSummary[]> {
  return getAdapter().listProjects(search, limit);
}

export function createProject(name: string, createdBy?: number): Promise<ProjectSummary> {
  return getAdapter().createProject(name, createdBy);
}

export function updateProjectName(id: number, name: string): Promise<ProjectSummary | undefined> {
  return getAdapter().updateProjectName(id, name);
}

export function deleteProject(id: number): Promise<void> {
  return getAdapter().deleteProject(id);
}

export function deleteSurvey(id: number): Promise<void> {
  return getAdapter().deleteSurvey(id);
}

export function updateSurveyAnswers(id: number, updates: SurveyAnswers): Promise<SurveyRecord | undefined> {
  return getAdapter().updateSurveyAnswers(id, updates);
}

export function getSurveyById(id: number, userId: number): Promise<SurveyRecord | undefined> {
  return getAdapter().getSurveyById(id, userId);
}

export function listSurveys(userId: number, projectId?: number): Promise<SurveyRecord[]> {
  return getAdapter().listSurveys(userId, projectId);
}

export function createSurvey(userId: number, projectId: number, surveyDate?: string): Promise<SurveyCreationResult> {
  return getAdapter().createSurvey(userId, projectId, surveyDate);
}

export function updateSurvey(id: number, userId: number, updates: SurveyAnswers): Promise<SurveyRecord> {
  return getAdapter().updateSurvey(id, userId, updates);
}

export function listAdminProjects(): Promise<AdminProjectStats[]> {
  return getAdapter().listAdminProjects();
}

export function listAdminProjectResponses(projectId: number): Promise<AdminSurveyRecord[]> {
  return getAdapter().listAdminProjectResponses(projectId);
}
