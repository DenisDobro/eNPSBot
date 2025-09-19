import type {
  ApiError,
  ProjectSummary,
  SurveyAnswers,
  SurveyCreationResponse,
  SurveyRecord,
  TelegramUser,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export interface ApiAuthContext {
  initDataRaw: string | null;
  debugUser: TelegramUser | null;
}

interface RequestOptions extends RequestInit {
  auth: ApiAuthContext;
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const headers = new Headers(options.headers ?? {});

  if (options.method && options.method !== 'GET' && options.method !== 'HEAD') {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth.initDataRaw) {
    headers.set('x-telegram-init-data', options.auth.initDataRaw);
  } else if (options.auth.debugUser) {
    headers.set('x-debug-user', JSON.stringify(options.auth.debugUser));
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorPayload: ApiError | undefined;
    try {
      errorPayload = (await response.json()) as ApiError;
    } catch {
      // ignore
    }

    const errorMessage = errorPayload?.error ?? `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function fetchProjects(auth: ApiAuthContext, search?: string): Promise<{ projects: ProjectSummary[] }> {
  const params = new URLSearchParams();
  if (search) {
    params.set('search', search);
  }

  const query = params.toString();
  return request(`/projects${query ? `?${query}` : ''}`, { method: 'GET', auth });
}

export function createProject(auth: ApiAuthContext, name: string): Promise<{ project: ProjectSummary }> {
  return request('/projects', {
    method: 'POST',
    auth,
    body: JSON.stringify({ name }),
  });
}

export function fetchSurveys(auth: ApiAuthContext, projectId?: number): Promise<{ surveys: SurveyRecord[] }> {
  const params = new URLSearchParams();
  if (typeof projectId === 'number') {
    params.set('projectId', String(projectId));
  }

  const query = params.toString();
  return request(`/surveys${query ? `?${query}` : ''}`, { method: 'GET', auth });
}

export function createSurveyRequest(
  auth: ApiAuthContext,
  payload: { projectId: number; surveyDate?: string },
): Promise<SurveyCreationResponse> {
  return request('/surveys', {
    method: 'POST',
    auth,
    body: JSON.stringify(payload),
  });
}

export function updateSurveyRequest(
  auth: ApiAuthContext,
  surveyId: number,
  updates: SurveyAnswers,
): Promise<{ survey: SurveyRecord }> {
  return request(`/surveys/${surveyId}`, {
    method: 'PATCH',
    auth,
    body: JSON.stringify(updates),
  });
}

export function fetchSurvey(auth: ApiAuthContext, surveyId: number): Promise<{ survey: SurveyRecord }> {
  return request(`/surveys/${surveyId}`, { method: 'GET', auth });
}
