import type { Flete } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ConflictError } from '../../domain/errors.js';
import { asignarFlete, listarVehiculosCompatibles } from './asignar-flete.js';

const SISTEMA = 'sistema';

/** Asigna la solicitud al vehículo compatible de menor capacidad disponible en su zona. */
export async function emparejarAutomatico(
  ctx: AppContext,
  solicitudId: string,
): Promise<Flete | null> {
  const solicitud = await ctx.repos.solicitudes.porId(solicitudId);
  if (!solicitud || solicitud.estado !== 'PENDIENTE') return null;

  const compatibles = await listarVehiculosCompatibles(ctx, solicitudId);
  if (compatibles.length === 0) return null;

  const elegido = [...compatibles].sort((a, b) => a.capacidadTon - b.capacidadTon)[0];
  if (!elegido) return null;

  try {
    return await asignarFlete(
      ctx,
      SISTEMA,
      { solicitudId, vehiculoId: elegido.id },
      { auto: true },
    );
  } catch (err) {
    if (err instanceof ConflictError) return null; // asignación manual concurrente
    throw err;
  }
}
