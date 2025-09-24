import { Pool, types } from 'pg';
import { config } from '../config';
import { ContributionValue, SurveyAnswers, SurveyRecord, TelegramUser } from '../types';
import type {
  AdminProjectStats,
  AdminSurveyRecord,
  DataStore,
  ProjectSummary,
  SurveyCreationResult,
} from './types';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Parse BIGINT and NUMERIC values as numbers when it is safe to do so.
types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

type SurveyRow = {
  id: number;
  user_id: number;
  project_id: number;
  survey_date: string;
  project_recommendation: number | null;
  project_improvement: string | null;
  manager_effectiveness: number | null;
  manager_improvement: string | null;
  team_comfort: number | null;
  team_improvement: string | null;
  process_organization: number | null;
  process_obstacles: string | null;
  contribution_valued: ContributionValue | null;
  improvement_ideas: string | null;
  created_at: string;
  updated_at: string;
  project_name: string;
};

function nullableNumber(value: number | null): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function mapSurveyRow(row: SurveyRow): SurveyRecord {
  const editable = Date.now() - new Date(row.created_at).getTime() <= ONE_DAY_MS;

  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    projectId: Number(row.project_id),
    projectName: row.project_name,
    surveyDate: row.survey_date,
    projectRecommendation: nullableNumber(row.project_recommendation),
    projectImprovement: row.project_improvement ?? undefined,
    managerEffectiveness: nullableNumber(row.manager_effectiveness),
    managerImprovement: row.manager_improvement ?? undefined,
    teamComfort: nullableNumber(row.team_comfort),
    teamImprovement: row.team_improvement ?? undefined,
    processOrganization: nullableNumber(row.process_organization),
    processObstacles: row.process_obstacles ?? undefined,
    contributionValued: row.contribution_valued ?? undefined,
    improvementIdeas: row.improvement_ideas ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canEdit: editable,
  };
}

