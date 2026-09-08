import type { JwtClaims } from '@agroflete/shared';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../domain/errors.js';
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
import { registrarIncidencia } from './registrar-incidencia.js';
import { consultarRuta, registrarUbicacion } from './registrar-ubicacion.js';

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
    expect(flujoFinal?.timeline).toHaveLength(5);

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

  it('cambiarEstadoFlete: el transportista debe indicar el motivo al cancelar; queda guardado', async () => {
    if (!disponible) return;
    const { flete } = await crearFleteListo(h, 'p-4b', 't-4b');
    const user = transportista('t-4b');

    await expect(cambiarEstadoFlete(h.ctx, user, flete.id, 'CANCELADO')).rejects.toBeInstanceOf(
      ValidationError,
    );

    const cancelado = await cambiarEstadoFlete(
      h.ctx,
      user,
      flete.id,
      'CANCELADO',
      'Se dañó el vehículo en la vía',
    );
    expect(cancelado.motivoCancelacion).toBe('Se dañó el vehículo en la vía');

    const guardado = await h.ctx.repos.fletes.porId(flete.id);
    expect(guardado?.motivoCancelacion).toBe('Se dañó el vehículo en la vía');
    expect(guardado?.timeline.at(-1)?.motivo).toBe('Se dañó el vehículo en la vía');

    const pend = await h.ctx.repos.outbox.pendientes(50);
    const ev = pend.find(
      (e) =>
        e.tipo === 'EstadoFleteCambiado' && (e.payload as { fleteId: string }).fleteId === flete.id,
    );
    expect((ev?.payload as { motivo?: string }).motivo).toBe('Se dañó el vehículo en la vía');
  });

  it('registrarIncidencia: flete → INCIDENCIA, solicitud vuelve a la cola marcada, vehículo fuera de servicio', async () => {
    if (!disponible) return;
    const { s, v, flete } = await crearFleteListo(h, 'p-inc', 't-inc');
    const user = transportista('t-inc');
    await cambiarEstadoFlete(h.ctx, user, flete.id, 'EN_CAMINO_ORIGEN');

    const actualizado = await registrarIncidencia(h.ctx, user, flete.id, {
      motivo: 'Se rompió el eje trasero en la vía',
      gravedad: 'grave',
      vehiculoFueraDeServicio: true,
    });
    expect(actualizado.estado).toBe('INCIDENCIA');
    expect(actualizado.incidencia?.motivo).toContain('eje trasero');

    const solicitud = await h.ctx.repos.solicitudes.porId(s.id);
    expect(solicitud?.estado).toBe('PENDIENTE');
    expect(solicitud?.fleteId).toBeUndefined();
    expect(solicitud?.reasignacionPorIncidencia).toBe(true);
    expect(solicitud?.motivoIncidencia).toContain('eje trasero');

    expect((await h.ctx.repos.vehiculos.porId(v.id))?.estado).toBe('INACTIVO');

    const pend = await h.ctx.repos.outbox.pendientes(50);
    expect(pend.some((e) => e.tipo === 'IncidenciaEnRuta')).toBe(true);
  });

  it('registrarIncidencia: sin "fuera de servicio" el vehículo vuelve a DISPONIBLE; no se puede antes de salir', async () => {
    if (!disponible) return;
    const { v, flete } = await crearFleteListo(h, 'p-inc2', 't-inc2');
    const user = transportista('t-inc2');

    await expect(
      registrarIncidencia(h.ctx, user, flete.id, {
        motivo: 'nada',
        gravedad: 'grave',
        vehiculoFueraDeServicio: false,
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    await cambiarEstadoFlete(h.ctx, user, flete.id, 'EN_CAMINO_ORIGEN');
    await registrarIncidencia(h.ctx, user, flete.id, {
      motivo: 'Vía cerrada por protesta, no puedo continuar',
      gravedad: 'grave',
      vehiculoFueraDeServicio: false,
    });
    expect((await h.ctx.repos.vehiculos.porId(v.id))?.estado).toBe('DISPONIBLE');
  });

  it('registrarIncidencia leve: el flete sigue su curso y solo avisa al productor', async () => {
    if (!disponible) return;
    const { s, v, flete } = await crearFleteListo(h, 'p-lev', 't-lev');
    const user = transportista('t-lev');
    await cambiarEstadoFlete(h.ctx, user, flete.id, 'EN_CAMINO_ORIGEN');

    const actualizado = await registrarIncidencia(h.ctx, user, flete.id, {
      motivo: 'Pinchazo de llanta ya resuelto, seguimos viaje',
      gravedad: 'leve',
      vehiculoFueraDeServicio: false,
    });
    expect(actualizado.estado).toBe('EN_CAMINO_ORIGEN');
    expect(actualizado.incidencia?.gravedad).toBe('leve');

    const solicitud = await h.ctx.repos.solicitudes.porId(s.id);
    expect(solicitud?.estado).not.toBe('PENDIENTE');
    expect(solicitud?.fleteId).toBe(flete.id);
    expect(solicitud?.reasignacionPorIncidencia).not.toBe(true);
    expect((await h.ctx.repos.vehiculos.porId(v.id))?.estado).toBe('OCUPADO');

    const pend = await h.ctx.repos.outbox.pendientes(50);
    const ev = pend.find(
      (e) =>
        e.tipo === 'IncidenciaEnRuta' && (e.payload as { fleteId: string }).fleteId === flete.id,
    );
    expect((ev?.payload as { gravedad?: string }).gravedad).toBe('leve');
  });

  it('registrarUbicacion: guarda el punto, actualiza ultimaUbicacion y arma la ruta', async () => {
    if (!disponible) return;
    const { flete } = await crearFleteListo(h, 'p-ub', 't-ub');
    const user = transportista('t-ub');
    await cambiarEstadoFlete(h.ctx, user, flete.id, 'EN_CAMINO_ORIGEN');

    await registrarUbicacion(h.ctx, user, flete.id, { lat: -1.04, lon: -79.47, velocidad: 45 });
    await registrarUbicacion(h.ctx, user, flete.id, { lat: -1.035, lon: -79.465 });

    const actualizado = await h.ctx.repos.fletes.porId(flete.id);
    expect(actualizado?.ultimaUbicacion?.lat).toBe(-1.035);

    const ruta = await consultarRuta(h.ctx, user, flete.id);
    expect(ruta).toHaveLength(2);
    expect(ruta[0]!.velocidad).toBe(45);
    expect(ruta[0]!.ts <= ruta[1]!.ts).toBe(true);

    await expect(
      registrarUbicacion(h.ctx, transportista('t-otro'), flete.id, { lat: -1.03, lon: -79.46 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('registrarUbicacion: rechaza coordenadas fuera de Ecuador y fletes ya cerrados', async () => {
    if (!disponible) return;
    const { flete } = await crearFleteListo(h, 'p-ub2', 't-ub2');
    const user = transportista('t-ub2');

    await expect(
      registrarUbicacion(h.ctx, user, flete.id, { lat: 40.4, lon: -3.7 }),
    ).rejects.toBeInstanceOf(ValidationError);

    for (const e of ['EN_CAMINO_ORIGEN', 'CARGANDO', 'EN_RUTA', 'ENTREGADO'] as const) {
      await cambiarEstadoFlete(h.ctx, user, flete.id, e);
    }
    await expect(
      registrarUbicacion(h.ctx, user, flete.id, { lat: -1.04, lon: -79.47 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('asignarFlete guarda la ruta vial denormalizada (RoutingPort)', async () => {
    if (!disponible) return;
    const { flete } = await crearFleteListo(h, 'p-ruta', 't-ruta');
    const guardado = await h.ctx.repos.fletes.porId(flete.id);
    expect(guardado?.rutaVial?.length).toBeGreaterThanOrEqual(2);
    expect(guardado?.distanciaVialKm).toBeGreaterThan(0);
    expect(guardado?.origen).toEqual(FINCA);
    expect(guardado?.destino).toEqual({ lat: ACOPIO.lat, lon: ACOPIO.lon });
  });

  it('registrarUbicacion: al entrar en la geocerca del acopio confirma la entrega', async () => {
    if (!disponible) return;
    const { s, v, flete } = await crearFleteListo(h, 'p-geo', 't-geo');
    const user = transportista('t-geo');
    for (const e of ['EN_CAMINO_ORIGEN', 'CARGANDO', 'EN_RUTA'] as const) {
      await cambiarEstadoFlete(h.ctx, user, flete.id, e);
    }

    const lejos = await registrarUbicacion(h.ctx, user, flete.id, { lat: -1.05, lon: -79.47 });
    expect(lejos.entregaDetectada).toBe(false);

    const cerca = await registrarUbicacion(h.ctx, user, flete.id, {
      lat: ACOPIO.lat,
      lon: ACOPIO.lon,
    });
    expect(cerca.entregaDetectada).toBe(true);

    expect((await h.ctx.repos.fletes.porId(flete.id))?.estado).toBe('ENTREGADO');
    expect((await h.ctx.repos.solicitudes.porId(s.id))?.estado).toBe('COMPLETADA');
    expect((await h.ctx.repos.vehiculos.porId(v.id))?.estado).toBe('DISPONIBLE');

    const pend = await h.ctx.repos.outbox.pendientes(50);
    expect(
      pend.some(
        (e) =>
          e.tipo === 'EntregaConfirmada' && (e.payload as { fleteId: string }).fleteId === flete.id,
      ),
    ).toBe(true);
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
    expect(Object.values(m.solicitudesPorEstado).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(m.solicitudesPorDia).toHaveLength(14);
    expect(m.solicitudesPorDia.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.fecha))).toBe(true);
    expect(m.retrasosDetectados).toBeGreaterThanOrEqual(1);
  });
});
