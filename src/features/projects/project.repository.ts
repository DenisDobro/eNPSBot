import { getDatabase } from '../../lib/database';
import type { ProjectSummary } from './project.types';

interface ProjectSearchParams {
  search?: string;
  limit: number;
}

export class ProjectRepository {
  private readonly db = getDatabase();
  private readonly listStatement = this.db.prepare(
    `SELECT
       p.id AS id,
       p.name AS name,
       p.created_at AS createdAt,
       COALESCE(stats.responsesCount, 0) AS responsesCount,
       stats.lastResponseAt AS lastResponseAt
     FROM projects p
     LEFT JOIN (
       SELECT
         project_id,
         COUNT(1) AS responsesCount,
         MAX(created_at) AS lastResponseAt
       FROM surveys
       GROUP BY project_id
     ) stats ON stats.project_id = p.id
     WHERE (:search IS NULL OR LOWER(p.name) LIKE :searchPattern)
     ORDER BY COALESCE(stats.lastResponseAt, p.created_at) DESC
     LIMIT :limit`
  );
  private readonly insertStatement = this.db.prepare(
    `INSERT INTO projects (name, created_by, created_at)
     VALUES (:name, :createdBy, :createdAt)
     ON CONFLICT(name) DO NOTHING`
  );
  private readonly findByNameStatement = this.db.prepare(
    `SELECT
       p.id AS id,
       p.name AS name,
       p.created_at AS createdAt,
       COALESCE(stats.responsesCount, 0) AS responsesCount,
       stats.lastResponseAt AS lastResponseAt
     FROM projects p
     LEFT JOIN (
       SELECT
         project_id,
         COUNT(1) AS responsesCount,
         MAX(created_at) AS lastResponseAt
       FROM surveys
       GROUP BY project_id
     ) stats ON stats.project_id = p.id
     WHERE LOWER(p.name) = LOWER(:name)
     LIMIT 1`
  );
  private readonly findByIdStatement = this.db.prepare(
    `SELECT
       p.id AS id,
       p.name AS name,
       p.created_at AS createdAt,
       COALESCE(stats.responsesCount, 0) AS responsesCount,
       stats.lastResponseAt AS lastResponseAt
     FROM projects p
     LEFT JOIN (
       SELECT
         project_id,
         COUNT(1) AS responsesCount,
         MAX(created_at) AS lastResponseAt
       FROM surveys
       GROUP BY project_id
     ) stats ON stats.project_id = p.id
     WHERE p.id = :id
     LIMIT 1`
  );

  list({ search, limit }: ProjectSearchParams): ProjectSummary[] {
    const normalizedSearch = search?.trim().toLowerCase();
    const params = {
      search: normalizedSearch ?? null,
      searchPattern: normalizedSearch ? `%${normalizedSearch}%` : null,
      limit,
    };

    return this.listStatement.all(params) as ProjectSummary[];
  }

  create(name: string, userId: number): ProjectSummary {
    const trimmed = name.trim();
    const now = new Date().toISOString();
    const insertResult = this.insertStatement.run({
      name: trimmed,
      createdBy: userId,
      createdAt: now,
    });

    if (insertResult.changes === 0) {
      const existing = this.findByNameStatement.get({ name: trimmed }) as ProjectSummary | undefined;
      if (!existing) {
        throw new Error('Failed to load existing project after conflict resolution');
      }
      return existing;
    }

    const id = Number(insertResult.lastInsertRowid);
    const created = this.findByIdStatement.get({ id }) as ProjectSummary | undefined;
    if (!created) {
      throw new Error('Failed to fetch project after insertion');
    }
    return created;
  }
}

export const projectRepository = new ProjectRepository();

export function listProjects(params: ProjectSearchParams): ProjectSummary[] {
  return projectRepository.list(params);
}

export function createProject(name: string, userId: number): ProjectSummary {
  return projectRepository.create(name, userId);
}
