import { Router } from 'express';
import { createProject as createProjectService, searchProjects } from './project.service';
import { createProjectSchema } from './project.validators';

const router = Router();

router.get('/', (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const limitParam = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
  const projects = searchProjects(search, limitParam);

  res.json({ projects });
});

router.post('/', (req, res) => {
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
    const project = createProjectService(parseResult.data.name, user.id);
    res.status(201).json({ project });
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes('disabled') ? 403 : 400;
    res.status(status).json({ error: message });
  }
});

export default router;
