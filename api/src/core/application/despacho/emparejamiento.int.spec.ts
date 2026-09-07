import type { Zona } from '@agroflete/shared';
import {
  borrarTablaTest,
  contextoDePrueba,
  crearTablaTest,
  dynamoDisponible,
  type CtxDePrueba,
} from '../../../test/dynamo-it.js';
import { procesarOutbox } from '../../../entrypoints/worker/dispatcher.js';
import { crearSolicitud } from './crear-solicitud.js';
import { asignarFlete } from './asignar-flete.js';
import { registrarVehiculo } from './gestion-vehiculos.js';

const TABLA = 'AgrofleteTable-it-emparejamiento';
const FINCA = { lat: -1.05, lon: -79.47 };

const acopio = (id: string, zona: Zona) => ({
  id,
  nombre: `Acopio ${id}`,
  lat: -1.0289,
  lon: -79.4646,
  zona,
});
describe('emparejamiento automático (integración con DynamoDB Local)', () => {
  let disponible = false;
  let h: CtxDePrueba;

  beforeAll(async () => {
    disponible = await dynamoDisponible();
    if (!disponible) return;
    await crearTablaTest(TABLA);
    h = contextoDePrueba(TABLA);
    await Promise.all([
      h.ctx.repos.acopios.guardar(acopio('ac-a', 'quevedo-centro')),
      h.ctx.repos.acopios.guardar(acopio('ac-b', 'quevedo-norte')),
      h.ctx.repos.acopios.guardar(acopio('ac-c', 'mocache')),
      h.ctx.repos.acopios.guardar(acopio('ac-d', 'san-carlos')),
    ]);
  }, 30_000);

  afterAll(async () => {
    if (disponible) await borrarTablaTest(TABLA);
  });

  it('asigna sola la solicitud cuando hay un vehículo compatible y emite FleteAsignado(auto)', async () => {
    if (!disponible) return;
    await registrarVehiculo(h.ctx, 't-a', {
      placa: 'AAA-111',
      tipo: 'camion',
      capacidadTon: 12,
      zona: 'quevedo-centro',
    });
    const s = await crearSolicitud(h.ctx, 'p-a', {
      origen: FINCA,
      acopioId: 'ac-a',
      cultivo: 'maiz',
      pesoTon: 6,
    });

    await procesarOutbox(h.ctx);

    const actualizada = await h.ctx.repos.solicitudes.porId(s.id);
    expect(actualizada?.estado).toBe('ASIGNADA');
    expect(actualizada?.fleteId).toBeTruthy();

    const flete = await h.ctx.repos.fletes.porId(actualizada!.fleteId!);
    expect(flete?.auto).toBe(true);
    expect(flete?.timeline[0]?.actorId).toBe('sistema');

    const pend = await h.ctx.repos.outbox.pendientes(50);
    const evt = pend.find(
      (e) =>
        e.tipo === 'FleteAsignado' && (e.payload as { solicitudId: string }).solicitudId === s.id,
    );
    expect((evt?.payload as { auto?: boolean }).auto).toBe(true);
  });

  it('sin vehículo compatible la solicitud queda PENDIENTE', async () => {
    if (!disponible) return;
    const s = await crearSolicitud(h.ctx, 'p-b', {
      origen: FINCA,
      acopioId: 'ac-b',
      cultivo: 'maiz',
      pesoTon: 5,
    });
    await procesarOutbox(h.ctx);
    expect((await h.ctx.repos.solicitudes.porId(s.id))?.estado).toBe('PENDIENTE');
  });

  it('elige el vehículo de menor capacidad que aún cabe', async () => {
    if (!disponible) return;
    await registrarVehiculo(h.ctx, 't-c1', {
      placa: 'CCC-020',
      tipo: 'camion',
      capacidadTon: 20,
      zona: 'mocache',
    });
    const chico = await registrarVehiculo(h.ctx, 't-c2', {
      placa: 'CCC-009',
      tipo: 'furgon',
      capacidadTon: 9,
      zona: 'mocache',
    });
    const s = await crearSolicitud(h.ctx, 'p-c', {
      origen: FINCA,
      acopioId: 'ac-c',
      cultivo: 'maiz',
      pesoTon: 7,
    });
    await procesarOutbox(h.ctx);

    const flete = await h.ctx.repos.fletes.porId(
      (await h.ctx.repos.solicitudes.porId(s.id))!.fleteId!,
    );
    expect(flete?.vehiculoId).toBe(chico.id);
  });

  it('con el interruptor apagado no asigna nada', async () => {
    if (!disponible) return;
    await h.ctx.repos.ajustes.guardar({ autoEmparejar: false });
    await registrarVehiculo(h.ctx, 't-d', {
      placa: 'DDD-111',
      tipo: 'camion',
      capacidadTon: 15,
      zona: 'san-carlos',
    });
    const s = await crearSolicitud(h.ctx, 'p-d', {
      origen: FINCA,
      acopioId: 'ac-d',
      cultivo: 'maiz',
      pesoTon: 4,
    });
    await procesarOutbox(h.ctx);
    expect((await h.ctx.repos.solicitudes.porId(s.id))?.estado).toBe('PENDIENTE');

    await h.ctx.repos.ajustes.guardar({ autoEmparejar: true });
  });

  it('si el admin asigna primero, el emparejador no crea un segundo flete', async () => {
    if (!disponible) return;
    const v = await registrarVehiculo(h.ctx, 't-e', {
      placa: 'EEE-111',
      tipo: 'camion',
      capacidadTon: 15,
      zona: 'quevedo-norte',
    });
    const s = await crearSolicitud(h.ctx, 'p-e', {
      origen: FINCA,
      acopioId: 'ac-b',
      cultivo: 'maiz',
      pesoTon: 5,
    });
    const manual = await asignarFlete(h.ctx, 'admin-1', { solicitudId: s.id, vehiculoId: v.id });

    await expect(procesarOutbox(h.ctx)).resolves.not.toThrow();

    const actual = await h.ctx.repos.solicitudes.porId(s.id);
    expect(actual?.fleteId).toBe(manual.id);
    expect((await h.ctx.repos.fletes.porId(manual.id))?.auto).toBeUndefined();
  });
});
