import type { ProjectSummary } from '../types/api';
import type { HttpClient } from './httpClient';

export function fetchProjects(client: HttpClient, search?: string) {
  const params = new URLSearchParams();
  if (search) {
    params.set('search', search);
  }

  const query = params.toString();
  return client.get<{ projects: ProjectSummary[] }>(`/projects${query ? `?${query}` : ''}`);
}

export function createProject(client: HttpClient, name: string) {
  return client.post<{ project: ProjectSummary }>('/projects', { body: { name } });
}
