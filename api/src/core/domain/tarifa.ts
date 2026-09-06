import { haversineKm, type Cultivo, type LatLon, type ReglasTarifa } from '@agroflete/shared';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export { haversineKm };

/** Aproxima la distancia por carretera aplicando un factor de sinuosidad vial. */
export function distanciaVialKm(origen: LatLon, destino: LatLon, reglas: ReglasTarifa): number {
  return haversineKm(origen, destino) * reglas.factorSinuosidad;
}

export function factorCultivo(cultivo: Cultivo, reglas: ReglasTarifa): number {
  return cultivo === 'maiz' ? reglas.factorMaiz : reglas.factorBanano;
}

/** ¿El mes de `fecha` (UTC) cae dentro de algún rango de cosecha del cultivo? */
export function enTemporadaCosecha(fecha: Date, cultivo: Cultivo, reglas: ReglasTarifa): boolean {
  const mes = fecha.getUTCMonth() + 1;
  return reglas.temporadas[cultivo].some(([ini, fin]) => mes >= ini && mes <= fin);
}

export interface ResultadoTarifa {
  distanciaKm: number;
  tarifa: number;
  enTemporada: boolean;
}

/**
 * Tarifa = tarifaBaseKm × distanciaVial × factorCultivo × (1 + recargoTemporada?)
 * Todos los parámetros vienen de `ReglasTarifa` (configurables por el admin).
 */
export function calcularTarifa(input: {
  origen: LatLon;
  destino: LatLon;
  cultivo: Cultivo;
  fecha: Date;
  reglas: ReglasTarifa;
}): ResultadoTarifa {
  const { origen, destino, cultivo, fecha, reglas } = input;
  const d = distanciaVialKm(origen, destino, reglas);
  const enTemporada = enTemporadaCosecha(fecha, cultivo, reglas);
  const base = reglas.tarifaBaseKm * d * factorCultivo(cultivo, reglas);
  const tarifa = base * (1 + (enTemporada ? reglas.recargoTemporada : 0));
  return { distanciaKm: round2(d), tarifa: round2(tarifa), enTemporada };
}
