import { Pool, PoolClient } from 'pg';
import { config } from './config';
import {
  ContributionValue,
  SurveyAnswers,
  SurveyRecord,
  TelegramUser,
} from './types';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let pool: Pool | null = null;
let externalPool = false;

function ensurePool(): Pool {
  if (pool) {
    return pool;
  }

  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not configured');
  }

  pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes('sslmode=disable')
      ? undefined
      : { rejectUnauthorized: false },
  });

  pool.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error('Postgres pool error', error);
  });

  return pool;
}

export function setDbPool(customPool: Pool): void {
  if (pool && !externalPool) {
    void pool.end();
  }

  pool = customPool;
  externalPool = true;
}

export async function closeDbPool(): Promise<void> {
  if (pool && !externalPool) {
    await pool.end();
  }

  pool = null;
  externalPool = false;
}

async function withClient<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const db = ensurePool();
  const client = await db.connect();

  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

function toIsoString(value: string | Date | null | undefined): string {
  if (!value) {
    throw new Error('Unexpected null date value');
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

function toDateOnly(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function nullableNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCount(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseAverage(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

interface SurveyRow {
  id: number | string;
  user_id: number | string;
  project_id: number | string;
  project_name: string;
  survey_date: string | Date;
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
  created_at: string | Date;
  updated_at: string | Date;
}

export interface ProjectSummary {
  id: number;
  name: string;
  createdAt: string;
  responsesCount: number;
  lastResponseAt: string | null;
}

export interface AdminProjectStats extends ProjectSummary {
  uniqueRespondents: number;
  averages: {
    projectRecommendation: number | null;
    managerEffectiveness: number | null;
    teamComfort: number | null;
    processOrganization: number | null;
  };
  contributionBreakdown: Record<ContributionValue, number>;
}

export interface AdminSurveyRecord extends SurveyRecord {
  user: {
    id: number;
    firstName: string;
    lastName: string | null;
    username: string | null;
  };
}

function mapSurveyRow(row: SurveyRow): SurveyRecord {
  const createdAtIso = toIsoString(row.created_at);
  const updatedAtIso = toIsoString(row.updated_at);
  const canEdit = Date.now() - new Date(createdAtIso).getTime() <= ONE_DAY_MS;

  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    projectId: Number(row.project_id),
    projectName: row.project_name,
    surveyDate: toDateOnly(row.survey_date),
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
    createdAt: createdAtIso,
    updatedAt: updatedAtIso,
    canEdit,
  };
}

async function fetchSurveyRowById(id: number, client?: PoolClient): Promise<SurveyRow | undefined> {
  const executor = client ?? ensurePool();
  const { rows } = await executor.query<SurveyRow>(
    `SELECT
       s.id,
       s.user_id,
       s.project_id,
       p.name AS project_name,
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
       s.updated_at
     FROM surveys s
     JOIN projects p ON p.id = s.project_id
     WHERE s.id = $1`,
    [id],
  );

  return rows[0];
}

async function fetchProjectSummary(id: number, client?: PoolClient): Promise<ProjectSummary | undefined> {
  const executor = client ?? ensurePool();
  const { rows } = await executor.query(
    `SELECT
       p.id,
       p.name,
       p.created_at,
       COUNT(s.id) AS responses_count,
       MAX(s.created_at) AS last_response_at
     FROM projects p
     LEFT JOIN surveys s ON s.project_id = p.id
     WHERE p.id = $1
     GROUP BY p.id`,
    [id],
  );

  const row = rows[0];
  if (!row) {
    return undefined;
  }

  return {
    id: Number(row.id),
    name: row.name,
    createdAt: toIsoString(row.created_at as string | Date),
    responsesCount: parseCount(row.responses_count),
    lastResponseAt: row.last_response_at ? toIsoString(row.last_response_at as string | Date) : null,
  };
}

export async function initDB(): Promise<void> {
  const db = ensurePool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT,
      username TEXT,
      language_code TEXT,
      photo_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_by BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS surveys (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      survey_date DATE NOT NULL,
      project_recommendation SMALLINT,
      project_improvement TEXT,
      manager_effectiveness SMALLINT,
      manager_improvement TEXT,
      team_comfort SMALLINT,
      team_improvement TEXT,
      process_organization SMALLINT,
      process_obstacles TEXT,
      contribution_valued TEXT CHECK (contribution_valued IN ('yes', 'partial', 'no')),
      improvement_ideas TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, project_id, survey_date)
    )
  `);

  await db.query('CREATE INDEX IF NOT EXISTS idx_projects_name ON projects (LOWER(name))');
  await db.query('CREATE INDEX IF NOT EXISTS idx_surveys_user_project ON surveys (user_id, project_id, survey_date)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_surveys_project_created_at ON surveys (project_id, created_at DESC)');

  await db.query('ALTER TABLE surveys ENABLE ROW LEVEL SECURITY');
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'surveys' AND policyname = 'allow_app_access'
      ) THEN
        CREATE POLICY allow_app_access ON surveys
          FOR ALL
          USING (true)
          WITH CHECK (true);
      END IF;
    END;
    $$;
  `);
}

export async function ensureUser(user: TelegramUser): Promise<void> {
  const db = ensurePool();

  await db.query(
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
}

export async function listProjects(search: string | undefined, limit: number): Promise<ProjectSummary[]> {
  const db = ensurePool();
  const params: unknown[] = [];
  let index = 1;
  let whereClause = '';

  if (search) {
    whereClause = `WHERE LOWER(p.name) LIKE $${index}`;
    params.push(`%${search.toLowerCase()}%`);
    index += 1;
  }

  params.push(limit);

  const { rows } = await db.query(
    `SELECT
       p.id,
       p.name,
       p.created_at,
       COUNT(s.id) AS responses_count,
       MAX(s.created_at) AS last_response_at
     FROM projects p
     LEFT JOIN surveys s ON s.project_id = p.id
     ${whereClause}
     GROUP BY p.id
     ORDER BY COALESCE(MAX(s.created_at), p.created_at) DESC
     LIMIT $${index}`,
    params,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    createdAt: toIsoString(row.created_at as string | Date),
    responsesCount: parseCount(row.responses_count),
    lastResponseAt: row.last_response_at ? toIsoString(row.last_response_at as string | Date) : null,
  }));
}

export async function createProject(name: string, userId?: number | null): Promise<ProjectSummary> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Project name cannot be empty');
  }

  return withClient(async (client) => {
    const existing = await client.query<{ id: number }>(
      'SELECT id FROM projects WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [trimmed],
    );

    if (existing.rowCount && existing.rows[0]) {
      const summary = await fetchProjectSummary(existing.rows[0].id, client);
      if (!summary) {
        throw new Error('Failed to load existing project');
      }
      return summary;
    }

    const inserted = await client.query<{ id: number }>(
      'INSERT INTO projects (name, created_by) VALUES ($1, $2) RETURNING id',
      [trimmed, userId ?? null],
    );

    const insertedRow = inserted.rows[0];
    if (!insertedRow) {
      throw new Error('Failed to create project');
    }

    const projectId = insertedRow.id;
    const summary = await fetchProjectSummary(projectId, client);
    if (!summary) {
      throw new Error('Failed to load project after creation');
    }
    return summary;
  });
}

