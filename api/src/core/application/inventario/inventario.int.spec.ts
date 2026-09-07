import type { JwtClaims } from '@agroflete/shared';
import { NotFoundError, ValidationError } from '../../domain/errors.js';
import {
  borrarTablaTest,
  contextoDePrueba,
  crearTablaTest,
  dynamoDisponible,
  type CtxDePrueba,
} from '../../../test/dynamo-it.js';
import { procesarOutbox } from '../../../entrypoints/worker/dispatcher.js';
import { crearSolicitud } from '../despacho/crear-solicitud.js';
import { asignarFlete } from '../despacho/asignar-flete.js';
import { registrarVehiculo } from '../despacho/gestion-vehiculos.js';
import { cambiarEstadoFlete } from '../monitoreo/cambiar-estado-flete.js';
import { ajustarStock } from './ajustar-stock.js';
import { obtenerInventario } from './consultar-inventario.js';
import { fijarUmbrales } from './fijar-umbrales.js';

const TABLA = 'AgrofleteTable-it-inventario';
const ACOPIO = {
  id: 'acopio-centro',
  nombre: 'Centro de Acopio Quevedo Centro',
  lat: -1.0289,
  lon: -79.4646,
  zona: 'quevedo-centro' as const,
};
const FINCA = { lat: -1.05, lon: -79.47 };
const transp = (sub: string): JwtClaims => ({
  sub,
  email: `${sub}@f.ec`,
  role: 'transportista',
  name: sub,
});

describe('inventario (integración con DynamoDB Local)', () => {
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

  it('fijarUmbrales crea la fila de stock (cantidad 0) y valida acopio/cultivo', async () => {
    if (!disponible) return;
    const fila = await fijarUmbrales(h.ctx, 'acopio-centro', 'maiz', {
      umbralMinimo: 20,
      umbralMaximo: 100,
    });
    expect(fila.cantidadActual).toBe(0);
    expect(fila.umbralMaximo).toBe(100);
    expect(fila.estado).toBe('BAJO');

    await expect(
      fijarUmbrales(h.ctx, 'no-existe', 'maiz', { umbralMinimo: 0, umbralMaximo: 10 }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      fijarUmbrales(h.ctx, 'acopio-centro', 'platano', { umbralMinimo: 0, umbralMaximo: 10 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('ajustarStock: sube sin alerta, cruza el máximo (StockAlto), baja y cruza el mínimo (StockBajo)', async () => {
    if (!disponible) return;
    await fijarUmbrales(h.ctx, 'acopio-centro', 'banano', { umbralMinimo: 10, umbralMaximo: 50 });

    let fila = await ajustarStock(
      h.ctx,
      'acopio-centro',
      'banano',
      { delta: 30, motivo: 'entrada' },
      'admin-1',
    );
    expect(fila.cantidadActual).toBe(30);
    expect(fila.estado).toBe('OK');

    fila = await ajustarStock(
      h.ctx,
      'acopio-centro',
      'banano',
      { delta: 30, motivo: 'entrada' },
      'admin-1',
    );
    expect(fila.estado).toBe('ALTO');
    let pend = await h.ctx.repos.outbox.pendientes(50);
    expect(pend.some((e) => e.tipo === 'StockAlto')).toBe(true);

    fila = await ajustarStock(
      h.ctx,
      'acopio-centro',
      'banano',
      { delta: -55, motivo: 'despacho' },
      'admin-1',
    );
    expect(fila.cantidadActual).toBe(5);
    expect(fila.estado).toBe('BAJO');
    pend = await h.ctx.repos.outbox.pendientes(50);
    expect(pend.some((e) => e.tipo === 'StockBajo')).toBe(true);
  });

  it('una entrega confirmada suma pesoTon al inventario del acopio (vía subscriber)', async () => {
    if (!disponible) return;
    await fijarUmbrales(h.ctx, 'acopio-centro', 'maiz', { umbralMinimo: 0, umbralMaximo: 500 });

    const s = await crearSolicitud(h.ctx, 'prod-1', {
      origen: FINCA,
      acopioId: 'acopio-centro',
      cultivo: 'maiz',
      pesoTon: 8,
    });
    const v = await registrarVehiculo(h.ctx, 't-inv', {
      placa: `M${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      tipo: 'camion',
      capacidadTon: 10,
      zona: 'quevedo-centro',
    });
    const flete = await asignarFlete(h.ctx, 'admin-1', { solicitudId: s.id, vehiculoId: v.id });
    for (const estado of ['EN_CAMINO_ORIGEN', 'CARGANDO', 'EN_RUTA', 'ENTREGADO'] as const) {
      await cambiarEstadoFlete(h.ctx, transp('t-inv'), flete.id, estado);
    }

    const antes =
      (await h.ctx.repos.inventario.obtener('acopio-centro', 'maiz'))?.cantidadActual ?? 0;
    await procesarOutbox(h.ctx);
    const despues =
      (await h.ctx.repos.inventario.obtener('acopio-centro', 'maiz'))?.cantidadActual ?? 0;
    expect(despues).toBe(antes + 8);
  });

  it('obtenerInventario devuelve el tablero por acopio con estado', async () => {
    if (!disponible) return;
    const tablero = await obtenerInventario(h.ctx);
    const centro = tablero.find((t) => t.acopioId === 'acopio-centro');
    expect(centro).toBeDefined();
    expect(centro!.stock.length).toBeGreaterThanOrEqual(2);
    expect(centro!.stock.every((s) => ['BAJO', 'OK', 'ALTO'].includes(s.estado))).toBe(true);
  });

  it('ajustarStock rechaza un cultivo fuera del catálogo', async () => {
    if (!disponible) return;
    await expect(
      ajustarStock(h.ctx, 'acopio-centro', 'platano', { delta: 5, motivo: 'xyz' }, 'admin-1'),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
