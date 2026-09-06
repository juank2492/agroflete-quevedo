import {
  ESTADOS_FLETE,
  type Flete,
  type JwtClaims,
  type ListarFletesQuery,
} from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ForbiddenError, NotFoundError } from '../../domain/errors.js';

export async function listarFletes(
  ctx: AppContext,
  user: JwtClaims,
  query: ListarFletesQuery,
): Promise<Flete[]> {
  if (user.role === 'transportista') return ctx.repos.fletes.porTransportista(user.sub);
  if (user.role === 'productor') return ctx.repos.fletes.porProductor(user.sub);

  // admin
  if (query.estado) return ctx.repos.fletes.porEstado(query.estado);
  const todos = await Promise.all(ESTADOS_FLETE.map((e) => ctx.repos.fletes.porEstado(e)));
  return todos.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function obtenerFlete(ctx: AppContext, user: JwtClaims, id: string): Promise<Flete> {
  const f = await ctx.repos.fletes.porId(id);
  if (!f) throw new NotFoundError('Flete no encontrado');

  const permitido =
    user.role === 'admin' ||
    (user.role === 'transportista' && f.transportistaId === user.sub) ||
    (user.role === 'productor' && f.productorId === user.sub);
  if (!permitido) throw new ForbiddenError('No puedes ver este flete');

  return f;
}
