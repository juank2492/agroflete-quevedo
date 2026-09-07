import type { Flete, JwtClaims } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ConflictError, NotFoundError } from '../../domain/errors.js';
import { cambiarEstadoFlete } from '../monitoreo/cambiar-estado-flete.js';
import { asignarFlete } from './asignar-flete.js';

const REASIGNABLE = new Set(['ASIGNADO', 'EN_CAMINO_ORIGEN', 'CARGANDO', 'EN_RUTA']);

/** Cancela el flete actual y reasigna la solicitud a otro vehículo. */
export async function reasignarFlete(
  ctx: AppContext,
  user: JwtClaims,
  fleteId: string,
  nuevoVehiculoId: string,
): Promise<Flete> {
  const flete = await ctx.repos.fletes.porId(fleteId);
  if (!flete) throw new NotFoundError('Flete no encontrado');
  if (!REASIGNABLE.has(flete.estado)) {
    throw new ConflictError(`No se puede reasignar un flete ${flete.estado}`);
  }
  if (nuevoVehiculoId === flete.vehiculoId) {
    throw new ConflictError('El flete ya está asignado a ese vehículo');
  }

  // Pre-valida el vehículo destino antes de tocar nada.
  const solicitud = await ctx.repos.solicitudes.porId(flete.solicitudId);
  if (!solicitud) throw new NotFoundError('Solicitud del flete no encontrada');
  const nuevo = await ctx.repos.vehiculos.porId(nuevoVehiculoId);
  if (!nuevo) throw new NotFoundError('Vehículo destino no encontrado');
  if (nuevo.estado !== 'DISPONIBLE')
    throw new ConflictError('El vehículo destino no está disponible');
  if (nuevo.zona !== solicitud.zona) throw new ConflictError('El vehículo no opera en esa zona');
  if (nuevo.capacidadTon < solicitud.pesoTon) {
    throw new ConflictError('El vehículo no tiene capacidad suficiente');
  }

  await cambiarEstadoFlete(
    ctx,
    user,
    fleteId,
    'CANCELADO',
    'Reasignado por el administrador a otro vehículo',
  );
  return asignarFlete(ctx, user.sub, {
    solicitudId: flete.solicitudId,
    vehiculoId: nuevoVehiculoId,
  });
}
