import { getDatabase } from '../../lib/database';
import type { ContributionValue, SurveyAnswers, SurveyRecord } from './survey.types';

const DEFAULT_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  contribution_valued: string | null;
  improvement_ideas: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMN_MAP: Record<keyof SurveyAnswers, string> = {
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

function asNullableNumber(value: number | null): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export class SurveyRepository {
  private readonly db = getDatabase();
  private readonly editWindowMs: number;
  private readonly selectByIdStatement = this.db.prepare(
    `SELECT s.*, p.name AS project_name
       FROM surveys s
       JOIN projects p ON p.id = s.project_id
      WHERE s.id = :id AND s.user_id = :userId`
  );
  private readonly listByUserStatement = this.db.prepare(
    `SELECT s.*, p.name AS project_name
       FROM surveys s
       JOIN projects p ON p.id = s.project_id
      WHERE s.user_id = :userId
      ORDER BY s.created_at DESC`
  );
  private readonly listByUserAndProjectStatement = this.db.prepare(
    `SELECT s.*, p.name AS project_name
       FROM surveys s
       JOIN projects p ON p.id = s.project_id
      WHERE s.user_id = :userId AND s.project_id = :projectId
      ORDER BY s.created_at DESC`
  );
  private readonly insertStatement = this.db.prepare(
    `INSERT OR IGNORE INTO surveys (user_id, project_id, survey_date, created_at, updated_at)
     VALUES (:userId, :projectId, :surveyDate, :createdAt, :updatedAt)`
  );
  private readonly selectByUniqueKey = this.db.prepare(
    `SELECT s.*, p.name AS project_name
       FROM surveys s
       JOIN projects p ON p.id = s.project_id
      WHERE s.user_id = :userId AND s.project_id = :projectId AND s.survey_date = :surveyDate`
  );

  constructor(editWindowMs = DEFAULT_EDIT_WINDOW_MS) {
    this.editWindowMs = editWindowMs;
  }

  private mapRow(row: SurveyRow): SurveyRecord {
    const createdAt = row.created_at;
    const updatedAt = row.updated_at;
    const canEdit = Date.now() - new Date(createdAt).getTime() <= this.editWindowMs;

    return {
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      projectName: row.project_name,
      surveyDate: row.survey_date,
      projectRecommendation: asNullableNumber(row.project_recommendation),
      projectImprovement: row.project_improvement ?? undefined,
      managerEffectiveness: asNullableNumber(row.manager_effectiveness),
      managerImprovement: row.manager_improvement ?? undefined,
      teamComfort: asNullableNumber(row.team_comfort),
      teamImprovement: row.team_improvement ?? undefined,
      processOrganization: asNullableNumber(row.process_organization),
      processObstacles: row.process_obstacles ?? undefined,
      contributionValued: (row.contribution_valued as ContributionValue | null) ?? undefined,
      improvementIdeas: row.improvement_ideas ?? undefined,
      createdAt,
      updatedAt,
      canEdit,
    };
  }

  getById(id: number, userId: number): SurveyRecord | undefined {
    const row = this.selectByIdStatement.get({ id, userId }) as SurveyRow | undefined;
    return row ? this.mapRow(row) : undefined;
  }

  listByUser(userId: number, projectId?: number): SurveyRecord[] {
    const statement =
      typeof projectId === 'number'
        ? this.listByUserAndProjectStatement
        : this.listByUserStatement;
    const params = typeof projectId === 'number' ? { userId, projectId } : { userId };
    const rows = statement.all(params) as SurveyRow[];
    return rows.map((row) => this.mapRow(row));
  }

  createOrGet(userId: number, projectId: number, surveyDate: string): { record: SurveyRecord; wasCreated: boolean } {
    const timestamp = new Date().toISOString();
    const insertResult = this.insertStatement.run({
      userId,
      projectId,
      surveyDate,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const row = this.selectByUniqueKey.get({ userId, projectId, surveyDate }) as SurveyRow | undefined;
    if (!row) {
      throw new Error('Failed to load survey after creation');
    }

    return { record: this.mapRow(row), wasCreated: insertResult.changes > 0 };
  }

  updateAnswers(id: number, userId: number, updates: SurveyAnswers): SurveyRecord {
    const columns: string[] = [];
    const payload: Record<string, unknown> = {
      id,
      userId,
      updated_at: new Date().toISOString(),
    };

    (Object.keys(updates) as Array<keyof SurveyAnswers>).forEach((key) => {
      const value = updates[key];
      if (value === undefined) {
        return;
      }

      columns.push(`${COLUMN_MAP[key]} = :${key}`);

      if (typeof value === 'number') {
        payload[key] = value;
      } else if (value === null) {
        payload[key] = null;
      } else {
        payload[key] = value;
      }
    });

    if (columns.length === 0) {
      const current = this.getById(id, userId);
      if (!current) {
        throw new Error('Survey not found');
      }
      return current;
    }

    columns.push('updated_at = :updated_at');

    const statement = this.db.prepare(
      `UPDATE surveys
          SET ${columns.join(', ')}
        WHERE id = :id AND user_id = :userId`
    );

    statement.run(payload);

    const updated = this.getById(id, userId);
    if (!updated) {
      throw new Error('Survey not found after update');
    }

    return updated;
  }
}

export const surveyRepository = new SurveyRepository();

export function getSurveyById(id: number, userId: number): SurveyRecord | undefined {
  return surveyRepository.getById(id, userId);
}

export function listSurveys(userId: number, projectId?: number): SurveyRecord[] {
  return surveyRepository.listByUser(userId, projectId);
}

export function createSurvey(userId: number, projectId: number, surveyDate: string): { record: SurveyRecord; wasCreated: boolean } {
  return surveyRepository.createOrGet(userId, projectId, surveyDate);
}

export function updateSurvey(id: number, userId: number, updates: SurveyAnswers): SurveyRecord {
  return surveyRepository.updateAnswers(id, userId, updates);
}
