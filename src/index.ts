import { createApp } from './app';
import { config } from './config';
import { initDB } from './db';

async function bootstrap(): Promise<void> {
  try {
    await initDB();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      'Failed to initialise database. Check DATABASE_URL or PG* credentials. Original error:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }

  const app = createApp();

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${config.port}`);
  });
}

void bootstrap();
