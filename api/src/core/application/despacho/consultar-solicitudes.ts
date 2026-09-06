import type { JwtClaims, ListarSolicitudesQuery, Solicitud } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ForbiddenError, NotFoundError } from '../../domain/errors.js';

export async function listarSolicitudes(
  ctx: AppContext,
  user: JwtClaims,
  query: ListarSolicitudesQuery,
): Promise<Solicitud[]> {
  if (user.role === 'productor') return ctx.repos.solicitudes.porProductor(user.sub);
  if (user.role === 'admin') return ctx.repos.solicitudes.porEstado(query.estado ?? 'PENDIENTE');
  throw new ForbiddenError('Los transportistas consultan sus fletes, no las solicitudes');
}

export async function obtenerSolicitud(
  ctx: AppContext,
  user: JwtClaims,
  id: string,
): Promise<Solicitud> {
  const s = await ctx.repos.solicitudes.porId(id);
  if (!s) throw new NotFoundError('Solicitud no encontrada');

  const permitido =
    user.role === 'admin' || (user.role === 'productor' && s.productorId === user.sub);
  if (!permitido) throw new ForbiddenError('No puedes ver esta solicitud');

  return s;
}
