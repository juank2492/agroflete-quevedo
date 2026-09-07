import { haversineKm, type LatLon } from '@agroflete/shared';
import type { RoutingPort, RutaVial } from '../../../core/ports/geo.js';

/** Usa OSRM y cae a una línea recta si el proveedor no responde. */

const FACTOR_SINUOSIDAD_FALLBACK = 1.3;
const VELOCIDAD_MEDIA_KMH = 45;
const TIMEOUT_MS = 4000;

const round = (n: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
};

function rectaDeRespaldo(origen: LatLon, destino: LatLon): RutaVial {
  const rectaKm = haversineKm(origen, destino);
  const distanciaKm = round(rectaKm * FACTOR_SINUOSIDAD_FALLBACK);
  return {
    geometria: [origen, destino],
    distanciaKm,
    duracionMin: round((distanciaKm / VELOCIDAD_MEDIA_KMH) * 60, 0),
    aproximada: true,
  };
}

export function makeOsrmRouting(opts: { baseUrl: string }): RoutingPort {
  const base = opts.baseUrl.replace(/\/$/, '');

  return {
    async calcularRuta(origen, destino) {
      const coords = `${origen.lon},${origen.lat};${destino.lon},${destino.lat}`;
      const url = `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
        const data = (await res.json()) as {
          code?: string;
          routes?: {
            distance: number;
            duration: number;
            geometry: { coordinates: [number, number][] };
          }[];
        };
        const ruta = data.routes?.[0];
        if (data.code !== 'Ok' || !ruta || !ruta.geometry?.coordinates?.length) {
          throw new Error('OSRM sin ruta');
        }
        return {
          geometria: ruta.geometry.coordinates.map(([lon, lat]) => ({ lat, lon })),
          distanciaKm: round(ruta.distance / 1000),
          duracionMin: round(ruta.duration / 60, 0),
          aproximada: false,
        };
      } catch {
        return rectaDeRespaldo(origen, destino);
      }
    },
  };
}
