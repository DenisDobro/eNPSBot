import type { SurveyAnswers, SurveyCreationResponse, SurveyRecord } from '../types/api';
import type { HttpClient } from './httpClient';

export function fetchSurveys(client: HttpClient, projectId?: number) {
  const params = new URLSearchParams();
  if (typeof projectId === 'number') {
    params.set('projectId', String(projectId));
  }

  const query = params.toString();
  return client.get<{ surveys: SurveyRecord[] }>(`/surveys${query ? `?${query}` : ''}`);
}

export function createSurvey(
  client: HttpClient,
  payload: { projectId: number; surveyDate?: string },
) {
  return client.post<SurveyCreationResponse>('/surveys', { body: payload });
}

export function updateSurvey(client: HttpClient, surveyId: number, updates: SurveyAnswers) {
  return client.patch<{ survey: SurveyRecord }>(`/surveys/${surveyId}`, { body: updates });
}

export function fetchSurvey(client: HttpClient, surveyId: number) {
  return client.get<{ survey: SurveyRecord }>(`/surveys/${surveyId}`);
}