export async function updateProjectName(id: number, name: string): Promise<ProjectSummary | undefined> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Project name cannot be empty');
  }

  return withClient(async (client) => {
    const { rowCount } = await client.query('UPDATE projects SET name = $1 WHERE id = $2', [trimmed, id]);
    if (rowCount === 0) {
      return undefined;
    }

    return fetchProjectSummary(id, client);
  });
}

export async function deleteProject(id: number): Promise<void> {
  const db = ensurePool();
  await db.query('DELETE FROM projects WHERE id = $1', [id]);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface SurveyCreationResult {
  record: SurveyRecord;
  wasCreated: boolean;
}

export async function createSurvey(userId: number, projectId: number, surveyDate?: string): Promise<SurveyCreationResult> {
  const now = new Date();
  const date = surveyDate ?? formatDate(now);

  return withClient(async (client) => {
    const insertResult = await client.query(
      `INSERT INTO surveys (user_id, project_id, survey_date)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, project_id, survey_date) DO NOTHING
       RETURNING id`,
      [userId, projectId, date],
    );

    const recordRow = await client.query<SurveyRow>(
      `SELECT
         s.id,
         s.user_id,
         s.project_id,
         p.name AS project_name,
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
         s.updated_at
       FROM surveys s
       JOIN projects p ON p.id = s.project_id
       WHERE s.user_id = $1 AND s.project_id = $2 AND s.survey_date = $3`,
      [userId, projectId, date],
    );

    const row = recordRow.rows[0];
    if (!row) {
      throw new Error('Failed to load survey after creation');
    }

    return {
      record: mapSurveyRow(row),
      wasCreated: Boolean(insertResult.rowCount && insertResult.rowCount > 0),
    };
  });
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

export async function getSurveyById(id: number, userId: number): Promise<SurveyRecord | undefined> {
  const db = ensurePool();
  const { rows } = await db.query<SurveyRow>(
    `SELECT
       s.id,
       s.user_id,
       s.project_id,
       p.name AS project_name,
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
       s.updated_at
     FROM surveys s
     JOIN projects p ON p.id = s.project_id
     WHERE s.id = $1 AND s.user_id = $2`,
    [id, userId],
  );

  const row = rows[0];
  return row ? mapSurveyRow(row) : undefined;
}

export async function listSurveys(userId: number, projectId?: number): Promise<SurveyRecord[]> {
  const db = ensurePool();
  const params: unknown[] = [userId];
  let index = 2;
  let filter = '';

  if (typeof projectId === 'number') {
    filter = ` AND s.project_id = $${index}`;
    params.push(projectId);
    index += 1;
  }

  const { rows } = await db.query<SurveyRow>(
    `SELECT
       s.id,
       s.user_id,
       s.project_id,
       p.name AS project_name,
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
       s.updated_at
     FROM surveys s
     JOIN projects p ON p.id = s.project_id
     WHERE s.user_id = $1${filter}
     ORDER BY s.created_at DESC`,
    params,
  );

  return rows.map(mapSurveyRow);
}

export async function updateSurvey(id: number, userId: number, updates: SurveyAnswers): Promise<SurveyRecord> {
  const survey = await getSurveyById(id, userId);
  if (!survey) {
    throw new Error('Survey not found');
  }

  if (!survey.canEdit) {
    throw new Error('Survey can no longer be edited');
  }

  const assignments: string[] = [];
  const values: unknown[] = [];

  (Object.keys(updates) as Array<keyof SurveyAnswers>).forEach((key) => {
    const value = updates[key];
    if (value === undefined) {
      return;
    }

    const column = surveyFieldToColumn[key];
    if (!column) {
      return;
    }

    if (value === null) {
      assignments.push(`${column} = NULL`);
      return;
    }

    assignments.push(`${column} = $${values.length + 1}`);
    values.push(value);
  });

  if (assignments.length === 0) {
    return survey;
  }

  values.push(id, userId);

  await ensurePool().query(
    `UPDATE surveys
     SET ${assignments.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length - 1} AND user_id = $${values.length}`,
    values,
  );

  const updated = await getSurveyById(id, userId);
  if (!updated) {
    throw new Error('Failed to load survey after update');
  }

  return updated;
}

export async function updateSurveyAnswers(id: number, updates: SurveyAnswers): Promise<SurveyRecord | undefined> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  (Object.entries(updates) as Array<[keyof SurveyAnswers, SurveyAnswers[keyof SurveyAnswers]]>).forEach(
    ([key, value]) => {
      const column = surveyFieldToColumn[key];
      if (!column) {
        return;
      }

      if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
        assignments.push(`${column} = NULL`);
        return;
      }

      assignments.push(`${column} = $${values.length + 1}`);
      values.push(typeof value === 'string' ? value.trim() : value);
    },
  );

  if (assignments.length > 0) {
    values.push(id);
    await ensurePool().query(
      `UPDATE surveys SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`,
      values,
    );
  }

  const row = await fetchSurveyRowById(id);
  return row ? mapSurveyRow(row) : undefined;
}

