import {
  haversineKm,
  type CategoriaCarga,
  type CultivoTarifa,
  type LatLon,
  type ReglasTarifa,
  type TipoVehiculo,
} from '@agroflete/shared';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export { haversineKm };

/** Convierte distancia geodésica en una estimación vial. */
export function distanciaVialKm(origen: LatLon, destino: LatLon, reglas: ReglasTarifa): number {
  return haversineKm(origen, destino) * reglas.factorSinuosidad;
}

export function cultivoDeReglas(clave: string, reglas: ReglasTarifa): CultivoTarifa | undefined {
  return reglas.cultivos.find((c) => c.clave === clave);
}

export function factorCultivo(clave: string, reglas: ReglasTarifa): number {
  return cultivoDeReglas(clave, reglas)?.factor ?? 1;
}

export function enTemporadaCosecha(fecha: Date, clave: string, reglas: ReglasTarifa): boolean {
  const mes = fecha.getUTCMonth() + 1;
  const cultivo = cultivoDeReglas(clave, reglas);
  return !!cultivo && cultivo.temporadas.some(([ini, fin]) => mes >= ini && mes <= fin);
}

/** Categorías ordenadas por capacidad ascendente. */
function categoriasOrdenadas(reglas: ReglasTarifa): CategoriaCarga[] {
  return [...reglas.categorias].sort((a, b) => a.capacidadMaxTon - b.capacidadMaxTon);
}

/** Tonelaje máximo que puede mover el vehículo más grande. */
export function capacidadMaximaTransportable(reglas: ReglasTarifa): number {
  return Math.max(...reglas.categorias.map((c) => c.capacidadMaxTon));
}

/**
 * Categoría (tipo de vehículo) más barata cuya capacidad alcanza para `pesoTon`.
 * `undefined` si ningún tipo llega: la carga no es transportable.
 */
export function categoriaParaPeso(
  pesoTon: number,
  reglas: ReglasTarifa,
): CategoriaCarga | undefined {
  return categoriasOrdenadas(reglas).find((c) => pesoTon <= c.capacidadMaxTon);
}

export interface ResultadoTarifa {
  distanciaKm: number;
  tarifa: number;
  enTemporada: boolean;
  categoria: TipoVehiculo;
  costoPorTonKm: number;
}

/**
 * Tarifa a partir de una distancia ya conocida (km) y el peso de la carga.
 * `tarifa = (base/km + costoPorTonKm(categoría) × pesoTon) × distancia × factor_cultivo × (1 + recargo)`.
 * Si el peso supera todas las categorías, usa la más grande (el llamador debe
 * haber validado antes que la carga es transportable).
 */
export function tarifaDeDistancia(input: {
  distanciaKm: number;
  pesoTon: number;
  cultivo: string;
  fecha: Date;
  reglas: ReglasTarifa;
}): ResultadoTarifa {
  const { distanciaKm, pesoTon, cultivo, fecha, reglas } = input;
  const ordenadas = categoriasOrdenadas(reglas);
  const categoria = categoriaParaPeso(pesoTon, reglas) ?? ordenadas[ordenadas.length - 1]!;
  const enTemporada = enTemporadaCosecha(fecha, cultivo, reglas);
  const costoKm = reglas.tarifaBaseKm + categoria.costoPorTonKm * pesoTon;
  const base = costoKm * distanciaKm * factorCultivo(cultivo, reglas);
  const tarifa = base * (1 + (enTemporada ? reglas.recargoTemporada : 0));
  return {
    distanciaKm: round2(distanciaKm),
    tarifa: round2(tarifa),
    enTemporada,
    categoria: categoria.tipo,
    costoPorTonKm: categoria.costoPorTonKm,
  };
}

/**
 * Estimación de tarifa (la que ve el productor antes de confirmar): usa distancia
 * geodésica × factor de sinuosidad. La tarifa **definitiva** se recalcula al
 * asignar el flete con la distancia real por carretera (ver `asignar-flete.ts`).
 */
export function calcularTarifa(input: {
  origen: LatLon;
  destino: LatLon;
  pesoTon: number;
  cultivo: string;
  fecha: Date;
  reglas: ReglasTarifa;
}): ResultadoTarifa {
  const { origen, destino, pesoTon, cultivo, fecha, reglas } = input;
  const d = distanciaVialKm(origen, destino, reglas);
  return tarifaDeDistancia({ distanciaKm: d, pesoTon, cultivo, fecha, reglas });
}
