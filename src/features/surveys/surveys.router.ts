import { Router } from 'express';
import { ensureSurveyForDate, listSurveys, loadSurveyById, updateSurveyAnswers } from './survey.service';
import { createSurveySchema, updateSurveySchema } from './survey.validators';
import type { SurveyAnswers } from './survey.types';

const router = Router();

router.get('/', (req, res) => {
  const user = req.telegramUser;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const projectIdParam = typeof req.query.projectId === 'string' ? Number(req.query.projectId) : undefined;
  const projectId = Number.isFinite(projectIdParam) ? projectIdParam : undefined;
  const surveys = listSurveys(user.id, projectId);
  res.json({ surveys });
});

router.get('/:id', (req, res) => {
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

  const survey = loadSurveyById(id, user.id);
  if (!survey) {
    res.status(404).json({ error: 'Survey not found' });
    return;
  }

  res.json({ survey });
});

router.post('/', (req, res) => {
  const user = req.telegramUser;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parseResult = createSurveySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid survey payload', details: parseResult.error.flatten() });
    return;
  }

  try {
    const survey = ensureSurveyForDate(user.id, parseResult.data.projectId, parseResult.data.surveyDate);
    res.status(survey.wasCreated ? 201 : 200).json(survey);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.patch('/:id', (req, res) => {
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

  const parseResult = updateSurveySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid survey update payload', details: parseResult.error.flatten() });
    return;
  }

  const cleaned: SurveyAnswers = {};
  Object.entries(parseResult.data).forEach(([rawKey, value]) => {
    if (value === undefined) {
      return;
    }

    const key = rawKey as keyof SurveyAnswers;
    (cleaned as Record<string, unknown>)[key as string] = value;
  });

  try {
    const survey = updateSurveyAnswers(id, user.id, cleaned);
    res.json({ survey });
  } catch (error) {
    const message = (error as Error).message;
    let status = 400;
    if (message.includes('not found')) {
      status = 404;
    } else if (message.includes('disabled')) {
      status = 403;
    }
    res.status(status).json({ error: message });
  }
});

export default router;
