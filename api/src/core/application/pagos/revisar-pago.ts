import {
  pagoDe,
  type RevisarPagoRequest,
  type ResultadoPago,
  type PagoSolicitud,
  type Solicitud,
} from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ConflictError, NotFoundError } from '../../domain/errors.js';

/** Lista depósitos pendientes de revisión. */
export async function listarPagosEnRevision(ctx: AppContext): Promise<Solicitud[]> {
  const pendientes = await ctx.repos.solicitudes.porEstado('PENDIENTE');
  return pendientes
    .filter((s) => pagoDe(s).estado === 'EN_REVISION')
    .sort((a, b) => (pagoDe(a).actualizadoEn < pagoDe(b).actualizadoEn ? -1 : 1));
}

/** Aprueba o rechaza un depósito. */
export async function revisarPago(
  ctx: AppContext,
  solicitudId: string,
  input: RevisarPagoRequest,
): Promise<ResultadoPago> {
  const s = await ctx.repos.solicitudes.porId(solicitudId);
  if (!s) throw new NotFoundError('Solicitud no encontrada');

  const actual = pagoDe(s);
  if (actual.estado !== 'EN_REVISION') {
    throw new ConflictError('Este pago no está en revisión');
  }

  const pago: PagoSolicitud = {
    ...actual,
    estado: input.aprobar ? 'PAGADO' : 'RECHAZADO',
    actualizadoEn: ctx.clock.nowIso(),
    ...(input.nota ? { nota: input.nota } : {}),
  };
  await ctx.repos.solicitudes.actualizar(s.id, { pago });

  if (input.aprobar) {
    await ctx.events.publish('PagoAprobado', {
      solicitudId: s.id,
      productorId: s.productorId,
      monto: pago.monto ?? s.tarifaEstimada,
      metodo: 'DEPOSITO',
    });
  } else {
    await ctx.events.publish('PagoRechazado', {
      solicitudId: s.id,
      productorId: s.productorId,
      metodo: 'DEPOSITO',
      motivo: input.nota ?? 'El comprobante no pudo verificarse',
    });
  }

  return { pago, aprobado: input.aprobar };
}
