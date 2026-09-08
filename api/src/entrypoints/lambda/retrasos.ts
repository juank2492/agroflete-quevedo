import type { Context, ScheduledEvent } from 'aws-lambda';
import { loadProductionSecrets } from '../../adapters/config/aws-secrets.js';

export async function handler(_event: ScheduledEvent, context: Context): Promise<void> {
  context.callbackWaitsForEmptyEventLoop = false;
  await loadProductionSecrets();

  const [{ buildContext }, { detectarRetrasos }] = await Promise.all([
    import('../../adapters/config/context.js'),
    import('../../core/application/monitoreo/detectar-retrasos.js'),
  ]);
  const ctx = buildContext();
  const emitidos = await detectarRetrasos(ctx);
  ctx.logger.info({ emitidos }, 'revisión programada de retrasos completada');
}
