import { buildContext } from '../../adapters/config/context.js';
import { env } from '../../adapters/config/env.js';
import { createApp } from './app.js';

const ctx = buildContext();
const app = createApp(ctx);

const server = app.listen(env.API_PORT, () => {
  ctx.logger.info({ port: env.API_PORT, env: env.NODE_ENV }, 'agroflete-api escuchando');
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    ctx.logger.info({ signal }, 'cerrando servidor');
    server.close(() => process.exit(0));
  });
}
