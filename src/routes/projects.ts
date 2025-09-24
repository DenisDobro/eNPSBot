import { Router } from 'express';
import { z } from 'zod';
import { createProject, listProjects } from '../storage';

const router = Router();

const createProjectSchema = z.object({
  name: z.string().min(2).max(120),
});

router.get('/', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const limitParam = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
  const limit = Number.isFinite(limitParam) && limitParam ? Math.min(Math.max(limitParam, 1), 100) : 50;
  const projects = await listProjects(search, limit);

  res.json({ projects });
});

router.post('/', async (req, res) => {
  const parseResult = createProjectSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid project payload', details: parseResult.error.flatten() });
    return;
  }

  const user = req.telegramUser;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const project = await createProject(parseResult.data.name, user.id);
    res.status(201).json({ project });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
