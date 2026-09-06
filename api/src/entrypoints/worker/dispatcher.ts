import type { DomainEvent } from '@agroflete/shared';
import type { AppContext } from '../../core/app-context.js';
import { subscribers } from './subscribers.js';

/**
 * Lee el outbox y entrega cada evento pendiente a sus suscriptores.
 * Idempotente por (evento, suscriptor) vía `procesadoPor`.
 */
export async function procesarOutbox(ctx: AppContext, lote = 20): Promise<number> {
  const pendientes = await ctx.repos.outbox.pendientes(lote);
  let procesados = 0;

  for (const rec of pendientes) {
    const ev: DomainEvent = {
      id: rec.id,
      tipo: rec.tipo,
      payload: rec.payload as DomainEvent['payload'],
      createdAt: rec.createdAt,
    };
    let completo = true;

    for (const sub of subscribers) {
      if (!sub.tipos.includes(ev.tipo)) continue;
      if (rec.procesadoPor.includes(sub.nombre)) continue;
      try {
        await sub.handle(ev, ctx);
        await ctx.repos.outbox.marcarSuscriptor(rec.id, sub.nombre);
      } catch (err) {
        completo = false;
        ctx.logger.error(
          { evId: rec.id, tipo: rec.tipo, sub: sub.nombre, err: String(err) },
          'suscriptor falló; se reintentará',
        );
        await ctx.repos.outbox.registrarIntento(rec.id);
      }
    }

    if (completo) {
      await ctx.repos.outbox.marcarProcesado(rec.id);
      procesados++;
    }
  }
  return procesados;
}
