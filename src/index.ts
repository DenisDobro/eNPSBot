import { createApp } from './app';
import { config } from './config';
import { initDatabase } from './lib/database';

function bootstrap(): void {
  initDatabase();
  const app = createApp();

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${config.port}`);
  });
}

bootstrap();
