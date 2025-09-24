import { createApp } from './app';
import { config } from './config';
import { initStore } from './storage';

async function bootstrap(): Promise<void> {
  await initStore();
  const app = createApp();

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${config.port}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', error);
  process.exit(1);
});
