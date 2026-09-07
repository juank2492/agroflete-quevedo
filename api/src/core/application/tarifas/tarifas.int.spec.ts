import { REGLAS_TARIFA_DEFAULT } from '@agroflete/shared';
import { NotFoundError, ValidationError } from '../../domain/errors.js';
import {
  contextoDePrueba,
  crearTablaTest,
  borrarTablaTest,
  dynamoDisponible,
  type CtxDePrueba,
} from '../../../test/dynamo-it.js';
import { estimarTarifa } from './estimar-tarifa.js';
import { listarAcopios } from './listar-acopios.js';
import { listarCultivos } from './listar-cultivos.js';
import { actualizarReglasTarifa, obtenerReglasTarifa } from './reglas-tarifa.js';

const TABLA = 'AgrofleteTable-it-tarifas';

const ACOPIO = {
  id: 'acopio-centro',
  nombre: 'Centro de Acopio Quevedo Centro',
  lat: -1.0289,
  lon: -79.4646,
  zona: 'quevedo-centro' as const,
};
const FINCA = { lat: -1.15, lon: -79.55 };

describe('tarifas (integración con DynamoDB Local)', () => {
  let disponible = false;
  let h: CtxDePrueba;

  beforeAll(async () => {
    disponible = await dynamoDisponible();
    if (!disponible) return;
    await crearTablaTest(TABLA);
    h = contextoDePrueba(TABLA);
    await h.ctx.repos.acopios.guardar(ACOPIO);
  }, 30_000);

  afterAll(async () => {
    if (disponible) await borrarTablaTest(TABLA);
  });

  it('listarAcopios devuelve los acopios sembrados', async () => {
    if (!disponible) return;
    const lista = await listarAcopios(h.ctx);
    expect(lista.map((a) => a.id)).toContain('acopio-centro');
  });

  it('obtenerReglasTarifa devuelve las reglas por defecto si no hay guardadas', async () => {
    if (!disponible) return;
    const reglas = await obtenerReglasTarifa(h.ctx);
    expect(reglas.tarifaBaseKm).toBe(REGLAS_TARIFA_DEFAULT.tarifaBaseKm);
  });

  it('actualizarReglasTarifa fusiona, persiste y emite ReglasTarifaActualizadas', async () => {
    if (!disponible) return;
    const nuevas = await actualizarReglasTarifa(h.ctx, { tarifaBaseKm: 1.25 }, 'admin-1');
    expect(nuevas.tarifaBaseKm).toBe(1.25);
    expect(nuevas.cultivos.map((c) => c.clave)).toEqual(
      REGLAS_TARIFA_DEFAULT.cultivos.map((c) => c.clave),
    );

    const persistidas = await obtenerReglasTarifa(h.ctx);
    expect(persistidas.tarifaBaseKm).toBe(1.25);

    const pend = await h.ctx.repos.outbox.pendientes(20);
    expect(pend.some((e) => e.tipo === 'ReglasTarifaActualizadas')).toBe(true);
  });

  it('actualizarReglasTarifa da de alta un cultivo nuevo (arroz)', async () => {
    if (!disponible) return;
    const conArroz = await actualizarReglasTarifa(
      h.ctx,
      {
        cultivos: [
          ...REGLAS_TARIFA_DEFAULT.cultivos,
          { clave: 'arroz', nombre: 'Arroz', factor: 1.2, temporadas: [[5, 8]] },
        ],
      },
      'admin-1',
    );
    expect(conArroz.cultivos.find((c) => c.clave === 'arroz')?.factor).toBe(1.2);

    const r = await estimarTarifa(h.ctx, {
      origen: FINCA,
      acopioId: 'acopio-centro',
      cultivo: 'arroz',
    });
    expect(r.tarifa).toBeGreaterThan(0);
  });

  it('desactivar un cultivo: sale del selector y se rechaza en solicitudes, sin borrarlo', async () => {
    if (!disponible) return;
    await actualizarReglasTarifa(
      h.ctx,
      {
        cultivos: [
          { clave: 'maiz', nombre: 'Maíz', factor: 1, temporadas: [[4, 6]], activo: true },
          { clave: 'banano', nombre: 'Banano', factor: 1.15, temporadas: [[1, 3]], activo: false },
        ],
      },
      'admin-1',
    );

    const opciones = await listarCultivos(h.ctx);
    expect(opciones.map((c) => c.clave)).toEqual(['maiz']);

    const reglas = await obtenerReglasTarifa(h.ctx);
    expect(reglas.cultivos.find((c) => c.clave === 'banano')?.activo).toBe(false);

    await expect(
      estimarTarifa(h.ctx, { origen: FINCA, acopioId: 'acopio-centro', cultivo: 'banano' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('actualizarReglasTarifa rechaza valores inválidos', async () => {
    if (!disponible) return;
    await expect(
      actualizarReglasTarifa(h.ctx, { recargoTemporada: 5 }, 'admin-1'),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('estimarTarifa rechaza un cultivo que no está en el catálogo', async () => {
    if (!disponible) return;
    await expect(
      estimarTarifa(h.ctx, { origen: FINCA, acopioId: 'acopio-centro', cultivo: 'platano' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('estimarTarifa calcula sobre un acopio existente', async () => {
    if (!disponible) return;
    const r = await estimarTarifa(h.ctx, {
      origen: FINCA,
      acopioId: 'acopio-centro',
      cultivo: 'maiz',
    });
    expect(r.distanciaKm).toBeGreaterThan(0);
    expect(r.tarifa).toBeGreaterThan(0);
    expect(typeof r.enTemporada).toBe('boolean');
  });

  it('estimarTarifa con acopio inexistente lanza NotFoundError', async () => {
    if (!disponible) return;
    await expect(
      estimarTarifa(h.ctx, { origen: FINCA, acopioId: 'no-existe', cultivo: 'banano' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
