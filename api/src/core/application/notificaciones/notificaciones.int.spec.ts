import type { JwtClaims } from '@agroflete/shared';
import {
  contextoDePrueba,
  crearTablaTest,
  borrarTablaTest,
  dynamoDisponible,
  type CtxDePrueba,
} from '../../../test/dynamo-it.js';
import { procesarOutbox } from '../../../entrypoints/worker/dispatcher.js';
import { crearSolicitud } from '../despacho/crear-solicitud.js';
import { pagarConPasarela } from '../pagos/pagar-solicitud.js';
import {
  listarNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
} from './consultar-notificaciones.js';
import { clavePublicaPush, guardarSuscripcionPush } from './push.js';

const TABLA = 'AgrofleteTable-it-notif';

const ACOPIO = {
  id: 'acopio-notif',
  nombre: 'Acopio Notif',
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

describe('notificaciones in-app (integración con DynamoDB Local)', () => {
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

  it('crear una solicitud genera aviso in-app al productor y NO correo', async () => {
    if (!disponible) return;
    h.correos.length = 0;
    const s = await nuevaSolicitud(h, 'p-notif-1');
    await procesarOutbox(h.ctx);

    const avisos = await listarNotificaciones(h.ctx, productor('p-notif-1'));
    const aviso = avisos.find((n) => n.titulo === 'Solicitud recibida');
    expect(aviso).toBeDefined();
    expect(aviso?.enlace).toBe(`/p/solicitudes/${s.id}`);
    expect(aviso?.leidoEn).toBeUndefined();

    expect(h.correos.some((c) => /solicitud/i.test(c.subject))).toBe(false);
  });

  it('pago aprobado genera aviso "Pago confirmado" in-app y NO correo', async () => {
    if (!disponible) return;
    const s = await nuevaSolicitud(h, 'p-notif-2');
    h.correos.length = 0;
    await pagarConPasarela(h.ctx, productor('p-notif-2'), s.id, {
      numeroTarjeta: '4111111111111112',
      titular: 'Juan Productor',
      expiracion: '12/30',
      cvv: '123',
      tipo: 'credito',
      marca: 'visa',
    });
    await procesarOutbox(h.ctx);

    const avisos = await listarNotificaciones(h.ctx, productor('p-notif-2'));
    expect(avisos.some((n) => n.titulo === 'Pago confirmado')).toBe(true);
    expect(h.correos.some((c) => /pago confirmado/i.test(c.subject))).toBe(false);
  });

  it('Web Push: guarda la suscripción del navegador; sin claves VAPID queda deshabilitado', async () => {
    if (!disponible) return;
    const user = productor('p-notif-push');
    await guardarSuscripcionPush(h.ctx, user, {
      endpoint: 'https://push.example.com/abc',
      keys: { p256dh: 'p', auth: 'a' },
    });
    const subs = await h.ctx.repos.push.porUsuario(user.sub);
    expect(subs.map((s) => s.endpoint)).toContain('https://push.example.com/abc');
    expect(clavePublicaPush(h.ctx).clave).toBeNull();
  });

  it('marcarLeida y marcarTodasLeidas', async () => {
    if (!disponible) return;
    const s1 = await nuevaSolicitud(h, 'p-notif-3');
    await nuevaSolicitud(h, 'p-notif-3');
    await procesarOutbox(h.ctx);

    let avisos = await listarNotificaciones(h.ctx, productor('p-notif-3'));
    expect(avisos.length).toBeGreaterThanOrEqual(2);
    const primero = avisos.find((n) => n.enlace === `/p/solicitudes/${s1.id}`)!;

    await marcarLeida(h.ctx, productor('p-notif-3'), primero.id);
    avisos = await listarNotificaciones(h.ctx, productor('p-notif-3'));
    expect(avisos.find((n) => n.id === primero.id)?.leidoEn).toBeDefined();

    const marcadas = await marcarTodasLeidas(h.ctx, productor('p-notif-3'));
    expect(marcadas).toBeGreaterThanOrEqual(1);
    avisos = await listarNotificaciones(h.ctx, productor('p-notif-3'));
    expect(avisos.every((n) => n.leidoEn !== undefined)).toBe(true);
  });
});
