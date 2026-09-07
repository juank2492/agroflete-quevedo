import type { CrearSolicitudRequest, Solicitud } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { NotFoundError, ValidationError } from '../../domain/errors.js';
import { calcularTarifa, cultivoDeReglas } from '../../domain/tarifa.js';

export async function crearSolicitud(
  ctx: AppContext,
  productorId: string,
  input: CrearSolicitudRequest,
): Promise<Solicitud> {
  const acopio = await ctx.repos.acopios.porId(input.acopioId);
  if (!acopio) throw new NotFoundError('El centro de acopio no existe');

  const reglas = await ctx.repos.reglas.obtener();
  const cultivo = cultivoDeReglas(input.cultivo, reglas);
  if (!cultivo) {
    throw new ValidationError(`El cultivo "${input.cultivo}" no está en el catálogo`);
  }
  if (cultivo.activo === false) {
    throw new ValidationError(`El cultivo "${cultivo.nombre}" ya no está disponible`);
  }
  const { distanciaKm, tarifa } = calcularTarifa({
    origen: input.origen,
    destino: { lat: acopio.lat, lon: acopio.lon },
    cultivo: input.cultivo,
    fecha: ctx.clock.now(),
    reglas,
  });

  const solicitud: Solicitud = {
    id: ctx.ids.uuid(),
    productorId,
    origen: input.origen,
    ...(input.origenNombre ? { origenNombre: input.origenNombre } : {}),
    acopioId: acopio.id,
    acopioNombre: acopio.nombre,
    acopioLat: acopio.lat,
    acopioLon: acopio.lon,
    cultivo: input.cultivo,
    cultivoNombre: cultivo.nombre,
    pesoTon: input.pesoTon,
    zona: acopio.zona,
    distanciaKm,
    tarifaEstimada: tarifa,
    estado: 'PENDIENTE',
    createdAt: ctx.clock.nowIso(),
  };

  await ctx.repos.solicitudes.crear(solicitud);
  await ctx.events.publish('SolicitudCreada', {
    solicitudId: solicitud.id,
    productorId,
    cultivo: solicitud.cultivo,
    tarifaEstimada: solicitud.tarifaEstimada,
  });

  return solicitud;
}
