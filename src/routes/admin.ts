import { Router } from 'express';
import { z } from 'zod';
import { adminAuth } from '../middleware/adminAuth';
import { createProject, listAdminProjectResponses, listAdminProjects } from '../db';
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

router.get('/projects', (_req, res) => {
  const projects = listAdminProjects();
  res.json({ projects });
});

router.post('/projects', (req, res) => {
  const parseResult = createProjectSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid project payload', details: parseResult.error.flatten() });
    return;
  }

  const created = createProject(parseResult.data.name);
  const stats = listAdminProjects().find((project) => project.id === created.id);

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

const idSchema = z.number().int().positive();

router.get('/projects/:id/responses', (req, res) => {
  const parseResult = idSchema.safeParse(Number(req.params.id));
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid project id' });
    return;
  }

  const surveys = listAdminProjectResponses(parseResult.data);
  res.json({ surveys });
});

export default router;
