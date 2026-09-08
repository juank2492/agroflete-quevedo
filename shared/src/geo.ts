import type { LatLon } from './primitives.js';

const R_TIERRA_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Distancia de gran círculo en km. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Calcula el rumbo inicial en grados. */
export function rumboGrados(a: LatLon, b: LatLon): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Determina si un punto está dentro de la geocerca de entrega. */
export const GEOCERCA_ACOPIO_M = 300;

/**
 * Reparte una polilínea en `pasos + 1` puntos equiespaciados por distancia real.
 * Se usa para animar el avance de un vehículo a lo largo de una ruta.
 */
export function interpolarRuta(ruta: LatLon[], pasos: number): LatLon[] {
  if (ruta.length < 2 || pasos < 1) return [...ruta];
  const acum = [0];
  for (let i = 1; i < ruta.length; i += 1) {
    acum.push(acum[i - 1]! + haversineKm(ruta[i - 1]!, ruta[i]!));
  }
  const total = acum[acum.length - 1]!;
  if (total === 0) return [...ruta];
  const salida: LatLon[] = [];
  for (let k = 0; k <= pasos; k += 1) {
    const objetivo = (total * k) / pasos;
    let i = 1;
    while (i < acum.length && acum[i]! < objetivo) i += 1;
    const a = ruta[i - 1]!;
    const b = ruta[i] ?? a;
    const seg = (acum[i] ?? acum[i - 1]!) - acum[i - 1]!;
    const t = seg > 0 ? (objetivo - acum[i - 1]!) / seg : 0;
    salida.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
  }
  return salida;
}
