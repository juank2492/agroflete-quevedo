import type { JwtClaims } from '@agroflete/shared';
import { ForbiddenError, NotFoundError } from '../../domain/errors.js';
import {
  contextoDePrueba,
  crearTablaTest,
  borrarTablaTest,
  dynamoDisponible,
  type CtxDePrueba,
} from '../../../test/dynamo-it.js';
import { crearSolicitud } from './crear-solicitud.js';
import { listarSolicitudes, obtenerSolicitud } from './consultar-solicitudes.js';

const TABLA = 'AgrofleteTable-it-despacho';

const ACOPIO = {
  id: 'acopio-centro',
  nombre: 'Centro de Acopio Quevedo Centro',
  lat: -1.0289,
  lon: -79.4646,
  zona: 'quevedo-centro' as const,
};
const FINCA = { lat: -1.15, lon: -79.55 };

const productor = (sub: string): JwtClaims => ({
  sub,
  email: `${sub}@f.ec`,
  role: 'productor',
  name: sub,
});
const admin: JwtClaims = { sub: 'admin-1', email: 'a@f.ec', role: 'admin', name: 'Admin' };
const transportista: JwtClaims = { sub: 't-1', email: 't@f.ec', role: 'transportista', name: 'T' };

describe('despacho / solicitudes (integración con DynamoDB Local)', () => {
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

  const input = { origen: FINCA, acopioId: 'acopio-centro', cultivo: 'maiz' as const, pesoTon: 8 };

  it('crearSolicitud calcula tarifa, persiste PENDIENTE y emite SolicitudCreada', async () => {
    if (!disponible) return;
    const s = await crearSolicitud(h.ctx, 'p-1', input);
    expect(s.estado).toBe('PENDIENTE');
    expect(s.tarifaEstimada).toBeGreaterThan(0);
    expect(s.distanciaKm).toBeGreaterThan(0);
    expect(s.zona).toBe('quevedo-centro');
    expect(s.acopioNombre).toBe(ACOPIO.nombre);

    const persistida = await h.ctx.repos.solicitudes.porId(s.id);
    expect(persistida?.productorId).toBe('p-1');

    const pend = await h.ctx.repos.outbox.pendientes(20);
    expect(pend.some((e) => e.tipo === 'SolicitudCreada')).toBe(true);
  });

  it('crearSolicitud con la misma idempotencyKey no duplica: devuelve la existente', async () => {
    if (!disponible) return;
    const key = '11111111-2222-4333-8444-555555555555';
    const primera = await crearSolicitud(h.ctx, 'p-idem', { ...input, idempotencyKey: key });
    const reintento = await crearSolicitud(h.ctx, 'p-idem', {
      ...input,
      pesoTon: 20, // distinto: se ignora, gana la primera
      idempotencyKey: key,
    });
    expect(reintento.id).toBe(primera.id);
    expect(reintento.pesoTon).toBe(primera.pesoTon);

    const propias = await listarSolicitudes(h.ctx, productor('p-idem'), {});
    expect(propias.filter((s) => s.idempotencyKey === key)).toHaveLength(1);
  });

  it('crearSolicitud con acopio inexistente lanza NotFoundError', async () => {
    if (!disponible) return;
    await expect(
      crearSolicitud(h.ctx, 'p-1', { ...input, acopioId: 'nope' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('listarSolicitudes: el productor ve solo las suyas', async () => {
    if (!disponible) return;
    await crearSolicitud(h.ctx, 'p-2', input);
    await crearSolicitud(h.ctx, 'p-2', { ...input, cultivo: 'banano' });

    const propias = await listarSolicitudes(h.ctx, productor('p-2'), {});
    expect(propias.length).toBeGreaterThanOrEqual(2);
    expect(propias.every((s) => s.productorId === 'p-2')).toBe(true);
  });

  it('listarSolicitudes: el admin filtra por estado', async () => {
    if (!disponible) return;
    const pendientes = await listarSolicitudes(h.ctx, admin, { estado: 'PENDIENTE' });
    expect(pendientes.every((s) => s.estado === 'PENDIENTE')).toBe(true);
    const asignadas = await listarSolicitudes(h.ctx, admin, { estado: 'ASIGNADA' });
    expect(asignadas.length).toBe(0);
  });

  it('listarSolicitudes: el transportista recibe ForbiddenError', async () => {
    if (!disponible) return;
    await expect(listarSolicitudes(h.ctx, transportista, {})).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('obtenerSolicitud: dueño OK, otro productor Forbidden, admin OK', async () => {
    if (!disponible) return;
    const s = await crearSolicitud(h.ctx, 'p-3', input);

    expect((await obtenerSolicitud(h.ctx, productor('p-3'), s.id)).id).toBe(s.id);
    await expect(obtenerSolicitud(h.ctx, productor('p-9'), s.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect((await obtenerSolicitud(h.ctx, admin, s.id)).id).toBe(s.id);
  });

  it('obtenerSolicitud inexistente lanza NotFoundError', async () => {
    if (!disponible) return;
    await expect(obtenerSolicitud(h.ctx, admin, 'no-existe')).rejects.toBeInstanceOf(NotFoundError);
  });
});
