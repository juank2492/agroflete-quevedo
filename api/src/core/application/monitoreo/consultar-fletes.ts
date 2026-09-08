import {
  ESTADOS_FLETE,
  type Flete,
  type JwtClaims,
  type ListarFletesQuery,
} from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ForbiddenError, NotFoundError } from '../../domain/errors.js';

/** Completa datos denormalizados ausentes y evita repetir lecturas por id. */
async function enriquecerFletes(ctx: AppContext, fletes: Flete[]): Promise<Flete[]> {
  const completo = (f: Flete): boolean =>
    Boolean(f.transportistaNombre && f.productorNombre && f.vehiculoPlaca);
  if (fletes.every(completo)) return fletes;

  const usuarios = new Map<string, Awaited<ReturnType<typeof ctx.repos.usuarios.porId>>>();
  const vehiculos = new Map<string, Awaited<ReturnType<typeof ctx.repos.vehiculos.porId>>>();

  const nombreDe = async (id: string): Promise<string | undefined> => {
    if (!usuarios.has(id)) usuarios.set(id, await ctx.repos.usuarios.porId(id));
    return usuarios.get(id)?.nombreCompleto;
  };
  const placaDe = async (id: string): Promise<string | undefined> => {
    if (!vehiculos.has(id)) vehiculos.set(id, await ctx.repos.vehiculos.porId(id));
    return vehiculos.get(id)?.placa;
  };

  return Promise.all(
    fletes.map(async (f) => {
      if (completo(f)) return f;
      const [transportistaNombre, productorNombre, vehiculoPlaca] = await Promise.all([
        f.transportistaNombre ?? nombreDe(f.transportistaId),
        f.productorNombre ?? nombreDe(f.productorId),
        f.vehiculoPlaca ?? placaDe(f.vehiculoId),
      ]);
      return {
        ...f,
        ...(transportistaNombre ? { transportistaNombre } : {}),
        ...(productorNombre ? { productorNombre } : {}),
        ...(vehiculoPlaca ? { vehiculoPlaca } : {}),
      };
    }),
  );
}

export async function listarFletes(
  ctx: AppContext,
  user: JwtClaims,
  query: ListarFletesQuery,
): Promise<Flete[]> {
  let fletes: Flete[];
  if (user.role === 'transportista') {
    fletes = await ctx.repos.fletes.porTransportista(user.sub);
  } else if (user.role === 'productor') {
    fletes = await ctx.repos.fletes.porProductor(user.sub);
  } else if (query.estado) {
    fletes = await ctx.repos.fletes.porEstado(query.estado);
  } else {
    const todos = await Promise.all(ESTADOS_FLETE.map((e) => ctx.repos.fletes.porEstado(e)));
    fletes = todos.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return enriquecerFletes(ctx, fletes);
}

export async function obtenerFlete(ctx: AppContext, user: JwtClaims, id: string): Promise<Flete> {
  const f = await ctx.repos.fletes.porId(id);
  if (!f) throw new NotFoundError('Flete no encontrado');

  const permitido =
    user.role === 'admin' ||
    (user.role === 'transportista' && f.transportistaId === user.sub) ||
    (user.role === 'productor' && f.productorId === user.sub);
  if (!permitido) throw new ForbiddenError('No puedes ver este flete');

  const [enriquecido] = await enriquecerFletes(ctx, [f]);
  return enriquecido ?? f;
}
