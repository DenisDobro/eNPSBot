import { Router } from 'express';
import { z } from 'zod';
import { adminAuth } from '../middleware/adminAuth';
import { listAdminProjectResponses, listAdminProjects } from '../db';
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

router.get('/projects', (_req, res) => {
  const projects = listAdminProjects();
  res.json({ projects });
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
