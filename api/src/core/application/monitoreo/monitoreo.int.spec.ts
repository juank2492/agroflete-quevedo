import type { JwtClaims } from '@agroflete/shared';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors.js';
import {
  contextoDePrueba,
  crearTablaTest,
  borrarTablaTest,
  dynamoDisponible,
  relojFijo,
  type CtxDePrueba,
} from '../../../test/dynamo-it.js';
import { crearSolicitud } from '../despacho/crear-solicitud.js';
import { asignarFlete } from '../despacho/asignar-flete.js';
import { registrarVehiculo } from '../despacho/gestion-vehiculos.js';
import { cambiarEstadoFlete } from './cambiar-estado-flete.js';
import { listarFletes, obtenerFlete } from './consultar-fletes.js';
import { detectarRetrasos } from './detectar-retrasos.js';
import { obtenerMetricasOperativas } from './metricas-operativas.js';

const TABLA = 'AgrofleteTable-it-monitoreo';

const ACOPIO = {
  id: 'acopio-centro',
  nombre: 'Centro de Acopio Quevedo Centro',
  lat: -1.0289,
  lon: -79.4646,
  zona: 'quevedo-centro' as const,
};
const FINCA = { lat: -1.05, lon: -79.47 };

const admin: JwtClaims = { sub: 'admin-1', email: 'a@f.ec', role: 'admin', name: 'Admin' };
const transportista = (sub: string): JwtClaims => ({
  sub,
  email: `${sub}@f.ec`,
  role: 'transportista',
  name: sub,
});

async function crearFleteListo(h: CtxDePrueba, productorId: string, transportistaId: string) {
  const s = await crearSolicitud(h.ctx, productorId, {
    origen: FINCA,
    acopioId: 'acopio-centro',
    cultivo: 'maiz',
    pesoTon: 6,
  });
  const v = await registrarVehiculo(h.ctx, transportistaId, {
    placa: `M${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    tipo: 'camion',
    capacidadTon: 10,
    zona: 'quevedo-centro',
  });
  const flete = await asignarFlete(h.ctx, 'admin-1', { solicitudId: s.id, vehiculoId: v.id });
  return { s, v, flete };
}

describe('monitoreo (integración con DynamoDB Local)', () => {
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

  it('listarFletes: transportista ve los suyos, obtenerFlete respeta dueño', async () => {
    if (!disponible) return;
    const { flete } = await crearFleteListo(h, 'p-1', 't-1');

    const propios = await listarFletes(h.ctx, transportista('t-1'), {});
    expect(propios.map((f) => f.id)).toContain(flete.id);

    expect((await obtenerFlete(h.ctx, transportista('t-1'), flete.id)).id).toBe(flete.id);
    await expect(obtenerFlete(h.ctx, transportista('t-9'), flete.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect((await obtenerFlete(h.ctx, admin, flete.id)).id).toBe(flete.id);
  });

  it('cambiarEstadoFlete: rechaza transición inválida y a un no-dueño', async () => {
    if (!disponible) return;
    const { flete } = await crearFleteListo(h, 'p-2', 't-2');

    await expect(
      cambiarEstadoFlete(h.ctx, transportista('t-2'), flete.id, 'EN_RUTA'),
    ).rejects.toBeInstanceOf(ConflictError);

    await expect(
      cambiarEstadoFlete(h.ctx, transportista('t-9'), flete.id, 'EN_CAMINO_ORIGEN'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('cambiarEstadoFlete hasta ENTREGADO: completa la solicitud y libera el vehículo', async () => {
    if (!disponible) return;
    const { s, v, flete } = await crearFleteListo(h, 'p-3', 't-3');
    const user = transportista('t-3');

    for (const estado of ['EN_CAMINO_ORIGEN', 'CARGANDO', 'EN_RUTA', 'ENTREGADO'] as const) {
      const actualizado = await cambiarEstadoFlete(h.ctx, user, flete.id, estado);
      expect(actualizado.estado).toBe(estado);
    }

    expect((await h.ctx.repos.solicitudes.porId(s.id))?.estado).toBe('COMPLETADA');
    expect((await h.ctx.repos.vehiculos.porId(v.id))?.estado).toBe('DISPONIBLE');

    const flujoFinal = await h.ctx.repos.fletes.porId(flete.id);
    expect(flujoFinal?.timeline).toHaveLength(5); // ASIGNADO + 4 transiciones

    const pend = await h.ctx.repos.outbox.pendientes(50);
    expect(pend.some((e) => e.tipo === 'EntregaConfirmada')).toBe(true);
  });

  it('cambiarEstadoFlete a CANCELADO: libera vehículo y reabre la solicitud', async () => {
    if (!disponible) return;
    const { s, v, flete } = await crearFleteListo(h, 'p-4', 't-4');

    await cambiarEstadoFlete(h.ctx, admin, flete.id, 'CANCELADO');

    const solicitud = await h.ctx.repos.solicitudes.porId(s.id);
    expect(solicitud?.estado).toBe('PENDIENTE');
    expect(solicitud?.fleteId).toBeUndefined();
    expect((await h.ctx.repos.vehiculos.porId(v.id))?.estado).toBe('DISPONIBLE');
  });

  it('cambiarEstadoFlete de un flete inexistente lanza NotFoundError', async () => {
    if (!disponible) return;
    await expect(cambiarEstadoFlete(h.ctx, admin, 'no-existe', 'CARGANDO')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('detectarRetrasos emite RetrasoDetectado una sola vez por solicitud', async () => {
    if (!disponible) return;
    const hace8h = new Date(Date.now() - 8 * 3_600_000).toISOString();
    const hPasado = contextoDePrueba(TABLA, relojFijo(hace8h));
    const vieja = await crearSolicitud(hPasado.ctx, 'p-5', {
      origen: FINCA,
      acopioId: 'acopio-centro',
      cultivo: 'banano',
      pesoTon: 4,
    });

    const primeraPasada = await detectarRetrasos(h.ctx);
    expect(primeraPasada).toBeGreaterThanOrEqual(1);

    const actualizada = await h.ctx.repos.solicitudes.porId(vieja.id);
    expect(actualizada?.retrasoNotificado).toBe(true);

    const pend = await h.ctx.repos.outbox.pendientes(50);
    const evento = pend.find(
      (e) =>
        e.tipo === 'RetrasoDetectado' &&
        (e.payload as { solicitudId: string }).solicitudId === vieja.id,
    );
    expect(evento).toBeDefined();

    const segundaPasada = await detectarRetrasos(h.ctx);
    // La misma solicitud no debe volver a contarse (idempotencia por retrasoNotificado).
    const pend2 = await h.ctx.repos.outbox.pendientes(50);
    const repetidos = pend2.filter(
      (e) =>
        e.tipo === 'RetrasoDetectado' &&
        (e.payload as { solicitudId: string }).solicitudId === vieja.id,
    );
    expect(repetidos).toHaveLength(1);
    expect(segundaPasada).toBe(0);
  });

  it('obtenerMetricasOperativas devuelve un resumen coherente', async () => {
    if (!disponible) return;
    const m = await obtenerMetricasOperativas(h.ctx);
    expect(m.tarifaMedia).toBeGreaterThan(0);
    expect(m.solicitudesPendientes).toBeGreaterThanOrEqual(0);
    expect(Object.values(m.fletesPorEstado).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(m.retrasosDetectados).toBeGreaterThanOrEqual(1);
  });
});
