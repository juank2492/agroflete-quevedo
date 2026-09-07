import { REGLAS_TARIFA_DEFAULT, type ReglasTarifa } from '@agroflete/shared';
import {
  calcularTarifa,
  distanciaVialKm,
  enTemporadaCosecha,
  factorCultivo,
  haversineKm,
} from './tarifa.js';

const QUEVEDO = { lat: -1.0225, lon: -79.4604 };
const GUAYAQUIL = { lat: -2.1894, lon: -79.8891 };
const reglas: ReglasTarifa = REGLAS_TARIFA_DEFAULT;
const factorMaiz = reglas.cultivos.find((c) => c.clave === 'maiz')!.factor;
const factorBanano = reglas.cultivos.find((c) => c.clave === 'banano')!.factor;

describe('haversineKm', () => {
  it('es 0 para el mismo punto', () => {
    expect(haversineKm(QUEVEDO, QUEVEDO)).toBe(0);
  });

  it('Quevedo→Guayaquil ≈ 135 km (± 8)', () => {
    expect(haversineKm(QUEVEDO, GUAYAQUIL)).toBeGreaterThan(127);
    expect(haversineKm(QUEVEDO, GUAYAQUIL)).toBeLessThan(143);
  });

  it('es simétrica', () => {
    expect(haversineKm(QUEVEDO, GUAYAQUIL)).toBeCloseTo(haversineKm(GUAYAQUIL, QUEVEDO), 6);
  });

  it('crece con la separación', () => {
    const cerca = haversineKm(QUEVEDO, { lat: -1.05, lon: -79.46 });
    const lejos = haversineKm(QUEVEDO, { lat: -1.5, lon: -79.46 });
    expect(lejos).toBeGreaterThan(cerca);
  });
});

describe('distanciaVialKm', () => {
  it('es la geodésica multiplicada por el factor de sinuosidad', () => {
    const geo = haversineKm(QUEVEDO, GUAYAQUIL);
    expect(distanciaVialKm(QUEVEDO, GUAYAQUIL, reglas)).toBeCloseTo(
      geo * reglas.factorSinuosidad,
      6,
    );
  });
});

describe('factorCultivo', () => {
  it('devuelve el factor por tipo de carga', () => {
    expect(factorCultivo('maiz', reglas)).toBe(factorMaiz);
    expect(factorCultivo('banano', reglas)).toBe(factorBanano);
  });
});

describe('enTemporadaCosecha', () => {
  it('maíz: mayo (dentro de [4,6]) sí, agosto no', () => {
    expect(enTemporadaCosecha(new Date('2026-05-15T00:00:00Z'), 'maiz', reglas)).toBe(true);
    expect(enTemporadaCosecha(new Date('2026-08-15T00:00:00Z'), 'maiz', reglas)).toBe(false);
  });

  it('maíz: noviembre (dentro de [10,12]) sí', () => {
    expect(enTemporadaCosecha(new Date('2026-11-01T00:00:00Z'), 'maiz', reglas)).toBe(true);
  });

  it('banano: febrero sí, julio no', () => {
    expect(enTemporadaCosecha(new Date('2026-02-10T00:00:00Z'), 'banano', reglas)).toBe(true);
    expect(enTemporadaCosecha(new Date('2026-07-10T00:00:00Z'), 'banano', reglas)).toBe(false);
  });
});

describe('calcularTarifa', () => {
  const fueraTemporada = new Date('2026-08-15T00:00:00Z');

  it('coincide con la fórmula base fuera de temporada', () => {
    const r = calcularTarifa({
      origen: QUEVEDO,
      destino: GUAYAQUIL,
      cultivo: 'maiz',
      fecha: fueraTemporada,
      reglas,
    });
    const d = distanciaVialKm(QUEVEDO, GUAYAQUIL, reglas);
    const esperado = Math.round(reglas.tarifaBaseKm * d * factorMaiz * 100) / 100;
    expect(r.enTemporada).toBe(false);
    expect(r.tarifa).toBeCloseTo(esperado, 2);
    expect(r.distanciaKm).toBeCloseTo(Math.round(d * 100) / 100, 2);
  });

  it('aplica el recargo de temporada', () => {
    const base = calcularTarifa({
      origen: QUEVEDO,
      destino: GUAYAQUIL,
      cultivo: 'maiz',
      fecha: fueraTemporada,
      reglas,
    });
    const conRecargo = calcularTarifa({
      origen: QUEVEDO,
      destino: GUAYAQUIL,
      cultivo: 'maiz',
      fecha: new Date('2026-05-15T00:00:00Z'),
      reglas,
    });
    const d = distanciaVialKm(QUEVEDO, GUAYAQUIL, reglas);
    const esperado =
      Math.round(reglas.tarifaBaseKm * d * factorMaiz * (1 + reglas.recargoTemporada) * 100) / 100;
    expect(conRecargo.enTemporada).toBe(true);
    expect(conRecargo.tarifa).toBeCloseTo(esperado, 2);
    expect(conRecargo.tarifa).toBeGreaterThan(base.tarifa);
  });

  it('banano cuesta más que maíz a igual distancia y fecha', () => {
    const maiz = calcularTarifa({
      origen: QUEVEDO,
      destino: GUAYAQUIL,
      cultivo: 'maiz',
      fecha: fueraTemporada,
      reglas,
    });
    const banano = calcularTarifa({
      origen: QUEVEDO,
      destino: GUAYAQUIL,
      cultivo: 'banano',
      fecha: fueraTemporada,
      reglas,
    });
    expect(banano.tarifa).toBeGreaterThan(maiz.tarifa);
  });

  it('más distancia => más tarifa', () => {
    const cerca = calcularTarifa({
      origen: QUEVEDO,
      destino: { lat: -1.1, lon: -79.5 },
      cultivo: 'maiz',
      fecha: fueraTemporada,
      reglas,
    });
    const lejos = calcularTarifa({
      origen: QUEVEDO,
      destino: GUAYAQUIL,
      cultivo: 'maiz',
      fecha: fueraTemporada,
      reglas,
    });
    expect(lejos.tarifa).toBeGreaterThan(cerca.tarifa);
  });

  it('redondea a 2 decimales', () => {
    const r = calcularTarifa({
      origen: QUEVEDO,
      destino: GUAYAQUIL,
      cultivo: 'banano',
      fecha: new Date('2026-02-01T00:00:00Z'),
      reglas,
    });
    expect(Number.isInteger(r.tarifa * 100)).toBe(true);
    expect(Number.isInteger(r.distanciaKm * 100)).toBe(true);
  });
});
