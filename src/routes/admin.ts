import { Router } from 'express';
import { z } from 'zod';
import { adminAuth } from '../middleware/adminAuth';
import {
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

router.get('/projects', async (_req, res) => {
  try {
    const projects = await listAdminProjects();
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

const idSchema = z.number().int().positive();
const projectNameSchema = z.object({
  name: z.string().min(2).max(120),
});

router.patch('/projects/:id', async (req, res) => {
  const idResult = idSchema.safeParse(Number(req.params.id));
  if (!idResult.success) {
    res.status(400).json({ error: 'Invalid project id' });
    return;
  }

  const payloadResult = projectNameSchema.safeParse(req.body);
  if (!payloadResult.success) {
    res.status(400).json({ error: 'Invalid project payload', details: payloadResult.error.flatten() });
    return;
  }

  try {
    const project = await updateProjectName(idResult.data, payloadResult.data.name);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ project });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
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

router.get('/projects/:id/responses', async (req, res) => {
  const parseResult = idSchema.safeParse(Number(req.params.id));
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid project id' });
    return;
  }

  try {
    const surveys = await listAdminProjectResponses(parseResult.data);
    res.json({ surveys });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

const ratingField = z.number().int().min(0).max(10);
const textField = z.string().max(4000).optional();

const surveyUpdateSchema = z.object({
  projectRecommendation: ratingField.optional(),
  projectImprovement: textField,
  managerEffectiveness: ratingField.optional(),
  managerImprovement: textField,
  teamComfort: ratingField.optional(),
  teamImprovement: textField,
  processOrganization: ratingField.optional(),
  processObstacles: textField,
  contributionValued: z.enum(['yes', 'no', 'partial']).optional(),
  improvementIdeas: textField,
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

  try {
    const survey = await updateSurveyAnswers(idResult.data, parseResult.data);
    if (!survey) {
      res.status(404).json({ error: 'Survey not found' });
      return;
    }

    res.json({ survey });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
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

export default router;
