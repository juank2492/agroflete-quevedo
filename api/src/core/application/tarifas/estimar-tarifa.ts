import type { EstimacionTarifaRequest, EstimacionTarifaResponse } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { NotFoundError, ValidationError } from '../../domain/errors.js';
import { calcularTarifa, cultivoDeReglas } from '../../domain/tarifa.js';

export async function estimarTarifa(
  ctx: AppContext,
  input: EstimacionTarifaRequest,
): Promise<EstimacionTarifaResponse> {
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
  const { distanciaKm, tarifa, enTemporada } = calcularTarifa({
    origen: input.origen,
    destino: { lat: acopio.lat, lon: acopio.lon },
    cultivo: input.cultivo,
    fecha: ctx.clock.now(),
    reglas,
  });

  return { distanciaKm, tarifa, enTemporada };
}
