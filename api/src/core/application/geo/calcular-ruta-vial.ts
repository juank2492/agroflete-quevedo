import type { LatLon, RutaVialDTO } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';

/** Calcula la ruta para fletes sin `rutaVial` guardada. */
export async function calcularRutaVial(
  ctx: AppContext,
  origen: LatLon,
  destino: LatLon,
): Promise<RutaVialDTO> {
  const r = await ctx.routing.calcularRuta(origen, destino);
  return {
    geometria: r.geometria,
    distanciaKm: r.distanciaKm,
    duracionMin: r.duracionMin,
    aproximada: r.aproximada,
  };
}
