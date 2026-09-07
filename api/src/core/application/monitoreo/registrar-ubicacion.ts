import {
  haversineKm,
  latLonSchema,
  type JwtClaims,
  type RegistrarUbicacionRequest,
  type RegistrarUbicacionResponse,
  type UbicacionFlete,
} from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../domain/errors.js';
import { cambiarEstadoFlete } from './cambiar-estado-flete.js';

const EN_CURSO = new Set(['ASIGNADO', 'EN_CAMINO_ORIGEN', 'CARGANDO', 'EN_RUTA']);

const SISTEMA: JwtClaims = {
  sub: 'sistema',
  email: 'sistema@agroflete.local',
  role: 'admin',
  name: 'Seguimiento automático',
};

export async function registrarUbicacion(
  ctx: AppContext,
  user: JwtClaims,
  fleteId: string,
  input: RegistrarUbicacionRequest,
): Promise<RegistrarUbicacionResponse> {
  const flete = await ctx.repos.fletes.porId(fleteId);
  if (!flete) throw new NotFoundError('Flete no encontrado');

  const esDueno = user.role === 'transportista' && flete.transportistaId === user.sub;
  if (!esDueno && user.role !== 'admin') {
    throw new ForbiddenError('No puedes reportar ubicación en este flete');
  }
  if (!EN_CURSO.has(flete.estado)) {
    throw new ConflictError(`El flete no está en curso (${flete.estado})`);
  }

  const coord = latLonSchema.safeParse({ lat: input.lat, lon: input.lon });
  if (!coord.success) {
    throw new ValidationError('Coordenadas fuera de rango', { issues: coord.error.issues });
  }

  const punto: UbicacionFlete = {
    lat: coord.data.lat,
    lon: coord.data.lon,
    ts: ctx.clock.nowIso(),
    ...(input.velocidad !== undefined ? { velocidad: input.velocidad } : {}),
  };

  await ctx.repos.fletes.agregarTrack(fleteId, punto);
  await ctx.repos.fletes.actualizar(fleteId, { ultimaUbicacion: punto });

  let entregaDetectada = false;
  if (flete.estado === 'EN_RUTA' && flete.destino) {
    const metros = haversineKm(punto, flete.destino) * 1000;
    if (metros <= ctx.config.geocercaAcopioM) {
      await cambiarEstadoFlete(ctx, SISTEMA, fleteId, 'ENTREGADO');
      entregaDetectada = true;
    }
  }

  return { punto, entregaDetectada };
}

export async function consultarRuta(
  ctx: AppContext,
  user: JwtClaims,
  fleteId: string,
): Promise<UbicacionFlete[]> {
  const flete = await ctx.repos.fletes.porId(fleteId);
  if (!flete) throw new NotFoundError('Flete no encontrado');
  const permitido =
    user.role === 'admin' ||
    (user.role === 'transportista' && flete.transportistaId === user.sub) ||
    (user.role === 'productor' && flete.productorId === user.sub);
  if (!permitido) throw new ForbiddenError('No puedes ver este flete');
  return ctx.repos.fletes.ruta(fleteId);
}
