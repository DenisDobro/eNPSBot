export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export type ContributionValue = 'yes' | 'no' | 'partial';

export interface ProjectSummary {
  id: number;
  name: string;
  createdAt: string;
  responsesCount: number;
  lastResponseAt: string | null;
}

export interface SurveyRecord {
  id: number;
  userId: number;
  projectId: number;
  projectName: string;
  surveyDate: string;
  projectRecommendation?: number;
  projectImprovement?: string;
  managerEffectiveness?: number;
  managerImprovement?: string;
  teamComfort?: number;
  teamImprovement?: string;
  processOrganization?: number;
  processObstacles?: string;
  contributionValued?: ContributionValue;
  improvementIdeas?: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
}

export type SurveyAnswers = Partial<
  Pick<
    SurveyRecord,
    | 'projectRecommendation'
    | 'projectImprovement'
    | 'managerEffectiveness'
    | 'managerImprovement'
    | 'teamComfort'
    | 'teamImprovement'
    | 'processOrganization'
    | 'processObstacles'
    | 'contributionValued'
    | 'improvementIdeas'
  >
>;

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface SurveyCreationResponse {
  record: SurveyRecord;
  wasCreated: boolean;
}
