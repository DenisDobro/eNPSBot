import { createApp } from './app';
import { config } from './config';
import { initDB } from './db';

async function bootstrap(): Promise<void> {
  await initDB();
  const app = createApp();

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${config.port}`);
  });
}

void bootstrap();
