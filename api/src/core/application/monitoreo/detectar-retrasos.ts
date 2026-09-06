import type { AppContext } from '../../app-context.js';

/**
 * Regla programada (worker, node-cron): emite `RetrasoDetectado` para las
 * solicitudes PENDIENTE que llevan más del umbral configurado sin asignar.
 * Idempotente vía `retrasoNotificado`.
 */
export async function detectarRetrasos(ctx: AppContext): Promise<number> {
  const umbralMs = ctx.config.retrasoUmbralHoras * 3_600_000;
  const corte = new Date(ctx.clock.now().getTime() - umbralMs).toISOString();
  const candidatas = await ctx.repos.solicitudes.pendientesAntesDe(corte);

  let emitidos = 0;
  for (const s of candidatas) {
    if (s.retrasoNotificado) continue;

    const horasEspera =
      Math.round(((ctx.clock.now().getTime() - new Date(s.createdAt).getTime()) / 3_600_000) * 10) /
      10;

    await ctx.repos.solicitudes.actualizar(s.id, { retrasoNotificado: true });
    await ctx.events.publish('RetrasoDetectado', {
      solicitudId: s.id,
      productorId: s.productorId,
      horasEspera,
    });
    emitidos++;
  }
  return emitidos;
}
