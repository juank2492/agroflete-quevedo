import type { LatLon, LugarGeocodificado } from '@agroflete/shared';

/** Puerto de geocodificación; el núcleo no conoce el proveedor. */
export interface GeocodingPort {
  /** Devuelve resultados ordenados por cercanía a Quevedo. */
  buscar(texto: string): Promise<LugarGeocodificado[]>;
}

export interface RutaVial {
  /** Vértices de la polilínea; primero origen y último destino. */
  geometria: LatLon[];
  distanciaKm: number;
  duracionMin: number;
  /** `true` si es una recta de respaldo porque el proveedor de rutas falló. */
  aproximada: boolean;
}

/** Puerto para calcular rutas viales. */
export interface RoutingPort {
  calcularRuta(origen: LatLon, destino: LatLon): Promise<RutaVial>;
}
