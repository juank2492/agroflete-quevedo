import {
  puedeTransicionarFlete,
  type EstadoFlete,
  type Flete,
  type JwtClaims,
} from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors.js';

export async function cambiarEstadoFlete(
  ctx: AppContext,
  user: JwtClaims,
  id: string,
  nuevoEstado: EstadoFlete,
): Promise<Flete> {
  const flete = await ctx.repos.fletes.porId(id);
  if (!flete) throw new NotFoundError('Flete no encontrado');

  const esDueno = user.role === 'transportista' && flete.transportistaId === user.sub;
  if (!esDueno && user.role !== 'admin') {
    throw new ForbiddenError('No puedes modificar este flete');
  }
  if (!puedeTransicionarFlete(flete.estado, nuevoEstado)) {
    throw new ConflictError(`No se puede pasar de ${flete.estado} a ${nuevoEstado}`);
  }

  const ts = ctx.clock.nowIso();
  const timeline = [...flete.timeline, { estado: nuevoEstado, ts, actorId: user.sub }];

  await ctx.repos.fletes.actualizar(
    id,
    { estado: nuevoEstado, timeline },
    { estadoActual: flete.estado },
  );

  if (nuevoEstado === 'ENTREGADO') {
    await ctx.repos.solicitudes.actualizar(flete.solicitudId, { estado: 'COMPLETADA' });
    await ctx.repos.vehiculos.actualizar(flete.vehiculoId, { estado: 'DISPONIBLE' });
    await ctx.events.publish('EntregaConfirmada', {
      fleteId: id,
      solicitudId: flete.solicitudId,
      productorId: flete.productorId,
      transportistaId: flete.transportistaId,
    });
  } else if (nuevoEstado === 'CANCELADO') {
    await ctx.repos.vehiculos.actualizar(flete.vehiculoId, { estado: 'DISPONIBLE' });
    await ctx.repos.solicitudes.actualizar(flete.solicitudId, {
      estado: 'PENDIENTE',
      fleteId: undefined,
    });
    await ctx.events.publish('EstadoFleteCambiado', {
      fleteId: id,
      solicitudId: flete.solicitudId,
      productorId: flete.productorId,
      transportistaId: flete.transportistaId,
      estado: nuevoEstado,
    });
  } else {
    await ctx.events.publish('EstadoFleteCambiado', {
      fleteId: id,
      solicitudId: flete.solicitudId,
      productorId: flete.productorId,
      transportistaId: flete.transportistaId,
      estado: nuevoEstado,
    });
  }

  return { ...flete, estado: nuevoEstado, timeline };
}
