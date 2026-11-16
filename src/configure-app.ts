import { INestApplication } from '@nestjs/common';

/**
 * App-level setup shared by `main.ts` and the e2e tests, so both serve the
 * same routes.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
}
