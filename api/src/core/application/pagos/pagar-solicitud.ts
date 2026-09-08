import {
  pagoDe,
  tarjetaVencida,
  type ComprobanteDeposito,
  type JwtClaims,
  type PagarPasarelaRequest,
  type PagoSolicitud,
  type ResultadoPago,
  type Solicitud,
} from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors.js';

/** Estados que permiten reintentar el pago. */
const REINTENTABLE = new Set(['PENDIENTE', 'RECHAZADO']);

async function cargarPropia(
  ctx: AppContext,
  user: JwtClaims,
  solicitudId: string,
): Promise<Solicitud> {
  const s = await ctx.repos.solicitudes.porId(solicitudId);
  if (!s) throw new NotFoundError('Solicitud no encontrada');
  if (user.role !== 'productor' || s.productorId !== user.sub) {
    throw new ForbiddenError('No puedes pagar esta solicitud');
  }
  if (!REINTENTABLE.has(pagoDe(s).estado)) {
    throw new ConflictError('El pago de esta solicitud ya está en trámite o confirmado');
  }
  return s;
}

/** Pasarela simulada; decide según vencimiento y último dígito. */
export async function pagarConPasarela(
  ctx: AppContext,
  user: JwtClaims,
  solicitudId: string,
  input: PagarPasarelaRequest,
): Promise<ResultadoPago> {
  const s = await cargarPropia(ctx, user, solicitudId);
  const monto = s.tarifaEstimada;

  // Simula la decisión de la pasarela.
  const vencida = tarjetaVencida(input.expiracion, ctx.clock.now());
  const aprobado = !vencida && Number(input.numeroTarjeta.at(-1)) % 2 === 0;
  const nota = vencida ? 'La tarjeta está vencida' : 'El emisor de la tarjeta rechazó el cargo';

  const pago: PagoSolicitud = {
    estado: aprobado ? 'PAGADO' : 'RECHAZADO',
    metodo: 'PASARELA',
    monto,
    referencia: `PSL-${ctx.ids.ulid()}`,
    actualizadoEn: ctx.clock.nowIso(),
    ...(aprobado ? {} : { nota }),
  };
  await ctx.repos.solicitudes.actualizar(s.id, { pago });

  if (aprobado) {
    await ctx.events.publish('PagoAprobado', {
      solicitudId: s.id,
      productorId: s.productorId,
      monto,
      metodo: 'PASARELA',
    });
  } else {
    await ctx.events.publish('PagoRechazado', {
      solicitudId: s.id,
      productorId: s.productorId,
      metodo: 'PASARELA',
      motivo: pago.nota,
    });
  }

  return { pago, aprobado };
}

/** Registra un depósito pendiente de revisión administrativa. */
export async function registrarDeposito(
  ctx: AppContext,
  user: JwtClaims,
  solicitudId: string,
  comprobante: ComprobanteDeposito,
): Promise<ResultadoPago> {
  const s = await cargarPropia(ctx, user, solicitudId);
  const monto = s.tarifaEstimada;

  const pago: PagoSolicitud = {
    estado: 'EN_REVISION',
    metodo: 'DEPOSITO',
    monto,
    referencia: comprobante.referencia,
    actualizadoEn: ctx.clock.nowIso(),
    comprobante,
  };
  await ctx.repos.solicitudes.actualizar(s.id, { pago });

  await ctx.events.publish('PagoEnRevision', {
    solicitudId: s.id,
    productorId: s.productorId,
    monto,
  });

  return { pago, aprobado: false };
}
