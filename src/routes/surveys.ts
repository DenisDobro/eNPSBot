import { Router } from 'express';
import { z } from 'zod';
import { createSurvey, getSurveyById, listSurveys, updateSurvey } from '../db';
import { SurveyAnswers } from '../types';

const router = Router();

const createSchema = z.object({
  projectId: z.number().int().positive(),
  surveyDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const ratingField = z.number().int().min(0).max(10);
const textField = z.string().max(2000).optional();

const updateSchema = z.object({
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

router.get('/', async (req, res) => {
  const user = req.telegramUser;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const projectIdParam = typeof req.query.projectId === 'string' ? Number(req.query.projectId) : undefined;
  const projectId = Number.isFinite(projectIdParam) ? projectIdParam : undefined;

  const surveys = await listSurveys(user.id, projectId);
  res.json({ surveys });
});

router.get('/:id', async (req, res) => {
  const user = req.telegramUser;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Invalid survey id' });
    return;
  }

  const survey = await getSurveyById(id, user.id);
  if (!survey) {
    res.status(404).json({ error: 'Survey not found' });
    return;
  }

  res.json({ survey });
});

router.post('/', async (req, res) => {
  const user = req.telegramUser;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parseResult = createSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid survey payload', details: parseResult.error.flatten() });
    return;
  }

  try {
    const survey = await createSurvey(user.id, parseResult.data.projectId, parseResult.data.surveyDate);
    res.status(survey.wasCreated ? 201 : 200).json(survey);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.patch('/:id', async (req, res) => {
  const user = req.telegramUser;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Invalid survey id' });
    return;
  }

  const parseResult = updateSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid survey update payload', details: parseResult.error.flatten() });
    return;
  }

  const cleaned: SurveyAnswers = {};

  const data = parseResult.data;
  if (data.projectRecommendation !== undefined) {
    cleaned.projectRecommendation = data.projectRecommendation;
  }
  if (data.projectImprovement !== undefined) {
    cleaned.projectImprovement = data.projectImprovement.trim();
  }
  if (data.managerEffectiveness !== undefined) {
    cleaned.managerEffectiveness = data.managerEffectiveness;
  }
  if (data.managerImprovement !== undefined) {
    cleaned.managerImprovement = data.managerImprovement.trim();
  }
  if (data.teamComfort !== undefined) {
    cleaned.teamComfort = data.teamComfort;
  }
  if (data.teamImprovement !== undefined) {
    cleaned.teamImprovement = data.teamImprovement.trim();
  }
  if (data.processOrganization !== undefined) {
    cleaned.processOrganization = data.processOrganization;
  }
  if (data.processObstacles !== undefined) {
    cleaned.processObstacles = data.processObstacles.trim();
  }
  if (data.contributionValued !== undefined) {
    cleaned.contributionValued = data.contributionValued;
  }
  if (data.improvementIdeas !== undefined) {
    cleaned.improvementIdeas = data.improvementIdeas.trim();
  }

  try {
    const survey = await updateSurvey(id, user.id, cleaned);
    res.json({ survey });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
