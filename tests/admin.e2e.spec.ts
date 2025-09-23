import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import type { Express } from 'express';

import type { SurveyAnswers } from '../src/types';

const adminToken = 'test-admin-token';
const debugUser = {
  id: 999_001,
  first_name: 'Test',
  last_name: 'User',
};

const debugHeaders = {
  'x-debug-user': JSON.stringify(debugUser),
};

describe('Admin project and survey management', () => {
  let app: Express;
  let tempDbPath: string;
  let projectId: number;
  let surveyId: number;

  beforeAll(async () => {
    tempDbPath = path.join(os.tmpdir(), `enps-admin-tests-${Date.now()}.sqlite`);

    process.env.ALLOW_INSECURE_INIT_DATA = 'true';
    process.env.ADMIN_TOKEN = adminToken;
    process.env.SERVE_FRONTEND = 'false';
    process.env.DATABASE_FILE = tempDbPath;

    jest.resetModules();
    const { initDB } = await import('../src/db');
    initDB();
    const { createApp } = await import('../src/app');
    app = createApp();
  });

  afterAll(() => {
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  it('creates a project as user and lists it', async () => {
    const createResponse = await request(app)
      .post('/api/projects')
      .set(debugHeaders)
      .send({ name: 'Project Alpha' })
      .expect(201);

    projectId = createResponse.body.project.id;
    expect(projectId).toBeGreaterThan(0);
    expect(createResponse.body.project.name).toBe('Project Alpha');

    const listResponse = await request(app)
      .get('/api/projects')
      .set(debugHeaders)
      .expect(200);

    expect(listResponse.body.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: projectId, name: 'Project Alpha' }),
      ]),
    );
  });

  it('creates a survey as user and fills answers', async () => {
    const createSurveyResponse = await request(app)
      .post('/api/surveys')
      .set(debugHeaders)
      .send({ projectId })
      .expect(201);

    surveyId = createSurveyResponse.body.record.id;
    expect(createSurveyResponse.body.wasCreated).toBe(true);

    await request(app)
      .patch(`/api/surveys/${surveyId}`)
      .set(debugHeaders)
      .send({ projectRecommendation: 8, managerEffectiveness: 7 })
      .expect(200);
  });

  it('renames project via admin endpoint', async () => {
    const renameResponse = await request(app)
      .patch(`/api/admin/projects/${projectId}`)
      .set('x-admin-token', adminToken)
      .send({ name: 'Project Beta' })
      .expect(200);

    expect(renameResponse.body.project.name).toBe('Project Beta');
  });

  it('retrieves project responses as admin', async () => {
    const responsesResponse = await request(app)
      .get(`/api/admin/projects/${projectId}/responses`)
      .set('x-admin-token', adminToken)
      .expect(200);

    expect(responsesResponse.body.surveys).toHaveLength(1);
    expect(responsesResponse.body.surveys[0].id).toBe(surveyId);
  });

  it('updates survey answers as admin', async () => {
    const updates: SurveyAnswers = {
      projectImprovement: 'More workshops',
      contributionValued: 'yes',
    };

    const updateResponse = await request(app)
      .patch(`/api/admin/surveys/${surveyId}`)
      .set('x-admin-token', adminToken)
      .send(updates)
      .expect(200);

    expect(updateResponse.body.survey.id).toBe(surveyId);
    expect(updateResponse.body.survey.projectImprovement).toBe('More workshops');
    expect(updateResponse.body.survey.contributionValued).toBe('yes');
  });

  it('deletes survey as admin', async () => {
    await request(app)
      .delete(`/api/admin/surveys/${surveyId}`)
      .set('x-admin-token', adminToken)
      .expect(204);

    const responsesAfterDelete = await request(app)
      .get(`/api/admin/projects/${projectId}/responses`)
      .set('x-admin-token', adminToken)
      .expect(200);

    expect(responsesAfterDelete.body.surveys).toHaveLength(0);
  });

  it('deletes project as admin', async () => {
    await request(app)
      .delete(`/api/admin/projects/${projectId}`)
      .set('x-admin-token', adminToken)
      .expect(204);

    const projectsResponse = await request(app)
      .get('/api/projects')
      .set(debugHeaders)
      .expect(200);

    expect(projectsResponse.body.projects).toHaveLength(0);
  });
});
