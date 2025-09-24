import express from 'express';
import cors from 'cors';
import path from 'path';
import { telegramAuth } from './middleware/auth';
import projectsRouter from './routes/projects';
import surveysRouter from './routes/surveys';
import { config } from './config';
import adminRouter from './routes/admin';

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

  app.use('/api/admin', adminRouter);
  const apiRouter = express.Router();
  apiRouter.use(telegramAuth);
  apiRouter.use('/projects', projectsRouter);
  apiRouter.use('/surveys', surveysRouter);

  app.use('/api', apiRouter);

  if (config.serveFrontend) {
    const clientDist = path.resolve(process.cwd(), 'client', 'dist');
    app.use(express.static(clientDist));

    app.use((req, res, next) => {
      if (req.method !== 'GET') {
        next();
        return;
      }

      if (req.path.startsWith('/api')) {
        next();
        return;
      }

      if (req.path === '/health') {
        next();
        return;
      }

      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return app;
}
