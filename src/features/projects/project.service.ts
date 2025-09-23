import { isFeatureEnabled } from '../../config';
import { createProject as createProjectRecord, listProjects as listProjectRecords } from './project.repository';
import type { ProjectSummary } from './project.types';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

function sanitizeLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Number(value), MIN_LIMIT), MAX_LIMIT);
}

export function searchProjects(search: string | undefined, limit?: number): ProjectSummary[] {
  return listProjectRecords({ search, limit: sanitizeLimit(limit) });
}

export function createProject(name: string, userId: number): ProjectSummary {
  if (!isFeatureEnabled('projectCreation')) {
    throw new Error('Project creation is disabled');
  }

  return createProjectRecord(name, userId);
}
