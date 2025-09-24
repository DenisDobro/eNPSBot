import { ContributionValue, SurveyAnswers, SurveyRecord, TelegramUser } from '../types';

export interface ProjectSummary {
  id: number;
  name: string;
  createdAt: string;
  responsesCount: number;
  lastResponseAt: string | null;
}

export interface AdminProjectStats extends ProjectSummary {
  uniqueRespondents: number;
  averages: {
    projectRecommendation: number | null;
    managerEffectiveness: number | null;
    teamComfort: number | null;
    processOrganization: number | null;
  };
  contributionBreakdown: Record<ContributionValue, number>;
}

export interface AdminSurveyRecord extends SurveyRecord {
  user: {
    id: number;
    firstName: string;
    lastName: string | null;
    username: string | null;
  };
}

export interface SurveyCreationResult {
  record: SurveyRecord;
  wasCreated: boolean;
}

export interface DataStore {
  init(): Promise<void>;
  ensureUser(user: TelegramUser): Promise<void>;
  listProjects(search: string | undefined, limit: number): Promise<ProjectSummary[]>;
  createProject(name: string, userId: number): Promise<ProjectSummary>;
  getSurveyById(id: number, userId: number): Promise<SurveyRecord | null>;
  listSurveys(userId: number, projectId?: number): Promise<SurveyRecord[]>;
  createSurvey(userId: number, projectId: number, surveyDate?: string): Promise<SurveyCreationResult>;
  updateSurvey(id: number, userId: number, updates: SurveyAnswers): Promise<SurveyRecord>;
  listAdminProjects(): Promise<AdminProjectStats[]>;
  listAdminProjectResponses(projectId: number): Promise<AdminSurveyRecord[]>;
}
