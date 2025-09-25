import fs from 'fs';
import path from 'path';
import Database, { RunResult } from 'better-sqlite3';
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

export function createSqliteAdapter(databaseFile: string): DatabaseAdapter {
  const dbDir = path.dirname(databaseFile);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(databaseFile);
  db.pragma('journal_mode = WAL');

  function migrateSurveysSchema(): void {
    const existing = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'surveys'")
      .get() as { sql: string } | undefined;

    const existingSql = existing?.sql;
    if (!existingSql) {
      return;
    }

    const hasLegacyUniqueConstraint = /UNIQUE\s*\(\s*user_id\s*,\s*project_id\s*,\s*survey_date\s*\)/i.test(existingSql);
    if (!hasLegacyUniqueConstraint) {
      return;
    }

    const duplicates = db
      .prepare(`
        SELECT user_id, project_id, survey_date, COUNT(*) AS count
        FROM surveys
        GROUP BY user_id, project_id, survey_date
        HAVING COUNT(*) > 1
      `)
      .all() as Array<{ user_id: number; project_id: number; survey_date: string; count: number }>;

    if (duplicates.length > 0) {
      const deleted = db
        .prepare(`
          DELETE FROM surveys
          WHERE EXISTS (
            SELECT 1
            FROM surveys dup
            WHERE dup.user_id = surveys.user_id
              AND dup.project_id = surveys.project_id
              AND dup.survey_date = surveys.survey_date
              AND (
                dup.updated_at > surveys.updated_at OR
                (dup.updated_at = surveys.updated_at AND dup.created_at > surveys.created_at) OR
                (dup.updated_at = surveys.updated_at AND dup.created_at = surveys.created_at AND dup.id > surveys.id)
              )
          );
        `)
        .run();

      // eslint-disable-next-line no-console
      console.warn(
        `Removed ${deleted.changes} duplicate survey entr${deleted.changes === 1 ? 'y' : 'ies'} while migrating the schema; kept the most recently updated entry per user/project/date combination.`,
      );
    }

    const migrate = db.transaction(() => {
      db.exec('ALTER TABLE surveys RENAME TO surveys_legacy;');

      db.exec(`
        CREATE TABLE surveys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          project_id INTEGER NOT NULL,
          survey_date TEXT NOT NULL,
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
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id),
          FOREIGN KEY(project_id) REFERENCES projects(id)
        );
      `);

      db.exec(`
        INSERT INTO surveys (
          id,
          user_id,
          project_id,
          survey_date,
          project_recommendation,
          project_improvement,
          manager_effectiveness,
          manager_improvement,
          team_comfort,
          team_improvement,
          process_organization,
          process_obstacles,
          contribution_valued,
          improvement_ideas,
          created_at,
          updated_at
        )
        SELECT
          id,
          user_id,
          project_id,
          survey_date,
          project_recommendation,
          project_improvement,
          manager_effectiveness,
          manager_improvement,
          team_comfort,
          team_improvement,
          process_organization,
          process_obstacles,
          contribution_valued,
          improvement_ideas,
          created_at,
          updated_at
        FROM surveys_legacy;
      `);

      db.exec('DROP TABLE surveys_legacy;');
    });

    migrate();
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
    };
  }

  function nullableNumber(value: number | null): number | undefined {
    return typeof value === 'number' ? value : undefined;
  }

  async function init(): Promise<void> {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT,
        username TEXT,
        language_code TEXT,
        photo_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_by INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY(created_by) REFERENCES users(id)
      );
    `);

    migrateSurveysSchema();

    db.exec(`
      CREATE TABLE IF NOT EXISTS surveys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        survey_date TEXT NOT NULL,
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
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(project_id) REFERENCES projects(id),
        UNIQUE(user_id, project_id, survey_date)
      );

      CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
      CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
      CREATE INDEX IF NOT EXISTS idx_surveys_user_project ON surveys(user_id, project_id, survey_date);
      CREATE INDEX IF NOT EXISTS idx_surveys_project_created_at ON surveys(project_id, created_at);
    `);
  }

  async function ensureUser(user: TelegramUser): Promise<void> {
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(user.id);

    if (existing) {
      db.prepare(
        `UPDATE users
         SET first_name = ?,
             last_name = ?,
             username = ?,
             language_code = ?,
             photo_url = ?,
             updated_at = ?
         WHERE id = ?`,
      ).run(
        user.first_name,
        user.last_name ?? null,
        user.username ?? null,
        user.language_code ?? null,
        user.photo_url ?? null,
        now,
        user.id,
      );

      return;
    }

    db.prepare(
      `INSERT INTO users (id, first_name, last_name, username, language_code, photo_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      user.id,
      user.first_name,
      user.last_name ?? null,
      user.username ?? null,
      user.language_code ?? null,
      user.photo_url ?? null,
      now,
      now,
    );
  }

  async function listProjects(search: string | undefined, limit: number): Promise<ProjectSummary[]> {
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (search) {
      conditions.push('LOWER(p.name) LIKE ?');
      params.push(`%${search.toLowerCase()}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        p.id,
        p.name,
        p.created_at AS createdAt,
        (
          SELECT COUNT(1)
          FROM surveys s
          WHERE s.project_id = p.id
        ) AS responsesCount,
        (
          SELECT MAX(s.created_at)
          FROM surveys s
          WHERE s.project_id = p.id
        ) AS lastResponseAt
      FROM projects p
      ${whereClause}
      ORDER BY COALESCE(lastResponseAt, p.created_at) DESC
      LIMIT ?
    `;

    params.push(limit);

    const statement = db.prepare(query);
    const rows = statement.all(...(params as unknown[])) as ProjectSummary[];
    return rows;
  }

  async function createProject(name: string, createdBy?: number): Promise<ProjectSummary> {
    const existing = db
      .prepare('SELECT id, name, created_at as createdAt FROM projects WHERE LOWER(name) = LOWER(?)')
      .get(name) as { id: number; name: string; createdAt: string } | undefined;
    if (existing) {
      const responsesStats = db
        .prepare(
          `SELECT
             COUNT(1) as responsesCount,
             MAX(created_at) as lastResponseAt
           FROM surveys
           WHERE project_id = ?`,
        )
        .get(existing.id) as { responsesCount: number; lastResponseAt: string | null } | undefined;

      return {
        id: existing.id,
        name: existing.name,
        createdAt: existing.createdAt,
        responsesCount: responsesStats?.responsesCount ?? 0,
        lastResponseAt: responsesStats?.lastResponseAt ?? null,
      };
    }

    const now = new Date().toISOString();

    const result: RunResult = db
      .prepare(
        `INSERT INTO projects (name, created_by, created_at)
         VALUES (?, ?, ?)`,
      )
      .run(name.trim(), createdBy ?? null, now);

    return {
      id: Number(result.lastInsertRowid),
      name: name.trim(),
      createdAt: now,
      responsesCount: 0,
      lastResponseAt: null,
    };
  }

  async function listProjectsById(id: number): Promise<ProjectSummary> {
    return db
      .prepare(
        `SELECT
           p.id,
           p.name,
           p.created_at AS createdAt,
           (
             SELECT COUNT(1) FROM surveys s WHERE s.project_id = p.id
           ) AS responsesCount,
           (
             SELECT MAX(created_at) FROM surveys s WHERE s.project_id = p.id
           ) AS lastResponseAt
         FROM projects p
         WHERE p.id = ?`,
      )
      .get(id) as ProjectSummary;
  }

  async function updateProjectName(id: number, name: string): Promise<ProjectSummary | undefined> {
    const existing = db
      .prepare('SELECT id FROM projects WHERE id = ?')
      .get(id) as { id: number } | undefined;

    if (!existing) {
      return undefined;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Название проекта не может быть пустым');
    }

    db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(trimmed, id);

    return listProjectsById(id);
  }

  async function deleteProject(id: number): Promise<void> {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM surveys WHERE project_id = ?').run(id);
      db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    });

    transaction();
  }

  async function deleteSurvey(id: number): Promise<void> {
    db.prepare('DELETE FROM surveys WHERE id = ?').run(id);
  }

  async function updateSurveyAnswers(id: number, updates: SurveyAnswers): Promise<SurveyRecord | undefined> {
    const assignments: string[] = [];
    const values: Array<string | number | null> = [];

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

        assignments.push(`${column} = ?`);
        values.push(value as never);
      },
    );

    if (assignments.length > 0) {
      const timestamp = new Date().toISOString();
      assignments.push('updated_at = ?');
      values.push(timestamp);
      values.push(id);

      db.prepare(`UPDATE surveys SET ${assignments.join(', ')} WHERE id = ?`).run(...values);
    }

    const row = db
      .prepare(
        `SELECT s.*, p.name AS project_name
         FROM surveys s
         JOIN projects p ON p.id = s.project_id
         WHERE s.id = ?`,
      )
      .get(id) as SurveyRow | undefined;

    return row ? mapSurveyRow(row) : undefined;
  }

  async function getSurveyById(id: number, userId: number): Promise<SurveyRecord | undefined> {
    const row = db
      .prepare(
        `SELECT s.*, p.name AS project_name
         FROM surveys s
         JOIN projects p ON p.id = s.project_id
         WHERE s.id = ? AND s.user_id = ?`,
      )
      .get(id, userId) as SurveyRow | undefined;

    if (!row) {
      return undefined;
    }

    return mapSurveyRow(row);
  }

  async function listSurveys(userId: number, projectId?: number): Promise<SurveyRecord[]> {
    const params: Array<number> = [userId];
    let query = `
      SELECT s.*, p.name AS project_name
      FROM surveys s
      JOIN projects p ON p.id = s.project_id
      WHERE s.user_id = ?
    `;

    if (typeof projectId === 'number') {
      query += ' AND s.project_id = ?';
      params.push(projectId);
    }

    query += ' ORDER BY s.created_at DESC';

    const rows = db.prepare(query).all(...(params as unknown[])) as SurveyRow[];
    return rows.map(mapSurveyRow);
  }

  function formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  async function createSurvey(userId: number, projectId: number, surveyDate?: string): Promise<SurveyCreationResult> {
    const now = new Date();
    const date = surveyDate ?? formatDate(now);
    const timestamp = now.toISOString();

    const insert = db
      .prepare(
        `INSERT OR IGNORE INTO surveys (user_id, project_id, survey_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(userId, projectId, date, timestamp, timestamp);

    const row = db
      .prepare(
        `SELECT s.*, p.name AS project_name
         FROM surveys s
         JOIN projects p ON p.id = s.project_id
         WHERE s.user_id = ? AND s.project_id = ? AND s.survey_date = ?`,
      )
      .get(userId, projectId, date) as SurveyRow | undefined;

    if (!row) {
      throw new Error('Failed to load survey after creation');
    }

    return { record: mapSurveyRow(row), wasCreated: insert.changes > 0 };
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
    const values: Array<string | number | null> = [];

    (Object.keys(updates) as Array<keyof SurveyAnswers>).forEach((key) => {
      const value = updates[key];
      if (value === undefined) {
        return;
      }

      assignments.push(`${surveyFieldToColumn[key]} = ?`);

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

    const timestamp = new Date().toISOString();
    assignments.push('updated_at = ?');
    values.push(timestamp);
    values.push(id);
    values.push(userId);

    const update = db.prepare(
      `UPDATE surveys
       SET ${assignments.join(', ')}
       WHERE id = ? AND user_id = ?`,
    );

    update.run(...values);

    return (await getSurveyById(id, userId))!;
  }

  async function listAdminProjects(): Promise<AdminProjectStats[]> {
    const rows = db
      .prepare(
        `SELECT
           p.id,
           p.name,
           p.created_at AS createdAt,
           COUNT(s.id) AS responsesCount,
           MAX(s.created_at) AS lastResponseAt,
           COUNT(DISTINCT s.user_id) AS uniqueRespondents,
           AVG(s.project_recommendation) AS avgProjectRecommendation,
           AVG(s.manager_effectiveness) AS avgManagerEffectiveness,
           AVG(s.team_comfort) AS avgTeamComfort,
           AVG(s.process_organization) AS avgProcessOrganization,
           SUM(CASE WHEN s.contribution_valued = 'yes' THEN 1 ELSE 0 END) AS contributionYes,
           SUM(CASE WHEN s.contribution_valued = 'partial' THEN 1 ELSE 0 END) AS contributionPartial,
           SUM(CASE WHEN s.contribution_valued = 'no' THEN 1 ELSE 0 END) AS contributionNo
         FROM projects p
         LEFT JOIN surveys s ON s.project_id = p.id
         GROUP BY p.id
         ORDER BY COALESCE(MAX(s.created_at), p.created_at) DESC`);

    return (rows.all() as Array<Record<string, unknown>>).map((row) => {
      const responsesCount = Number(row.responsesCount ?? 0);
      const average = (value: unknown): number | null => {
        if (value === null || value === undefined) {
          return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };

      return {
        id: row.id as number,
        name: row.name as string,
        createdAt: row.createdAt as string,
        responsesCount,
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
    const rows = db
      .prepare(
        `SELECT
           s.*,
           p.name AS project_name,
           u.first_name,
           u.last_name,
           u.username
         FROM surveys s
         JOIN projects p ON p.id = s.project_id
         JOIN users u ON u.id = s.user_id
         WHERE s.project_id = ?
         ORDER BY s.created_at DESC`,
      )
      .all(projectId) as Array<SurveyRow & { first_name: string; last_name: string | null; username: string | null }>;

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

  return {
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
}
