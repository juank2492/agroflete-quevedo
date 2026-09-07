import { haversineKm, type CultivoTarifa, type LatLon, type ReglasTarifa } from '@agroflete/shared';

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

export interface ResultadoTarifa {
  distanciaKm: number;
  tarifa: number;
  enTemporada: boolean;
}

/** Calcula la tarifa con las reglas vigentes y la temporada del cultivo. */
export function calcularTarifa(input: {
  origen: LatLon;
  destino: LatLon;
  cultivo: string;
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
