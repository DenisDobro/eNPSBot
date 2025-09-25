import { Pool, PoolConfig } from 'pg';
import { ContributionValue, SurveyAnswers, SurveyRecord, TelegramUser } from '../types';
import {
  AdminProjectStats,
  AdminSurveyRecord,
  DatabaseAdapter,
  ProjectSummary,
  SurveyCreationResult,
} from './types';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type SurveyRow = {
  id: number;
  user_id: number;
  project_id: number;
  project_name: string;
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
};

type ProjectSummaryRow = {
  id: number | string;
  name: string;
  createdAt: string;
  responsesCount: string | number | null;
  lastResponseAt: string | null;
};

type AdminProjectRow = {
  id: number | string;
  name: string;
  createdAt: string;
  responsesCount: string | number | null;
  lastResponseAt: string | null;
  uniqueRespondents: string | number | null;
  avgProjectRecommendation: string | number | null;
  avgManagerEffectiveness: string | number | null;
  avgTeamComfort: string | number | null;
  avgProcessOrganization: string | number | null;
  contributionYes: string | number | null;
  contributionPartial: string | number | null;
  contributionNo: string | number | null;
};

type ProjectStatsRow = {
  responsesCount: string | number | null;
  lastResponseAt: string | null;
};

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

const completedSurveyColumns = [
  'project_recommendation',
  'project_improvement',
  'manager_effectiveness',
  'manager_improvement',
  'team_comfort',
  'team_improvement',
  'process_organization',
  'process_obstacles',
  'contribution_valued',
  'improvement_ideas',
] as const;

function completedSurveyCondition(alias?: string): string {
  const prefix = alias ? `${alias}.` : '';
  return completedSurveyColumns.map((column) => `${prefix}${column} IS NOT NULL`).join(' AND ');
}

function isSurveyRowComplete(row: SurveyRow): boolean {
  return completedSurveyColumns.every((column) => row[column] !== null);
}

function createPool(databaseUrl: string): Pool {
  const url = new URL(databaseUrl);
  const sslRequired = !['localhost', '127.0.0.1'].includes(url.hostname);

  const config: PoolConfig = {
    connectionString: databaseUrl,
    ssl: sslRequired ? { rejectUnauthorized: false } : false,
  };

  return new Pool(config);
}

function mapSurveyRow(row: SurveyRow): SurveyRecord {
  const createdAt = row.created_at;
  const updatedAt = row.updated_at;
  const editable = Date.now() - new Date(createdAt).getTime() <= ONE_DAY_MS;

  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
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
    createdAt,
    updatedAt,
    canEdit: editable,
    isComplete: isSurveyRowComplete(row),
  };
}

