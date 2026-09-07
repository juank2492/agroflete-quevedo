import { haversineKm, rumboGrados, type LatLon, type UbicacionFlete } from '@agroflete/shared';

/** Velocidad de respaldo para calcular el ETA. */
const VELOCIDAD_MEDIA_KMH = 40;
const SENAL_VIVA_S = 60;
const SENAL_DEBIL_S = 240;

export interface EntradaViaje {
  /** Ruta vial; vacía significa usar la recta. */
  rutaVial: LatLon[];
  origen: LatLon | null;
  destino: LatLon | null;
  ultima: UbicacionFlete | null;
  rastro: UbicacionFlete[];
  distanciaVialKm?: number;
  duracionEstimadaMin?: number;
  /** Instante de referencia; por defecto, ahora. */
  ahora?: number;
}

export type Senal = 'viva' | 'debil' | 'sin';

export interface EstadoViaje {
  posicion: LatLon | null;
  kmRestantes: number | null;
  progreso: number | null;
  minRestantes: number | null;
  eta: Date | null;
  rumbo: number | null;
  senal: Senal;
  segundosDesdeSenal: number | null;
}

function longitudPolilinea(pts: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) total += haversineKm(pts[i - 1]!, pts[i]!);
  return total;
}

/** Parámetro t∈[0,1] de la proyección de `p` sobre el segmento `a→b` (plano local). */
function proyeccion(p: LatLon, a: LatLon, b: LatLon): number {
  const escala = Math.cos((p.lat * Math.PI) / 180) || 1;
  const ax = a.lon * escala;
  const ay = a.lat;
  const dx = b.lon * escala - ax;
  const dy = b.lat - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  const t = ((p.lon * escala - ax) * dx + (p.lat - ay) * dy) / len2;
  return Math.max(0, Math.min(1, t));
}

/**
 * Distancia (km) desde `p` hasta el final de la polilínea: proyecta `p` sobre
 * cada segmento, se queda con el más cercano y suma lo que falta desde ahí.
 */
function restanteSobreRuta(p: LatLon, ruta: LatLon[]): number {
  if (ruta.length < 2) return ruta.length === 1 ? haversineKm(p, ruta[0]!) : 0;

  const segKm: number[] = [];
  for (let i = 1; i < ruta.length; i += 1) segKm.push(haversineKm(ruta[i - 1]!, ruta[i]!));

  let mejorDist = Infinity;
  let restante = 0;
  let colaKm = 0; // longitud de los segmentos posteriores al actual
  for (let i = ruta.length - 2; i >= 0; i -= 1) {
    const a = ruta[i]!;
    const b = ruta[i + 1]!;
    const t = proyeccion(p, a, b);
    const proj: LatLon = { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
    const dist = haversineKm(p, proj);
    if (dist < mejorDist) {
      mejorDist = dist;
      restante = (1 - t) * segKm[i]! + colaKm;
    }
    colaKm += segKm[i]!;
  }
  return restante;
}

/** Calcula el rumbo usando los últimos puntos disponibles. */
function rumboActual(
  rastro: UbicacionFlete[],
  origen: LatLon | null,
  pos: LatLon | null,
): number | null {
  if (rastro.length >= 2) {
    const a = rastro[rastro.length - 2]!;
    const b = rastro[rastro.length - 1]!;
    if (a.lat !== b.lat || a.lon !== b.lon) return Math.round(rumboGrados(a, b));
  }
  if (origen && pos && (origen.lat !== pos.lat || origen.lon !== pos.lon)) {
    return Math.round(rumboGrados(origen, pos));
  }
  return null;
}

function clasificarSenal(segundos: number | null): Senal {
  if (segundos == null) return 'sin';
  if (segundos <= SENAL_VIVA_S) return 'viva';
  if (segundos <= SENAL_DEBIL_S) return 'debil';
  return 'sin';
}

export function estadoViaje(e: EntradaViaje): EstadoViaje {
  const ahora = e.ahora ?? Date.now();
  const pos: LatLon | null = e.ultima
    ? { lat: e.ultima.lat, lon: e.ultima.lon }
    : (e.rastro.at(-1) ?? null);

  const segundosDesdeSenal = e.ultima
    ? Math.max(0, Math.round((ahora - new Date(e.ultima.ts).getTime()) / 1000))
    : null;
  const senal = clasificarSenal(segundosDesdeSenal);

  const ruta: LatLon[] =
    e.rutaVial.length >= 2
      ? e.rutaVial
      : e.origen && e.destino
        ? [e.origen, e.destino]
        : e.destino
          ? [e.destino]
          : [];

  const totalKm =
    e.distanciaVialKm ??
    (ruta.length >= 2
      ? longitudPolilinea(ruta)
      : e.origen && e.destino
        ? haversineKm(e.origen, e.destino)
        : 0);

  let kmRestantes: number | null = null;
  let progreso: number | null = null;
  if (pos && e.destino) {
    kmRestantes = ruta.length >= 2 ? restanteSobreRuta(pos, ruta) : haversineKm(pos, e.destino);
    kmRestantes = Math.max(0, Math.round(kmRestantes * 10) / 10);
    if (totalKm > 0) progreso = Math.min(1, Math.max(0, 1 - kmRestantes / totalKm));
  }

  let minRestantes: number | null = null;
  let eta: Date | null = null;
  if (kmRestantes != null) {
    const kmh =
      e.duracionEstimadaMin && totalKm > 0
        ? totalKm / (e.duracionEstimadaMin / 60)
        : VELOCIDAD_MEDIA_KMH;
    minRestantes = Math.max(0, Math.round((kmRestantes / kmh) * 60));
    eta = new Date(ahora + minRestantes * 60_000);
  }

  return {
    posicion: pos,
    kmRestantes,
    progreso,
    minRestantes,
    eta,
    rumbo: rumboActual(e.rastro, e.origen, pos),
    senal,
    segundosDesdeSenal,
  };
}

export function haceTexto(iso: string, ahora = Date.now()): string {
  const min = Math.floor((ahora - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.floor(min / 60)} h`;
}
