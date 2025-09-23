import { isFeatureEnabled } from '../../config';
import {
  createSurvey as createSurveyRecord,
  getSurveyById,
  listSurveys as listSurveyRecords,
  updateSurvey as updateSurveyRecord,
} from './survey.repository';
import type { SurveyAnswers, SurveyRecord } from './survey.types';

type TextFieldKey =
  | 'projectImprovement'
  | 'managerImprovement'
  | 'teamImprovement'
  | 'processObstacles'
  | 'improvementIdeas';

const TEXT_FIELDS: TextFieldKey[] = [
  'projectImprovement',
  'managerImprovement',
  'teamImprovement',
  'processObstacles',
  'improvementIdeas',
];

function formatSurveyDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeAnswers(updates: SurveyAnswers): SurveyAnswers {
  const normalized: SurveyAnswers = { ...updates };

  TEXT_FIELDS.forEach((field) => {
    if (normalized[field] === undefined) {
      return;
    }

    const value = normalized[field];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        normalized[field] = undefined;
      } else {
        normalized[field] = trimmed;
      }
    }
  });

  return normalized;
}

export function listSurveys(userId: number, projectId?: number): SurveyRecord[] {
  return listSurveyRecords(userId, projectId);
}

export function loadSurveyById(id: number, userId: number): SurveyRecord | undefined {
  return getSurveyById(id, userId);
}

export function ensureSurveyForDate(
  userId: number,
  projectId: number,
  surveyDate?: string,
): { record: SurveyRecord; wasCreated: boolean } {
  const date = surveyDate ?? formatSurveyDate(new Date());
  return createSurveyRecord(userId, projectId, date);
}

export function updateSurveyAnswers(id: number, userId: number, payload: SurveyAnswers): SurveyRecord {
  if (!isFeatureEnabled('responseEditing')) {
    throw new Error('Survey editing is disabled');
  }

  const survey = getSurveyById(id, userId);
  if (!survey) {
    throw new Error('Survey not found');
  }

  if (!survey.canEdit) {
    throw new Error('Survey can no longer be edited');
  }

  const updates = normalizeAnswers(payload);
  return updateSurveyRecord(id, userId, updates);
}
