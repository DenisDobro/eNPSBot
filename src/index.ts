import { createApp } from './app';
import { config } from './config';
import { initDB } from './db';

function bootstrap(): void {
  initDB();
  const app = createApp();

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${config.port}`);
  });
}

bootstrap();
