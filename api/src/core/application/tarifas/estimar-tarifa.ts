import type { EstimacionTarifaRequest, EstimacionTarifaResponse } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { NotFoundError } from '../../domain/errors.js';
import { calcularTarifa } from '../../domain/tarifa.js';

export async function estimarTarifa(
  ctx: AppContext,
  input: EstimacionTarifaRequest,
): Promise<EstimacionTarifaResponse> {
  const acopio = await ctx.repos.acopios.porId(input.acopioId);
  if (!acopio) throw new NotFoundError('El centro de acopio no existe');

  const reglas = await ctx.repos.reglas.obtener();
  const { distanciaKm, tarifa, enTemporada } = calcularTarifa({
    origen: input.origen,
    destino: { lat: acopio.lat, lon: acopio.lon },
    cultivo: input.cultivo,
    fecha: ctx.clock.now(),
    reglas,
  });

  return { distanciaKm, tarifa, enTemporada };
}
