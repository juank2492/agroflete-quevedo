import { REGLAS_TARIFA_DEFAULT, type ReglasTarifa } from '@agroflete/shared';
import {
  calcularTarifa,
  capacidadMaximaTransportable,
  categoriaParaPeso,
  distanciaVialKm,
  enTemporadaCosecha,
  factorCultivo,
  haversineKm,
  tarifaDeDistancia,
} from './tarifa.js';

const QUEVEDO = { lat: -1.0225, lon: -79.4604 };
const GUAYAQUIL = { lat: -2.1894, lon: -79.8891 };
const reglas: ReglasTarifa = REGLAS_TARIFA_DEFAULT;
const factorMaiz = reglas.cultivos.find((c) => c.clave === 'maiz')!.factor;
const factorBanano = reglas.cultivos.find((c) => c.clave === 'banano')!.factor;

/** Costo por km efectivo para un peso: base + costo/t-km de su categoría × peso. */
function costoKm(pesoTon: number): number {
  const cat = categoriaParaPeso(pesoTon, reglas)!;
  return reglas.tarifaBaseKm + cat.costoPorTonKm * pesoTon;
}

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

describe('categoriaParaPeso', () => {
  it('elige el tipo más barato cuya capacidad alcanza', () => {
    expect(categoriaParaPeso(4, reglas)?.tipo).toBe('furgon');
    expect(categoriaParaPeso(8, reglas)?.tipo).toBe('camion');
    expect(categoriaParaPeso(20, reglas)?.tipo).toBe('plataforma');
    expect(categoriaParaPeso(30, reglas)?.tipo).toBe('camion-tolva');
  });

  it('devuelve undefined si el peso supera todas las categorías', () => {
    expect(categoriaParaPeso(capacidadMaximaTransportable(reglas) + 1, reglas)).toBeUndefined();
  });
});

describe('calcularTarifa', () => {
  const fueraTemporada = new Date('2026-08-15T00:00:00Z');
  const peso = 6;

  it('coincide con la fórmula (base/km + costo/t-km × peso) fuera de temporada', () => {
    const r = calcularTarifa({
      origen: QUEVEDO,
      destino: GUAYAQUIL,
      pesoTon: peso,
      cultivo: 'maiz',
      fecha: fueraTemporada,
      reglas,
    });
    const d = distanciaVialKm(QUEVEDO, GUAYAQUIL, reglas);
    const esperado = Math.round(costoKm(peso) * d * factorMaiz * 100) / 100;
    expect(r.enTemporada).toBe(false);
    expect(r.tarifa).toBeCloseTo(esperado, 2);
    expect(r.categoria).toBe('camion');
    expect(r.distanciaKm).toBeCloseTo(Math.round(d * 100) / 100, 2);
  });

  it('aplica el recargo de temporada', () => {
    const base = calcularTarifa({
      origen: QUEVEDO,
      destino: GUAYAQUIL,
      pesoTon: peso,
      cultivo: 'maiz',
      fecha: fueraTemporada,
      reglas,
    });
    const conRecargo = calcularTarifa({
      origen: QUEVEDO,
      destino: GUAYAQUIL,
      pesoTon: peso,
      cultivo: 'maiz',
      fecha: new Date('2026-05-15T00:00:00Z'),
      reglas,
    });
    expect(conRecargo.enTemporada).toBe(true);
    expect(conRecargo.tarifa).toBeCloseTo(base.tarifa * (1 + reglas.recargoTemporada), 2);
    expect(conRecargo.tarifa).toBeGreaterThan(base.tarifa);
  });

  it('banano cuesta más que maíz a igual distancia, peso y fecha', () => {
    const comun = {
      origen: QUEVEDO,
      destino: GUAYAQUIL,
      pesoTon: peso,
      fecha: fueraTemporada,
      reglas,
    };
    const maiz = calcularTarifa({ ...comun, cultivo: 'maiz' });
    const banano = calcularTarifa({ ...comun, cultivo: 'banano' });
    expect(banano.tarifa).toBeGreaterThan(maiz.tarifa);
  });

  it('más peso => más tarifa (y puede cambiar de categoría)', () => {
    const comun = {
      origen: QUEVEDO,
      destino: GUAYAQUIL,
      cultivo: 'maiz',
      fecha: fueraTemporada,
      reglas,
    };
    const liviano = calcularTarifa({ ...comun, pesoTon: 3 });
    const pesado = calcularTarifa({ ...comun, pesoTon: 20 });
    expect(pesado.tarifa).toBeGreaterThan(liviano.tarifa);
    expect(liviano.categoria).toBe('furgon');
    expect(pesado.categoria).toBe('plataforma');
  });

  it('más distancia => más tarifa', () => {
    const comun = { pesoTon: peso, cultivo: 'maiz', fecha: fueraTemporada, reglas };
    const cerca = calcularTarifa({ ...comun, origen: QUEVEDO, destino: { lat: -1.1, lon: -79.5 } });
    const lejos = calcularTarifa({ ...comun, origen: QUEVEDO, destino: GUAYAQUIL });
    expect(lejos.tarifa).toBeGreaterThan(cerca.tarifa);
  });

  it('redondea a 2 decimales', () => {
    const r = calcularTarifa({
      origen: QUEVEDO,
      destino: GUAYAQUIL,
      pesoTon: peso,
      cultivo: 'banano',
      fecha: new Date('2026-02-01T00:00:00Z'),
      reglas,
    });
    expect(Number.isInteger(r.tarifa * 100)).toBe(true);
    expect(Number.isInteger(r.distanciaKm * 100)).toBe(true);
  });
});

describe('tarifaDeDistancia', () => {
  const fueraTemporada = new Date('2026-08-15T00:00:00Z');

  it('con la distancia geodésica × sinuosidad da lo mismo que calcularTarifa', () => {
    const d = distanciaVialKm(QUEVEDO, GUAYAQUIL, reglas);
    const porRuta = tarifaDeDistancia({
      distanciaKm: d,
      pesoTon: 6,
      cultivo: 'maiz',
      fecha: fueraTemporada,
      reglas,
    });
    const completo = calcularTarifa({
      origen: QUEVEDO,
      destino: GUAYAQUIL,
      pesoTon: 6,
      cultivo: 'maiz',
      fecha: fueraTemporada,
      reglas,
    });
    expect(porRuta.tarifa).toBe(completo.tarifa);
  });

  it('una distancia vial mayor que la estimada sube la tarifa', () => {
    const estimada = distanciaVialKm(QUEVEDO, GUAYAQUIL, reglas);
    const conRodeo = tarifaDeDistancia({
      distanciaKm: estimada * 1.2,
      pesoTon: 6,
      cultivo: 'maiz',
      fecha: fueraTemporada,
      reglas,
    });
    const base = tarifaDeDistancia({
      distanciaKm: estimada,
      pesoTon: 6,
      cultivo: 'maiz',
      fecha: fueraTemporada,
      reglas,
    });
    expect(conRodeo.tarifa).toBeGreaterThan(base.tarifa);
  });
});