export async function deleteSurvey(id: number): Promise<void> {
  const db = ensurePool();
  await db.query('DELETE FROM surveys WHERE id = $1', [id]);
}

export async function listAdminProjects(): Promise<AdminProjectStats[]> {
  const db = ensurePool();
  const { rows } = await db.query(
    `SELECT
       p.id,
       p.name,
       p.created_at,
       COUNT(s.id) AS responses_count,
       MAX(s.created_at) AS last_response_at,
       COUNT(DISTINCT s.user_id) AS unique_respondents,
       AVG(s.project_recommendation) AS avg_project_recommendation,
       AVG(s.manager_effectiveness) AS avg_manager_effectiveness,
       AVG(s.team_comfort) AS avg_team_comfort,
       AVG(s.process_organization) AS avg_process_organization,
       SUM(CASE WHEN s.contribution_valued = 'yes' THEN 1 ELSE 0 END) AS contribution_yes,
       SUM(CASE WHEN s.contribution_valued = 'partial' THEN 1 ELSE 0 END) AS contribution_partial,
       SUM(CASE WHEN s.contribution_valued = 'no' THEN 1 ELSE 0 END) AS contribution_no
     FROM projects p
     LEFT JOIN surveys s ON s.project_id = p.id
     GROUP BY p.id
     ORDER BY COALESCE(MAX(s.created_at), p.created_at) DESC`,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    createdAt: toIsoString(row.created_at as string | Date),
    responsesCount: parseCount(row.responses_count),
    lastResponseAt: row.last_response_at ? toIsoString(row.last_response_at as string | Date) : null,
    uniqueRespondents: parseCount(row.unique_respondents),
    averages: {
      projectRecommendation: parseAverage(row.avg_project_recommendation),
      managerEffectiveness: parseAverage(row.avg_manager_effectiveness),
      teamComfort: parseAverage(row.avg_team_comfort),
      processOrganization: parseAverage(row.avg_process_organization),
    },
    contributionBreakdown: {
      yes: parseCount(row.contribution_yes) as number,
      partial: parseCount(row.contribution_partial) as number,
      no: parseCount(row.contribution_no) as number,
    },
  }));
}

export async function listAdminProjectResponses(projectId: number): Promise<AdminSurveyRecord[]> {
  const db = ensurePool();
  const { rows } = await db.query(
    `SELECT
       s.id,
       s.user_id,
       s.project_id,
       p.name AS project_name,
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
    ...mapSurveyRow(row as SurveyRow),
    user: {
      id: Number(row.user_id),
      firstName: row.first_name,
      lastName: row.last_name ?? null,
      username: row.username ?? null,
    },
  }));
}
