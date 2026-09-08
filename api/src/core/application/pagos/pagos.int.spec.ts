import { pagoConfirmado, type JwtClaims } from '@agroflete/shared';
import { ConflictError } from '../../domain/errors.js';
import {
  contextoDePrueba,
  crearTablaTest,
  borrarTablaTest,
  dynamoDisponible,
  type CtxDePrueba,
} from '../../../test/dynamo-it.js';
import { crearSolicitud } from '../despacho/crear-solicitud.js';
import { asignarFlete } from '../despacho/asignar-flete.js';
import { registrarVehiculo } from '../despacho/gestion-vehiculos.js';
import { pagarConPasarela, registrarDeposito } from './pagar-solicitud.js';
import { listarPagosEnRevision, revisarPago } from './revisar-pago.js';

const TABLA = 'AgrofleteTable-it-pagos';

const ACOPIO = {
  id: 'acopio-pagos',
  nombre: 'Acopio Pagos',
  lat: -1.0289,
  lon: -79.4646,
  zona: 'quevedo-centro' as const,
};
const FINCA = { lat: -1.05, lon: -79.47 };

const productor = (sub: string): JwtClaims => ({
  sub,
  email: `${sub}@f.ec`,
  role: 'productor',
  name: sub,
});

async function nuevaSolicitud(h: CtxDePrueba, productorId: string) {
  return crearSolicitud(h.ctx, productorId, {
    origen: FINCA,
    acopioId: ACOPIO.id,
    cultivo: 'maiz',
    pesoTon: 6,
  });
}

/** Datos de tarjeta válidos; `final` decide el último dígito (par = aprueba). */
const tarjeta = (final: string) => ({
  numeroTarjeta: `411111111111111${final}`,
  titular: 'Juan Productor',
  expiracion: '12/30',
  cvv: '123',
  tipo: 'credito' as const,
  marca: 'visa' as const,
});

describe('pagos (integración con DynamoDB Local)', () => {
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

  it('crear una solicitud la deja con el pago PENDIENTE', async () => {
    if (!disponible) return;
    const s = await nuevaSolicitud(h, 'p-pago-1');
    expect(s.pago?.estado).toBe('PENDIENTE');
    expect(s.pago?.monto).toBe(s.tarifaEstimada);
    expect(pagoConfirmado(s)).toBe(false);
  });

  it('pasarela: tarjeta terminada en par aprueba y emite PagoAprobado', async () => {
    if (!disponible) return;
    const s = await nuevaSolicitud(h, 'p-pago-2');
    const r = await pagarConPasarela(h.ctx, productor('p-pago-2'), s.id, tarjeta('2'));
    expect(r.aprobado).toBe(true);
    expect(r.pago.estado).toBe('PAGADO');

    const guardada = await h.ctx.repos.solicitudes.porId(s.id);
    expect(pagoConfirmado(guardada!)).toBe(true);

    const pend = await h.ctx.repos.outbox.pendientes(50);
    expect(
      pend.some(
        (e) =>
          e.tipo === 'PagoAprobado' && (e.payload as { solicitudId: string }).solicitudId === s.id,
      ),
    ).toBe(true);
  });

  it('pasarela: tarjeta terminada en impar rechaza y permite reintentar', async () => {
    if (!disponible) return;
    const s = await nuevaSolicitud(h, 'p-pago-3');
    const rechazo = await pagarConPasarela(h.ctx, productor('p-pago-3'), s.id, tarjeta('1'));
    expect(rechazo.aprobado).toBe(false);
    expect(rechazo.pago.estado).toBe('RECHAZADO');

    const reintento = await pagarConPasarela(h.ctx, productor('p-pago-3'), s.id, tarjeta('2'));
    expect(reintento.aprobado).toBe(true);
  });

  it('depósito: queda EN_REVISION y el admin lo aprueba', async () => {
    if (!disponible) return;
    const s = await nuevaSolicitud(h, 'p-pago-4');
    const dep = await registrarDeposito(h.ctx, productor('p-pago-4'), s.id, {
      banco: 'Banco Pichincha',
      referencia: 'DEP-99887',
      monto: s.tarifaEstimada,
      fecha: '2026-09-07',
    });
    expect(dep.pago.estado).toBe('EN_REVISION');

    const enRevision = await listarPagosEnRevision(h.ctx);
    expect(enRevision.map((x) => x.id)).toContain(s.id);

    const r = await revisarPago(h.ctx, s.id, { aprobar: true });
    expect(r.aprobado).toBe(true);
    expect((await h.ctx.repos.solicitudes.porId(s.id))!.pago?.estado).toBe('PAGADO');

    await expect(revisarPago(h.ctx, s.id, { aprobar: true })).rejects.toBeInstanceOf(ConflictError);
  });

  it('con pagoObligatorio, no se puede asignar sin pago confirmado', async () => {
    if (!disponible) return;
    const estricto = contextoDePrueba(TABLA, undefined, { pagoObligatorio: true });
    const s = await nuevaSolicitud(estricto, 'p-pago-5');
    const v = await registrarVehiculo(estricto.ctx, 't-pago-5', {
      placa: 'PGO-5005',
      tipo: 'camion',
      capacidadTon: 10,
      zona: 'quevedo-centro',
    });

    await expect(
      asignarFlete(estricto.ctx, 'admin-1', { solicitudId: s.id, vehiculoId: v.id }),
    ).rejects.toBeInstanceOf(ConflictError);

    await pagarConPasarela(estricto.ctx, productor('p-pago-5'), s.id, tarjeta('2'));
    const flete = await asignarFlete(estricto.ctx, 'admin-1', {
      solicitudId: s.id,
      vehiculoId: v.id,
    });
    expect(flete.estado).toBe('ASIGNADO');
  });
});
