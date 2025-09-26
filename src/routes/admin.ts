import { Router } from 'express';
import { z } from 'zod';
import { adminAuth } from '../middleware/adminAuth';
import {
  createProject,
  deleteProject,
  deleteSurvey,
  listAdminProjectResponses,
  listAdminProjects,
  updateProjectName,
  updateSurveyAnswers,
} from '../db';
import { config } from '../config';

const router = Router();

router.get('/debug-token', (_req, res) => {
  if (!config.allowInsecureInitData) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  if (!config.adminToken) {
    res.status(503).json({ error: 'Admin token is not configured' });
    return;
  }

  res.json({ token: config.adminToken });
});

router.use(adminAuth);

const createProjectSchema = z.object({
  name: z.string().min(2).max(120),
});

const projectNameSchema = z.object({
  name: z.string().min(2).max(120),
});

router.get('/projects', async (_req, res) => {
  const projects = await listAdminProjects();
  res.json({ projects });
});

router.post('/projects', async (req, res) => {
  const parseResult = createProjectSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid project payload', details: parseResult.error.flatten() });
    return;
  }

  const created = await createProject(parseResult.data.name);
  const stats = (await listAdminProjects()).find((project) => project.id === created.id);

  res.status(201).json({
    project:
      stats ?? {
        ...created,
        uniqueRespondents: 0,
        averages: {
          projectRecommendation: null,
          managerEffectiveness: null,
          teamComfort: null,
          processOrganization: null,
        },
        contributionBreakdown: { yes: 0, partial: 0, no: 0 },
      },
  });
});

router.patch('/projects/:id', async (req, res) => {
  const idResult = idSchema.safeParse(Number(req.params.id));
  if (!idResult.success) {
    res.status(400).json({ error: 'Invalid project id' });
    return;
  }

  const parseResult = projectNameSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid project payload', details: parseResult.error.flatten() });
    return;
  }

  const updatedSummary = await updateProjectName(idResult.data, parseResult.data.name);
  if (!updatedSummary) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const stats = (await listAdminProjects()).find((project) => project.id === updatedSummary.id);

  res.json({
    project:
      stats ?? {
        ...updatedSummary,
        uniqueRespondents: 0,
        averages: {
          projectRecommendation: null,
          managerEffectiveness: null,
          teamComfort: null,
          processOrganization: null,
        },
        contributionBreakdown: { yes: 0, partial: 0, no: 0 },
      },
  });
});

router.delete('/projects/:id', async (req, res) => {
  const idResult = idSchema.safeParse(Number(req.params.id));
  if (!idResult.success) {
    res.status(400).json({ error: 'Invalid project id' });
    return;
  }

  await deleteProject(idResult.data);
  res.status(204).end();
});

const surveyUpdateSchema = z.object({
  projectRecommendation: z.number().int().min(0).max(10).optional(),
  managerEffectiveness: z.number().int().min(0).max(10).optional(),
  teamComfort: z.number().int().min(0).max(10).optional(),
  processOrganization: z.number().int().min(0).max(10).optional(),
  projectImprovement: z.string().max(4000).optional(),
  managerImprovement: z.string().max(4000).optional(),
  teamImprovement: z.string().max(4000).optional(),
  processObstacles: z.string().max(4000).optional(),
  contributionValued: z.enum(['yes', 'no', 'partial']).optional(),
  improvementIdeas: z.string().max(4000).optional(),
});

router.patch('/surveys/:id', async (req, res) => {
  const idResult = idSchema.safeParse(Number(req.params.id));
  if (!idResult.success) {
    res.status(400).json({ error: 'Invalid survey id' });
    return;
  }

  const parseResult = surveyUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid survey payload', details: parseResult.error.flatten() });
    return;
  }

  const updated = await updateSurveyAnswers(idResult.data, parseResult.data);
  if (!updated) {
    res.status(404).json({ error: 'Survey not found' });
    return;
  }

  res.json({ survey: updated });
});

router.delete('/surveys/:id', async (req, res) => {
  const idResult = idSchema.safeParse(Number(req.params.id));
  if (!idResult.success) {
    res.status(400).json({ error: 'Invalid survey id' });
    return;
  }

  await deleteSurvey(idResult.data);
  res.status(204).end();
});

const idSchema = z.number().int().positive();

router.get('/projects/:id/responses', async (req, res) => {
  const parseResult = idSchema.safeParse(Number(req.params.id));
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid project id' });
    return;
  }

  const surveys = await listAdminProjectResponses(parseResult.data);
  res.json({ surveys });
});

export default router;
