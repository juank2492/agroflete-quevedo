import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors.js';
import {
  contextoDePrueba,
  crearTablaTest,
  borrarTablaTest,
  dynamoDisponible,
  type CtxDePrueba,
} from '../../../test/dynamo-it.js';
import type { JwtClaims } from '@agroflete/shared';
import { crearSolicitud } from './crear-solicitud.js';
import { asignarFlete, listarVehiculosCompatibles } from './asignar-flete.js';
import { actualizarVehiculo, misVehiculos, registrarVehiculo } from './gestion-vehiculos.js';
import { reasignarFlete } from './reasignar-flete.js';

const admin: JwtClaims = { sub: 'admin-1', email: 'a@f.ec', role: 'admin', name: 'Admin' };

const TABLA = 'AgrofleteTable-it-asignacion';

const ACOPIO = {
  id: 'acopio-mocache',
  nombre: 'Centro de Acopio Mocache',
  lat: -1.1667,
  lon: -79.5333,
  zona: 'mocache' as const,
};
const FINCA = { lat: -1.16, lon: -79.54 };

describe('asignación de fletes (integración con DynamoDB Local)', () => {
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

  const solicitudInput = {
    origen: FINCA,
    acopioId: 'acopio-mocache',
    cultivo: 'maiz' as const,
    pesoTon: 10,
  };

  it('registrarVehiculo lo deja DISPONIBLE y misVehiculos lo lista', async () => {
    if (!disponible) return;
    const v = await registrarVehiculo(h.ctx, 't-1', {
      placa: 'ABC-1234',
      tipo: 'camion',
      capacidadTon: 15,
      zona: 'mocache',
    });
    expect(v.estado).toBe('DISPONIBLE');
    const mios = await misVehiculos(h.ctx, 't-1');
    expect(mios.map((x) => x.id)).toContain(v.id);
  });

  it('actualizarVehiculo rechaza a un dueño distinto', async () => {
    if (!disponible) return;
    const v = await registrarVehiculo(h.ctx, 't-2', {
      placa: 'XYZ-9876',
      tipo: 'furgon',
      capacidadTon: 8,
      zona: 'mocache',
    });
    await expect(
      actualizarVehiculo(h.ctx, 't-999', v.id, { estado: 'INACTIVO' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('listarVehiculosCompatibles filtra por zona y capacidad', async () => {
    if (!disponible) return;
    const s = await crearSolicitud(h.ctx, 'p-1', solicitudInput);
    await registrarVehiculo(h.ctx, 't-3', {
      placa: 'CAP-0500',
      tipo: 'furgon',
      capacidadTon: 5,
      zona: 'mocache',
    });
    const grande = await registrarVehiculo(h.ctx, 't-4', {
      placa: 'CAP-2000',
      tipo: 'camion-tolva',
      capacidadTon: 20,
      zona: 'mocache',
    });

    const compat = await listarVehiculosCompatibles(h.ctx, s.id);
    expect(compat.every((v) => v.capacidadTon >= 10 && v.zona === 'mocache')).toBe(true);
    expect(compat.map((v) => v.id)).toContain(grande.id);
    expect(compat.every((v) => v.capacidadTon >= 5 && v.capacidadTon < 10)).toBe(false);
  });

  it('asignarFlete crea el flete, ocupa el vehículo, pasa la solicitud a ASIGNADA y emite evento', async () => {
    if (!disponible) return;
    const s = await crearSolicitud(h.ctx, 'p-5', solicitudInput);
    const v = await registrarVehiculo(h.ctx, 't-5', {
      placa: 'ASG-1111',
      tipo: 'camion',
      capacidadTon: 18,
      zona: 'mocache',
    });

    const flete = await asignarFlete(h.ctx, 'admin-1', { solicitudId: s.id, vehiculoId: v.id });
    expect(flete.estado).toBe('ASIGNADO');
    expect(flete.transportistaId).toBe('t-5');
    expect(flete.tarifa).toBe(s.tarifaEstimada);
    expect(flete.timeline).toHaveLength(1);

    expect((await h.ctx.repos.solicitudes.porId(s.id))?.estado).toBe('ASIGNADA');
    expect((await h.ctx.repos.solicitudes.porId(s.id))?.fleteId).toBe(flete.id);
    expect((await h.ctx.repos.vehiculos.porId(v.id))?.estado).toBe('OCUPADO');
    expect((await h.ctx.repos.fletes.porTransportista('t-5')).map((f) => f.id)).toContain(flete.id);

    const pend = await h.ctx.repos.outbox.pendientes(30);
    expect(pend.some((e) => e.tipo === 'FleteAsignado')).toBe(true);
  });

  it('asignarFlete sobre una solicitud ya asignada lanza ConflictError', async () => {
    if (!disponible) return;
    const s = await crearSolicitud(h.ctx, 'p-6', solicitudInput);
    const v1 = await registrarVehiculo(h.ctx, 't-6', {
      placa: 'DUP-0001',
      tipo: 'camion',
      capacidadTon: 15,
      zona: 'mocache',
    });
    const v2 = await registrarVehiculo(h.ctx, 't-7', {
      placa: 'DUP-0002',
      tipo: 'camion',
      capacidadTon: 15,
      zona: 'mocache',
    });
    await asignarFlete(h.ctx, 'admin-1', { solicitudId: s.id, vehiculoId: v1.id });
    await expect(
      asignarFlete(h.ctx, 'admin-1', { solicitudId: s.id, vehiculoId: v2.id }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('asignarFlete con vehículo de otra zona lanza ConflictError', async () => {
    if (!disponible) return;
    const s = await crearSolicitud(h.ctx, 'p-8', solicitudInput);
    const v = await registrarVehiculo(h.ctx, 't-8', {
      placa: 'ZON-0001',
      tipo: 'camion',
      capacidadTon: 15,
      zona: 'buena-fe',
    });
    await expect(
      asignarFlete(h.ctx, 'admin-1', { solicitudId: s.id, vehiculoId: v.id }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('asignarFlete con solicitud inexistente lanza NotFoundError', async () => {
    if (!disponible) return;
    await expect(
      asignarFlete(h.ctx, 'admin-1', { solicitudId: 'nope', vehiculoId: 'nope' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('reasignarFlete cancela el flete actual y crea uno nuevo con el otro vehículo', async () => {
    if (!disponible) return;
    const s = await crearSolicitud(h.ctx, 'p-re', solicitudInput);
    const v1 = await registrarVehiculo(h.ctx, 't-re1', {
      placa: 'REA-0001',
      tipo: 'camion',
      capacidadTon: 15,
      zona: 'mocache',
    });
    const v2 = await registrarVehiculo(h.ctx, 't-re2', {
      placa: 'REA-0002',
      tipo: 'camion',
      capacidadTon: 20,
      zona: 'mocache',
    });
    const original = await asignarFlete(h.ctx, 'admin-1', { solicitudId: s.id, vehiculoId: v1.id });

    const nuevo = await reasignarFlete(h.ctx, admin, original.id, v2.id);
    expect(nuevo.id).not.toBe(original.id);
    expect(nuevo.vehiculoId).toBe(v2.id);
    expect(nuevo.estado).toBe('ASIGNADO');

    expect((await h.ctx.repos.fletes.porId(original.id))?.estado).toBe('CANCELADO');
    expect((await h.ctx.repos.vehiculos.porId(v1.id))?.estado).toBe('DISPONIBLE');
    expect((await h.ctx.repos.vehiculos.porId(v2.id))?.estado).toBe('OCUPADO');
    expect((await h.ctx.repos.solicitudes.porId(s.id))?.fleteId).toBe(nuevo.id);

    // A un vehículo de otra zona: rechaza sin tocar el flete.
    const otraZona = await registrarVehiculo(h.ctx, 't-re3', {
      placa: 'REA-0003',
      tipo: 'camion',
      capacidadTon: 20,
      zona: 'buena-fe',
    });
    await expect(reasignarFlete(h.ctx, admin, nuevo.id, otraZona.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect((await h.ctx.repos.fletes.porId(nuevo.id))?.estado).toBe('ASIGNADO');
  });
});
