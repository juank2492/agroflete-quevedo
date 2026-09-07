import type { LatLon, UbicacionFlete } from '@agroflete/shared';
import { estadoViaje, haceTexto } from './tracking.util';

const ORIGEN: LatLon = { lat: -1.05, lon: -79.52 };
const DESTINO: LatLon = { lat: -1.0289, lon: -79.4646 };

function punto(p: LatLon, hace_s = 0): UbicacionFlete {
  return { lat: p.lat, lon: p.lon, ts: new Date(Date.now() - hace_s * 1000).toISOString() };
}

describe('tracking.util · estadoViaje', () => {
  it('sin última ubicación: señal "sin" y métricas nulas', () => {
    const r = estadoViaje({
      rutaVial: [],
      origen: ORIGEN,
      destino: DESTINO,
      ultima: null,
      rastro: [],
    });
    expect(r.senal).toBe('sin');
    expect(r.kmRestantes).toBeNull();
    expect(r.progreso).toBeNull();
    expect(r.eta).toBeNull();
  });

  it('en el origen: progreso ~0, km restantes ≈ distancia total', () => {
    const u = punto(ORIGEN);
    const r = estadoViaje({
      rutaVial: [ORIGEN, DESTINO],
      origen: ORIGEN,
      destino: DESTINO,
      ultima: u,
      rastro: [u],
    });
    expect(r.progreso).toBeLessThan(0.05);
    expect(r.kmRestantes).toBeGreaterThan(5);
    expect(r.senal).toBe('viva');
  });

  it('a mitad de camino: progreso ~0.5', () => {
    const medio: LatLon = {
      lat: (ORIGEN.lat + DESTINO.lat) / 2,
      lon: (ORIGEN.lon + DESTINO.lon) / 2,
    };
    const u = punto(medio);
    const r = estadoViaje({
      rutaVial: [ORIGEN, DESTINO],
      origen: ORIGEN,
      destino: DESTINO,
      ultima: u,
      rastro: [punto(ORIGEN, 120), u],
    });
    expect(r.progreso).toBeGreaterThan(0.4);
    expect(r.progreso).toBeLessThan(0.6);
    expect(r.rumbo).not.toBeNull();
    expect(r.minRestantes).toBeGreaterThan(0);
  });

  it('clasifica la señal por antigüedad del último punto', () => {
    const base = { rutaVial: [ORIGEN, DESTINO], origen: ORIGEN, destino: DESTINO, rastro: [] };
    expect(estadoViaje({ ...base, ultima: punto(ORIGEN, 10) }).senal).toBe('viva');
    expect(estadoViaje({ ...base, ultima: punto(ORIGEN, 120) }).senal).toBe('debil');
    expect(estadoViaje({ ...base, ultima: punto(ORIGEN, 600) }).senal).toBe('sin');
  });

  it('usa la duración estimada para el ETA cuando está disponible', () => {
    const u = punto(ORIGEN);
    const conDur = estadoViaje({
      rutaVial: [ORIGEN, DESTINO],
      origen: ORIGEN,
      destino: DESTINO,
      ultima: u,
      rastro: [u],
      distanciaVialKm: 10,
      duracionEstimadaMin: 30,
    });
    // 10 km en 30 min => 20 km/h (más lento que el fallback de 40 km/h)
    const sinDur = estadoViaje({
      rutaVial: [ORIGEN, DESTINO],
      origen: ORIGEN,
      destino: DESTINO,
      ultima: u,
      rastro: [u],
    });
    expect(conDur.minRestantes!).toBeGreaterThan(sinDur.minRestantes!);
  });
});

describe('tracking.util · haceTexto', () => {
  it('formatea minutos y horas', () => {
    const ahora = Date.now();
    expect(haceTexto(new Date(ahora - 30_000).toISOString(), ahora)).toBe('hace un momento');
    expect(haceTexto(new Date(ahora - 5 * 60_000).toISOString(), ahora)).toBe('hace 5 min');
    expect(haceTexto(new Date(ahora - 3 * 3_600_000).toISOString(), ahora)).toBe('hace 3 h');
  });
});
