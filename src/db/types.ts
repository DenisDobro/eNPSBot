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

export interface DatabaseAdapter {
  init(): Promise<void>;
  ensureUser(user: TelegramUser): Promise<void>;
  listProjects(search: string | undefined, limit: number): Promise<ProjectSummary[]>;
  createProject(name: string, createdBy?: number): Promise<ProjectSummary>;
  updateProjectName(id: number, name: string): Promise<ProjectSummary | undefined>;
  deleteProject(id: number): Promise<void>;
  deleteSurvey(id: number): Promise<void>;
  updateSurveyAnswers(id: number, updates: SurveyAnswers): Promise<SurveyRecord | undefined>;
  getSurveyById(id: number, userId: number): Promise<SurveyRecord | undefined>;
  listSurveys(userId: number, projectId?: number): Promise<SurveyRecord[]>;
  createSurvey(userId: number, projectId: number, surveyDate?: string): Promise<SurveyCreationResult>;
  updateSurvey(id: number, userId: number, updates: SurveyAnswers): Promise<SurveyRecord>;
  listAdminProjects(): Promise<AdminProjectStats[]>;
  listAdminProjectResponses(projectId: number): Promise<AdminSurveyRecord[]>;
}
