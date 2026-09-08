import type { DomainEvent } from '@agroflete/shared';
import type { AppContext } from '../../core/app-context.js';
import type { OutboxRecord } from '../../core/ports/repositories.js';
import { subscribers } from './subscribers.js';

/**
 * Lee el outbox y entrega cada evento pendiente a sus suscriptores.
 * Idempotente por (evento, suscriptor) vía `procesadoPor`.
 */
export async function procesarOutbox(ctx: AppContext, lote = 20): Promise<number> {
  const pendientes = await ctx.repos.outbox.pendientes(lote);
  let procesados = 0;

  for (const rec of pendientes) {
    if (await entregar(ctx, rec)) procesados++;
  }
  return procesados;
}

export async function procesarEventoOutbox(ctx: AppContext, id: string): Promise<void> {
  const rec = await ctx.repos.outbox.porId(id);
  if (!rec || rec.estado === 'PROCESADO') return;
  if (!(await entregar(ctx, rec))) throw new Error(`No se completó el evento outbox ${id}`);
}

async function entregar(ctx: AppContext, rec: OutboxRecord): Promise<boolean> {
  const ev: DomainEvent = {
    id: rec.id,
    tipo: rec.tipo,
    payload: rec.payload as DomainEvent['payload'],
    createdAt: rec.createdAt,
  };
  let completo = true;

  for (const sub of subscribers) {
    if (!sub.tipos.includes(ev.tipo) || rec.procesadoPor.includes(sub.nombre)) continue;
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

  if (completo) await ctx.repos.outbox.marcarProcesado(rec.id);
  return completo;
}
