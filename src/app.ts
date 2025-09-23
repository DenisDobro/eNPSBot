import express from 'express';
import cors from 'cors';
import path from 'path';
import { telegramAuth } from './middleware/auth';
import featureFlagsRouter from './features/feature-flags/featureFlags.router';
import projectsRouter from './features/projects/projects.router';
import surveysRouter from './features/surveys/surveys.router';
import { config } from './config';

export function createApp(): express.Express {
  const app = express();

  app.use(
    cors({
      origin: '*',
    }),
  );
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const apiRouter = express.Router();
  apiRouter.use(telegramAuth);
  apiRouter.use('/feature-flags', featureFlagsRouter);
  apiRouter.use('/projects', projectsRouter);
  apiRouter.use('/surveys', surveysRouter);

  app.use('/api', apiRouter);

  if (config.serveFrontend) {
    const clientDist = path.resolve(process.cwd(), 'client', 'dist');
    app.use(express.static(clientDist));

    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return app;
}
