import type { LatLon } from './primitives.js';

const R_TIERRA_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Distancia geodésica (gran círculo) en km entre dos coordenadas. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
