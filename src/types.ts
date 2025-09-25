export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export type ContributionValue = 'yes' | 'no' | 'partial';

export interface SurveyAnswers {
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
}

export interface SurveyRecord extends SurveyAnswers {
  id: number;
  userId: number;
  projectId: number;
  projectName: string;
  surveyDate: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  isComplete: boolean;
}
