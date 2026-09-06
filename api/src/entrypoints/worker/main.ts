import cron from 'node-cron';
import { buildContext } from '../../adapters/config/context.js';
import { env } from '../../adapters/config/env.js';
import { detectarRetrasos } from '../../core/application/monitoreo/detectar-retrasos.js';
import { procesarOutbox } from './dispatcher.js';

const ctx = buildContext();
const cronExpr = env.CRON_DEMO ? '*/1 * * * *' : '*/15 * * * *';

ctx.logger.info(
  {
    pollMs: env.OUTBOX_POLL_MS,
    cronDemo: env.CRON_DEMO,
    cronExpr,
    umbralHoras: ctx.config.retrasoUmbralHoras,
  },
  'agroflete-worker iniciado (despachador de outbox + DetectarRetrasos)',
);

let corriendoOutbox = false;

async function tickOutbox(): Promise<void> {
  if (corriendoOutbox) return;
  corriendoOutbox = true;
  try {
    const n = await procesarOutbox(ctx);
    if (n > 0) ctx.logger.debug({ procesados: n }, 'outbox');
  } catch (err) {
    ctx.logger.error({ err: String(err) }, 'fallo al procesar outbox');
  } finally {
    corriendoOutbox = false;
  }
}

const intervalo = setInterval(() => void tickOutbox(), env.OUTBOX_POLL_MS);
void tickOutbox();

const tarea = cron.schedule(cronExpr, () => {
  detectarRetrasos(ctx)
    .then((n) => {
      if (n > 0) ctx.logger.info({ emitidos: n }, 'DetectarRetrasos');
    })
    .catch((err: unknown) => ctx.logger.error({ err: String(err) }, 'fallo en DetectarRetrasos'));
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    clearInterval(intervalo);
    tarea.stop();
    ctx.logger.info({ signal }, 'cerrando worker');
    process.exit(0);
  });
}