const surveyFieldToColumn: Record<keyof SurveyAnswers, string> = {
  projectRecommendation: 'project_recommendation',
  projectImprovement: 'project_improvement',
  managerEffectiveness: 'manager_effectiveness',
  managerImprovement: 'manager_improvement',
  teamComfort: 'team_comfort',
  teamImprovement: 'team_improvement',
  processOrganization: 'process_organization',
  processObstacles: 'process_obstacles',
  contributionValued: 'contribution_valued',
  improvementIdeas: 'improvement_ideas',
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function createPostgresStore(): DataStore {
  if (!config.supabase.databaseUrl) {
    throw new Error('SUPABASE_DB_URL is not configured');
  }

  const pool = new Pool({
    connectionString: config.supabase.databaseUrl,
    ssl: config.supabase.ssl ? { rejectUnauthorized: false } : undefined,
  });

  async function loadSurveyById(id: number, userId: number): Promise<SurveyRecord | null> {
    const { rows } = await pool.query<SurveyRow>(
      `SELECT
         s.id,
         s.user_id,
         s.project_id,
         s.survey_date,
         s.project_recommendation,
         s.project_improvement,
         s.manager_effectiveness,
         s.manager_improvement,
         s.team_comfort,
         s.team_improvement,
         s.process_organization,
         s.process_obstacles,
         s.contribution_valued,
         s.improvement_ideas,
         s.created_at,
         s.updated_at,
         p.name AS project_name
       FROM surveys s
       JOIN projects p ON p.id = s.project_id
       WHERE s.id = $1 AND s.user_id = $2`,
      [id, userId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return mapSurveyRow(row);
  }

  async function loadSurveyByDate(
    userId: number,
    projectId: number,
    surveyDate: string,
  ): Promise<SurveyRecord | null> {
    const { rows } = await pool.query<SurveyRow>(
      `SELECT
         s.id,
         s.user_id,
         s.project_id,
         s.survey_date,
         s.project_recommendation,
         s.project_improvement,
         s.manager_effectiveness,
         s.manager_improvement,
         s.team_comfort,
         s.team_improvement,
         s.process_organization,
         s.process_obstacles,
         s.contribution_valued,
         s.improvement_ideas,
         s.created_at,
         s.updated_at,
         p.name AS project_name
       FROM surveys s
       JOIN projects p ON p.id = s.project_id
       WHERE s.user_id = $1 AND s.project_id = $2 AND s.survey_date = $3`,
      [userId, projectId, surveyDate],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return mapSurveyRow(row);
  }

  return {
    async init(): Promise<void> {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id BIGINT PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT,
          username TEXT,
          language_code TEXT,
          photo_url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS projects (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          created_by BIGINT REFERENCES users(id),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS surveys (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id),
          project_id BIGINT NOT NULL REFERENCES projects(id),
          survey_date DATE NOT NULL,
          project_recommendation INTEGER,
          project_improvement TEXT,
          manager_effectiveness INTEGER,
          manager_improvement TEXT,
          team_comfort INTEGER,
          team_improvement TEXT,
          process_organization INTEGER,
          process_obstacles TEXT,
          contribution_valued TEXT CHECK (contribution_valued IN ('yes', 'no', 'partial')),
          improvement_ideas TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, project_id, survey_date)
        );
      `);

      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name_ci ON projects (LOWER(name));`,
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_surveys_user_project ON surveys (user_id, project_id, survey_date);`,
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_surveys_project_created_at ON surveys (project_id, created_at);`,
      );
    },

    async ensureUser(user: TelegramUser): Promise<void> {
      await pool.query(
        `INSERT INTO users (id, first_name, last_name, username, language_code, photo_url, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           username = EXCLUDED.username,
           language_code = EXCLUDED.language_code,
           photo_url = EXCLUDED.photo_url,
           updated_at = NOW()`,
        [
          user.id,
          user.first_name,
          user.last_name ?? null,
          user.username ?? null,
          user.language_code ?? null,
          user.photo_url ?? null,
        ],
      );
    },

    async listProjects(search: string | undefined, limit: number): Promise<ProjectSummary[]> {
      const params: Array<string | number> = [];
      let whereClause = '';

      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        whereClause = `WHERE LOWER(p.name) LIKE $${params.length}`;
      }

      params.push(limit);

      const { rows } = await pool.query<{
        id: number;
        name: string;
        createdAt: string;
        responsesCount: number | null;
        lastResponseAt: string | null;
      }>(
        `SELECT
           p.id,
           p.name,
           p.created_at AS "createdAt",
           COUNT(s.id) AS "responsesCount",
           MAX(s.created_at) AS "lastResponseAt"
         FROM projects p
         LEFT JOIN surveys s ON s.project_id = p.id
         ${whereClause}
         GROUP BY p.id
         ORDER BY COALESCE(MAX(s.created_at), p.created_at) DESC
         LIMIT $${params.length}`,
        params,
      );

      return rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        createdAt: row.createdAt,
        responsesCount: Number(row.responsesCount ?? 0),
        lastResponseAt: row.lastResponseAt ?? null,
      }));
    },

    async createProject(name: string, userId: number): Promise<ProjectSummary> {
      const trimmed = name.trim();
      const { rows: existingRows } = await pool.query<{ id: number; name: string; createdAt: string }>(
        `SELECT id, name, created_at AS "createdAt"
         FROM projects
         WHERE LOWER(name) = LOWER($1)
         LIMIT 1`,
        [trimmed],
      );

      if (existingRows.length) {
        const existing = existingRows[0];
        if (!existing) {
          throw new Error('Failed to resolve existing project');
        }
        const { rows: stats } = await pool.query<{ responsesCount: number; lastResponseAt: string | null }>(
          `SELECT COUNT(1) AS "responsesCount", MAX(created_at) AS "lastResponseAt"
           FROM surveys
           WHERE project_id = $1`,
          [existing.id],
        );

        return {
          id: Number(existing.id),
          name: existing.name,
          createdAt: existing.createdAt,
          responsesCount: Number(stats[0]?.responsesCount ?? 0),
          lastResponseAt: stats[0]?.lastResponseAt ?? null,
        };
      }

      const { rows } = await pool.query<{ id: number; name: string; createdAt: string }>(
        `INSERT INTO projects (name, created_by)
         VALUES ($1, $2)
         RETURNING id, name, created_at AS "createdAt"`,
        [trimmed, userId],
      );

      const project = rows[0];
      if (!project) {
        throw new Error('Failed to create project');
      }
      return {
        id: Number(project.id),
        name: project.name,
        createdAt: project.createdAt,
        responsesCount: 0,
        lastResponseAt: null,
      };
    },

    async getSurveyById(id: number, userId: number): Promise<SurveyRecord | null> {
      return loadSurveyById(id, userId);
    },

    async listSurveys(userId: number, projectId?: number): Promise<SurveyRecord[]> {
      const params: Array<number | string> = [userId];
      let filter = '';

      if (typeof projectId === 'number') {
        params.push(projectId);
        filter = `AND s.project_id = $${params.length}`;
      }

      const { rows } = await pool.query<SurveyRow>(
        `SELECT
           s.id,
           s.user_id,
           s.project_id,
           s.survey_date,
           s.project_recommendation,
           s.project_improvement,
           s.manager_effectiveness,
           s.manager_improvement,
           s.team_comfort,
           s.team_improvement,
           s.process_organization,
           s.process_obstacles,
           s.contribution_valued,
           s.improvement_ideas,
           s.created_at,
           s.updated_at,
           p.name AS project_name
         FROM surveys s
         JOIN projects p ON p.id = s.project_id
         WHERE s.user_id = $1 ${filter}
         ORDER BY s.created_at DESC`,
        params,
      );

      return rows.map(mapSurveyRow);
    },

    async createSurvey(userId: number, projectId: number, surveyDate?: string): Promise<SurveyCreationResult> {
      const now = new Date();
      const date = surveyDate ?? formatDate(now);
      const { rowCount } = await pool.query(
        `INSERT INTO surveys (user_id, project_id, survey_date)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, project_id, survey_date) DO NOTHING`,
        [userId, projectId, date],
      );

      const record = await loadSurveyByDate(userId, projectId, date);
      if (!record) {
        throw new Error('Failed to load survey after creation');
      }

      return { record, wasCreated: (rowCount ?? 0) > 0 };
    },

    async updateSurvey(id: number, userId: number, updates: SurveyAnswers): Promise<SurveyRecord> {
      const survey = await loadSurveyById(id, userId);
      if (!survey) {
        throw new Error('Survey not found');
      }

      if (!survey.canEdit) {
        throw new Error('Survey can no longer be edited');
      }

      const assignments: string[] = [];
      const values: Array<string | number | null> = [];

      (Object.keys(updates) as Array<keyof SurveyAnswers>).forEach((key) => {
        const value = updates[key];
        if (value === undefined) {
          return;
        }

        assignments.push(`${surveyFieldToColumn[key]} = $${assignments.length + 1}`);

        if (typeof value === 'number') {
          values.push(value);
        } else if (value === null) {
          values.push(null);
        } else {
          values.push(value);
        }
      });

      if (!assignments.length) {
        return survey;
      }

      assignments.push('updated_at = NOW()');
      values.push(id);
      values.push(userId);

      await pool.query(
        `UPDATE surveys
         SET ${assignments.join(', ')}
         WHERE id = $${values.length - 1} AND user_id = $${values.length}`,
        values,
      );

      const updated = await loadSurveyById(id, userId);
      if (!updated) {
        throw new Error('Failed to load survey after update');
      }

      return updated;
    },

    async listAdminProjects(): Promise<AdminProjectStats[]> {
      const { rows } = await pool.query<{
        id: number;
        name: string;
        createdAt: string;
        responsesCount: number | null;
        lastResponseAt: string | null;
        uniqueRespondents: number | null;
        avgProjectRecommendation: number | null;
        avgManagerEffectiveness: number | null;
        avgTeamComfort: number | null;
        avgProcessOrganization: number | null;
        contributionYes: number | null;
        contributionPartial: number | null;
        contributionNo: number | null;
      }>(
        `SELECT
           p.id,
           p.name,
           p.created_at AS "createdAt",
           COUNT(s.id) AS "responsesCount",
           MAX(s.created_at) AS "lastResponseAt",
           COUNT(DISTINCT s.user_id) AS "uniqueRespondents",
           AVG(s.project_recommendation) AS "avgProjectRecommendation",
           AVG(s.manager_effectiveness) AS "avgManagerEffectiveness",
           AVG(s.team_comfort) AS "avgTeamComfort",
           AVG(s.process_organization) AS "avgProcessOrganization",
           SUM(CASE WHEN s.contribution_valued = 'yes' THEN 1 ELSE 0 END) AS "contributionYes",
           SUM(CASE WHEN s.contribution_valued = 'partial' THEN 1 ELSE 0 END) AS "contributionPartial",
           SUM(CASE WHEN s.contribution_valued = 'no' THEN 1 ELSE 0 END) AS "contributionNo"
         FROM projects p
         LEFT JOIN surveys s ON s.project_id = p.id
         GROUP BY p.id
         ORDER BY COALESCE(MAX(s.created_at), p.created_at) DESC`,
      );

      const average = (value: number | null | undefined): number | null => {
        if (value === null || value === undefined || Number.isNaN(value)) {
          return null;
        }
        return Number(value);
      };

      return rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        createdAt: row.createdAt,
        responsesCount: Number(row.responsesCount ?? 0),
        lastResponseAt: row.lastResponseAt ?? null,
        uniqueRespondents: Number(row.uniqueRespondents ?? 0),
        averages: {
          projectRecommendation: average(row.avgProjectRecommendation),
          managerEffectiveness: average(row.avgManagerEffectiveness),
          teamComfort: average(row.avgTeamComfort),
          processOrganization: average(row.avgProcessOrganization),
        },
        contributionBreakdown: {
          yes: Number(row.contributionYes ?? 0),
          partial: Number(row.contributionPartial ?? 0),
          no: Number(row.contributionNo ?? 0),
        },
      }));
    },

    async listAdminProjectResponses(projectId: number): Promise<AdminSurveyRecord[]> {
      const { rows } = await pool.query<SurveyRow & {
        first_name: string;
        last_name: string | null;
        username: string | null;
      }>(
        `SELECT
           s.id,
           s.user_id,
           s.project_id,
           s.survey_date,
           s.project_recommendation,
           s.project_improvement,
           s.manager_effectiveness,
           s.manager_improvement,
           s.team_comfort,
           s.team_improvement,
           s.process_organization,
           s.process_obstacles,
           s.contribution_valued,
           s.improvement_ideas,
           s.created_at,
           s.updated_at,
           p.name AS project_name,
           u.first_name,
           u.last_name,
           u.username
         FROM surveys s
         JOIN projects p ON p.id = s.project_id
         JOIN users u ON u.id = s.user_id
         WHERE s.project_id = $1
         ORDER BY s.created_at DESC`,
        [projectId],
      );

      return rows.map((row) => ({
        ...mapSurveyRow(row),
        user: {
          id: Number(row.user_id),
          firstName: row.first_name,
          lastName: row.last_name,
          username: row.username,
        },
      }));
    },
  };
}