function nullableNumber(value: number | string | null): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function createPostgresAdapter(databaseUrl: string): DatabaseAdapter {
  const pool = createPool(databaseUrl);

  async function init(): Promise<void> {
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
        name TEXT NOT NULL UNIQUE,
        created_by BIGINT REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS surveys (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id),
        project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
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
        UNIQUE(user_id, project_id, survey_date)
      );

      CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
      CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
      CREATE INDEX IF NOT EXISTS idx_surveys_user_project ON surveys(user_id, project_id, survey_date);
      CREATE INDEX IF NOT EXISTS idx_surveys_project_created_at ON surveys(project_id, created_at);
    `);

    // Supabase bootstrap can leave behind redundant permissive policies that conflict with
    // the ones we rely on.  Explicitly drop the legacy insert policy so we only keep the
    // canonical "allow_surveys_access" rule created through the dashboard/migrations.
    await pool.query('DROP POLICY IF EXISTS "allow_app_access" ON public.surveys;');
  }

  async function ensureUser(user: TelegramUser): Promise<void> {
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO users (id, first_name, last_name, username, language_code, photo_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       ON CONFLICT (id) DO UPDATE
         SET first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             username = EXCLUDED.username,
             language_code = EXCLUDED.language_code,
             photo_url = EXCLUDED.photo_url,
             updated_at = EXCLUDED.updated_at`,
      [
        user.id,
        user.first_name,
        user.last_name ?? null,
        user.username ?? null,
        user.language_code ?? null,
        user.photo_url ?? null,
        now,
      ],
    );
  }

  async function listProjects(search: string | undefined, limit: number): Promise<ProjectSummary[]> {
    const params: Array<string | number> = [];
    const conditions: string[] = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(`LOWER(p.name) LIKE $${params.length}`);
    }

    params.push(limit);
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitParam = `$${params.length}`;

    const query = `
      SELECT
        p.id,
        p.name,
        p.created_at AS "createdAt",
        (
          SELECT COUNT(1)
          FROM surveys s
          WHERE s.project_id = p.id AND ${completedSurveyCondition('s')}
        ) AS "responsesCount",
        (
          SELECT MAX(s.created_at)
          FROM surveys s
          WHERE s.project_id = p.id AND ${completedSurveyCondition('s')}
        ) AS "lastResponseAt"
      FROM projects p
      ${whereClause}
      ORDER BY COALESCE((
        SELECT MAX(s.created_at)
        FROM surveys s
        WHERE s.project_id = p.id AND ${completedSurveyCondition('s')}
      ), p.created_at) DESC
      LIMIT ${limitParam}
    `;

    const { rows } = await pool.query<ProjectSummaryRow>(query, params);
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name as string,
      createdAt: row.createdAt as string,
      responsesCount: Number(row.responsesCount ?? 0),
      lastResponseAt: (row.lastResponseAt as string | null) ?? null,
    }));
  }

  async function createProject(name: string, createdBy?: number): Promise<ProjectSummary> {
    const trimmed = name.trim();
    const existing = await pool.query<ProjectSummaryRow>(
      'SELECT id, name, created_at AS "createdAt" FROM projects WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [trimmed],
    );

    if (existing.rowCount) {
      const project = existing.rows[0]!;
      const stats = await pool.query<ProjectStatsRow>(
        `SELECT
           COUNT(1) AS "responsesCount",
           MAX(created_at) AS "lastResponseAt"
         FROM surveys
         WHERE project_id = $1 AND ${completedSurveyCondition()}`,
        [project.id],
      );

      return {
        id: Number(project.id),
        name: project.name as string,
        createdAt: project.createdAt as string,
        responsesCount: Number(stats.rows[0]?.responsesCount ?? 0),
        lastResponseAt: (stats.rows[0]?.lastResponseAt as string | null) ?? null,
      };
    }

    const inserted = await pool.query<ProjectSummaryRow>(
      `INSERT INTO projects (name, created_by)
       VALUES ($1, $2)
       RETURNING id, name, created_at AS "createdAt"`,
      [trimmed, createdBy ?? null],
    );

    const project = inserted.rows[0]!;
    return {
      id: Number(project.id),
      name: project.name as string,
      createdAt: project.createdAt as string,
      responsesCount: 0,
      lastResponseAt: null,
    };
  }

  async function loadProjectSummary(id: number): Promise<ProjectSummary | undefined> {
    const { rows } = await pool.query<ProjectSummaryRow>(
      `SELECT
         p.id,
         p.name,
         p.created_at AS "createdAt",
         (
           SELECT COUNT(1) FROM surveys s WHERE s.project_id = p.id AND ${completedSurveyCondition('s')}
         ) AS "responsesCount",
         (
           SELECT MAX(created_at) FROM surveys s WHERE s.project_id = p.id AND ${completedSurveyCondition('s')}
         ) AS "lastResponseAt"
       FROM projects p
       WHERE p.id = $1`,
      [id],
    );

    const project = rows[0];
    if (!project) {
      return undefined;
    }

    return {
      id: Number(project.id),
      name: project.name as string,
      createdAt: project.createdAt as string,
      responsesCount: Number(project.responsesCount ?? 0),
      lastResponseAt: (project.lastResponseAt as string | null) ?? null,
    };
  }

  async function updateProjectName(id: number, name: string): Promise<ProjectSummary | undefined> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Название проекта не может быть пустым');
    }

    const { rowCount } = await pool.query('UPDATE projects SET name = $1 WHERE id = $2', [trimmed, id]);
    if (!rowCount) {
      return undefined;
    }

    return loadProjectSummary(id);
  }

  async function deleteProject(id: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM surveys WHERE project_id = $1', [id]);
      await client.query('DELETE FROM projects WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function deleteSurvey(id: number): Promise<void> {
    await pool.query('DELETE FROM surveys WHERE id = $1', [id]);
  }

  async function updateSurveyAnswers(id: number, updates: SurveyAnswers): Promise<SurveyRecord | undefined> {
    const assignments: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, rawValue] of Object.entries(updates) as Array<[
      keyof SurveyAnswers,
      SurveyAnswers[keyof SurveyAnswers],
    ]>) {
      const column = surveyFieldToColumn[key];
      if (!column) {
        continue;
      }

      if (rawValue === undefined) {
        continue;
      }

      if (rawValue === null) {
        assignments.push(`${column} = NULL`);
        continue;
      }

      if (typeof rawValue === 'string') {
        const trimmed = rawValue.trim();
        if (!trimmed) {
          assignments.push(`${column} = NULL`);
          continue;
        }
        assignments.push(`${column} = $${paramIndex}`);
        values.push(trimmed);
        paramIndex += 1;
        continue;
      }

      assignments.push(`${column} = $${paramIndex}`);
      values.push(rawValue);
      paramIndex += 1;
    }

    if (assignments.length) {
      assignments.push(`updated_at = $${paramIndex}`);
      values.push(new Date().toISOString());
      paramIndex += 1;
      await pool.query(`UPDATE surveys SET ${assignments.join(', ')} WHERE id = $${paramIndex}`, [...values, id]);
    }

    const { rows } = await pool.query<SurveyRow>(
      `SELECT s.*, p.name AS project_name
       FROM surveys s
       JOIN projects p ON p.id = s.project_id
       WHERE s.id = $1`,
      [id],
    );

    const row = rows[0];
    return row ? mapSurveyRow(row) : undefined;
  }

  async function getSurveyById(id: number, userId: number): Promise<SurveyRecord | undefined> {
    const { rows } = await pool.query<SurveyRow>(
      `SELECT s.*, p.name AS project_name
       FROM surveys s
       JOIN projects p ON p.id = s.project_id
       WHERE s.id = $1 AND s.user_id = $2`,
      [id, userId],
    );

    const row = rows[0];
    return row ? mapSurveyRow(row) : undefined;
  }

  async function listSurveys(userId: number, projectId?: number): Promise<SurveyRecord[]> {
    const params: Array<number> = [userId];
    let query = `
      SELECT s.*, p.name AS project_name
      FROM surveys s
      JOIN projects p ON p.id = s.project_id
      WHERE s.user_id = $1
    `;

    if (typeof projectId === 'number') {
      params.push(projectId);
      query += ` AND s.project_id = $${params.length}`;
    }

    query += ' ORDER BY s.created_at DESC';

    const { rows } = await pool.query<SurveyRow>(query, params);
    return rows.map(mapSurveyRow);
  }

  async function createSurvey(userId: number, projectId: number, surveyDate?: string): Promise<SurveyCreationResult> {
    const now = new Date();
    const date = surveyDate ?? formatDate(now);
    const timestamp = now.toISOString();

    const insert = await pool.query(
      `INSERT INTO surveys (user_id, project_id, survey_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT (user_id, project_id, survey_date) DO NOTHING`,
      [userId, projectId, date, timestamp],
    );

    const { rows } = await pool.query<SurveyRow>(
      `SELECT s.*, p.name AS project_name
       FROM surveys s
       JOIN projects p ON p.id = s.project_id
       WHERE s.user_id = $1 AND s.project_id = $2 AND s.survey_date = $3`,
      [userId, projectId, date],
    );

    const row = rows[0];
    if (!row) {
      throw new Error('Failed to load survey after creation');
    }

    const wasCreated = (insert.rowCount ?? 0) > 0;
    return { record: mapSurveyRow(row), wasCreated };
  }

  async function updateSurvey(id: number, userId: number, updates: SurveyAnswers): Promise<SurveyRecord> {
    const survey = await getSurveyById(id, userId);
    if (!survey) {
      throw new Error('Survey not found');
    }

    if (!survey.canEdit) {
      throw new Error('Survey can no longer be edited');
    }

    const assignments: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const key of Object.keys(updates) as Array<keyof SurveyAnswers>) {
      const value = updates[key];
      if (value === undefined) {
        continue;
      }

      assignments.push(`${surveyFieldToColumn[key]} = $${paramIndex}`);
      values.push(value);
      paramIndex += 1;
    }

    if (!assignments.length) {
      return survey;
    }

    assignments.push(`updated_at = $${paramIndex}`);
    values.push(new Date().toISOString());
    paramIndex += 1;
    values.push(id);
    values.push(userId);

    await pool.query(
      `UPDATE surveys
       SET ${assignments.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      values,
    );

    const updated = await getSurveyById(id, userId);
    if (!updated) {
      throw new Error('Survey not found');
    }

    return updated;
  }

  async function listAdminProjects(): Promise<AdminProjectStats[]> {
    const { rows } = await pool.query<AdminProjectRow>(
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
       LEFT JOIN surveys s ON s.project_id = p.id AND ${completedSurveyCondition('s')}
       GROUP BY p.id
       ORDER BY COALESCE(MAX(s.created_at), p.created_at) DESC`,
    );

    return rows.map((row) => {
      const average = (value: unknown): number | null => {
        if (value === null || value === undefined) {
          return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };

      return {
        id: Number(row.id),
        name: row.name as string,
        createdAt: row.createdAt as string,
        responsesCount: Number(row.responsesCount ?? 0),
        lastResponseAt: (row.lastResponseAt as string | null) ?? null,
        uniqueRespondents: Number(row.uniqueRespondents ?? 0),
        averages: {
          projectRecommendation: average(row.avgProjectRecommendation),
          managerEffectiveness: average(row.avgManagerEffectiveness),
          teamComfort: average(row.avgTeamComfort),
          processOrganization: average(row.avgProcessOrganization),
        },
        contributionBreakdown: {
          yes: Number(row.contributionYes ?? 0) as number,
          partial: Number(row.contributionPartial ?? 0) as number,
          no: Number(row.contributionNo ?? 0) as number,
        },
      };
    });
  }

  async function listAdminProjectResponses(projectId: number): Promise<AdminSurveyRecord[]> {
    const { rows } = await pool.query<SurveyRow & {
      first_name: string;
      last_name: string | null;
      username: string | null;
    }>(
      `SELECT
         s.*,
       p.name AS project_name,
       u.first_name,
       u.last_name,
       u.username
       FROM surveys s
       JOIN projects p ON p.id = s.project_id
       JOIN users u ON u.id = s.user_id
       WHERE s.project_id = $1 AND ${completedSurveyCondition('s')}
       ORDER BY s.created_at DESC`,
      [projectId],
    );

    return rows.map((row) => ({
      ...mapSurveyRow(row),
      user: {
        id: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        username: row.username,
      },
    }));
  }

  const adapter: DatabaseAdapter = {
    init,
    ensureUser,
    listProjects,
    createProject,
    updateProjectName,
    deleteProject,
    deleteSurvey,
    updateSurveyAnswers,
    getSurveyById,
    listSurveys,
    createSurvey,
    updateSurvey,
    listAdminProjects,
    listAdminProjectResponses,
  };

  return adapter;
}
