import type { DomainEvent, EstadoFlete, EventPayloadMap, TipoEvento } from '@agroflete/shared';
import type { AppContext } from '../../core/app-context.js';
import { emparejarAutomatico } from '../../core/application/despacho/emparejar-automatico.js';
import { registrarMovimientoStock } from '../../core/application/inventario/movimiento-stock.js';
import {
  notificacionesDe,
  type AvisoPlantilla,
} from '../../core/application/notificaciones/plantillas.js';
import { empujarAviso } from '../../core/application/notificaciones/push.js';

export interface Subscriber {
  nombre: string;
  tipos: TipoEvento[];
  handle(ev: DomainEvent, ctx: AppContext): Promise<void>;
}

const ESTADO_LABEL: Record<EstadoFlete, string> = {
  ASIGNADO: 'asignado',
  EN_CAMINO_ORIGEN: 'en camino al origen de la carga',
  CARGANDO: 'cargando en finca',
  EN_RUTA: 'en ruta al centro de acopio',
  ENTREGADO: 'entregado',
  CANCELADO: 'cancelado',
  INCIDENCIA: 'con una incidencia en ruta',
};

async function correoDe(ctx: AppContext, userId: string): Promise<string | null> {
  const u = await ctx.repos.usuarios.porId(userId);
  return u?.email ?? null;
}

/**
 * Correo (Mailpit en local) **solo para lo esencial**: credenciales, avisos que
 * requieren acción del usuario aunque no tenga la app abierta, y alertas de
 * operación. El resto de avisos va por notificación in-app (`notificaciones-app`).
 */
const notificar: Subscriber = {
  nombre: 'notificar',
  tipos: [
    'UsuarioRegistrado',
    'TransportistaCreado',
    'EstadoFleteCambiado',
    'RetrasoDetectado',
    'IncidenciaEnRuta',
    'StockBajo',
    'StockAlto',
    'PagoRechazado',
    'PagoEnRevision',
  ],
  async handle(ev, ctx) {
    switch (ev.tipo) {
      case 'UsuarioRegistrado': {
        const p = ev.payload as EventPayloadMap['UsuarioRegistrado'];
        const minutos = Math.round(ctx.config.confCodeTtlMs / 60_000);
        await ctx.notifier.enviarEmail({
          to: p.email,
          subject: 'Tu código de confirmación — AgroFlete',
          text:
            `Hola ${p.nombreCompleto},\n\n` +
            `Tu código de confirmación es: ${p.codigo}\n` +
            `Vence en ${minutos} minutos.\n\n` +
            `Ingresa este código en la pantalla de confirmación para activar tu cuenta.`,
        });
        return;
      }

      case 'EstadoFleteCambiado': {
        // Por correo solo la cancelación (con su motivo); el resto va in-app.
        const p = ev.payload as EventPayloadMap['EstadoFleteCambiado'];
        if (p.estado !== 'CANCELADO') return;
        const to = await correoDe(ctx, p.productorId);
        if (!to) return;
        await ctx.notifier.enviarEmail({
          to,
          subject: 'Tu flete fue cancelado — AgroFlete',
          text:
            `Tu flete pasó a: ${ESTADO_LABEL[p.estado]}.` +
            (p.motivo ? `\nMotivo: "${p.motivo}"` : '') +
            `\n\nTu solicitud volvió a la cola y se reasignará a otro vehículo.`,
        });
        return;
      }

      case 'RetrasoDetectado': {
        const p = ev.payload as EventPayloadMap['RetrasoDetectado'];
        const to = await correoDe(ctx, p.productorId);
        if (!to) return;
        await ctx.notifier.enviarEmail({
          to,
          subject: 'Tu solicitud lleva demasiado tiempo sin asignar — AgroFlete',
          text:
            `Tu solicitud lleva ${p.horasEspera} horas esperando asignación de transportista.\n` +
            `Estamos trabajando en conseguirte un camión lo antes posible.`,
        });
        return;
      }

      case 'IncidenciaEnRuta': {
        const p = ev.payload as EventPayloadMap['IncidenciaEnRuta'];
        const to = await correoDe(ctx, p.productorId);
        if (!to) return;
        await ctx.notifier.enviarEmail({
          to,
          subject: 'Incidencia con tu flete — AgroFlete',
          text:
            `El transporte de tu carga tuvo una incidencia en ruta:\n` +
            `"${p.motivo}"\n\n` +
            `Tu solicitud volvió a la cola y se está reasignando a otro vehículo. ` +
            `Te avisaremos en cuanto haya un transportista nuevo.`,
        });
        return;
      }

      case 'StockBajo': {
        const p = ev.payload as EventPayloadMap['StockBajo'];
        await ctx.notifier.enviarEmail({
          to: ctx.config.adminEmail,
          subject: `Stock bajo: ${p.cultivoNombre} en ${p.acopioNombre} — AgroFlete`,
          text:
            `El stock de ${p.cultivoNombre} en ${p.acopioNombre} bajó a ${p.cantidadActual} t, ` +
            `por debajo del umbral mínimo (${p.umbral} t).`,
        });
        return;
      }

      case 'StockAlto': {
        const p = ev.payload as EventPayloadMap['StockAlto'];
        await ctx.notifier.enviarEmail({
          to: ctx.config.adminEmail,
          subject: `Stock alto: ${p.cultivoNombre} en ${p.acopioNombre} — AgroFlete`,
          text:
            `El stock de ${p.cultivoNombre} en ${p.acopioNombre} subió a ${p.cantidadActual} t, ` +
            `por encima del umbral máximo (${p.umbral} t). El acopio está cerca de saturarse.`,
        });
        return;
      }

      case 'PagoRechazado': {
        const p = ev.payload as EventPayloadMap['PagoRechazado'];
        const to = await correoDe(ctx, p.productorId);
        if (!to) return;
        await ctx.notifier.enviarEmail({
          to,
          subject: 'Tu pago no se pudo procesar — AgroFlete',
          text:
            `No pudimos confirmar tu pago${p.motivo ? ` (${p.motivo})` : ''}.\n` +
            `Vuelve a intentarlo desde el detalle de la solicitud, con otra tarjeta o por depósito.`,
        });
        return;
      }

      case 'PagoEnRevision': {
        const p = ev.payload as EventPayloadMap['PagoEnRevision'];
        await ctx.notifier.enviarEmail({
          to: ctx.config.adminEmail,
          subject: 'Comprobante de depósito por revisar — AgroFlete',
          text:
            `Un productor registró un depósito de $${p.monto.toFixed(2)} para la solicitud ${p.solicitudId}.\n` +
            `Revísalo en el panel de Pagos para liberar la solicitud a la cola.`,
        });
        return;
      }

      case 'TransportistaCreado': {
        const p = ev.payload as EventPayloadMap['TransportistaCreado'];
        await ctx.notifier.enviarEmail({
          to: p.email,
          subject: 'Tu cuenta de transportista — AgroFlete',
          text:
            `Hola ${p.nombreCompleto},\n\n` +
            `La cooperativa creó tu cuenta de transportista en AgroFlete.\n` +
            `Usuario: ${p.email}\n` +
            `Contraseña temporal: ${p.passwordTemporal}\n\n` +
            `Inicia sesión y cámbiala desde "Mi perfil".`,
        });
        return;
      }

      default:
        return;
    }
  },
};

/** Crea los avisos in-app (campanita) para cada evento de cara al usuario. */
const notificacionesApp: Subscriber = {
  nombre: 'notificaciones-app',
  tipos: [
    'SolicitudCreada',
    'PagoAprobado',
    'PagoRechazado',
    'PagoEnRevision',
    'FleteAsignado',
    'EstadoFleteCambiado',
    'EntregaConfirmada',
    'RetrasoDetectado',
    'IncidenciaEnRuta',
    'StockBajo',
    'StockAlto',
  ],
  async handle(ev, ctx) {
    const avisos = notificacionesDe(ev);
    if (avisos.length === 0) return;

    const p = ev.payload as Record<string, unknown>;
    const idAdmin = async (): Promise<string | null> =>
      (await ctx.repos.usuarios.porEmail(ctx.config.adminEmail))?.id ?? null;

    const destinatario = async (a: AvisoPlantilla): Promise<string | null> => {
      if (a.para === 'productor') return (p['productorId'] as string) ?? null;
      if (a.para === 'transportista') return (p['transportistaId'] as string) ?? null;
      return idAdmin();
    };

    for (const a of avisos) {
      const userId = await destinatario(a);
      if (!userId) continue;
      await ctx.repos.notificaciones.crear({
        id: ctx.ids.ulid(),
        userId,
        categoria: a.categoria,
        titulo: a.titulo,
        cuerpo: a.cuerpo,
        ...(a.enlace ? { enlace: a.enlace } : {}),
        createdAt: ctx.clock.nowIso(),
      });
      await empujarAviso(ctx, userId, a);
    }
  },
};

/** Suma la carga entregada al inventario del centro de acopio. */
const actualizarStock: Subscriber = {
  nombre: 'actualizar-stock',
  tipos: ['EntregaConfirmada'],
  async handle(ev, ctx) {
    const p = ev.payload as EventPayloadMap['EntregaConfirmada'];
    await registrarMovimientoStock(ctx, {
      acopioId: p.acopioId,
      cultivo: p.cultivo,
      delta: p.pesoTon,
    });
  },
};

/**
 * Intenta asignar una solicitud a un vehículo compatible (si el emparejamiento
 * automático está activo). Se dispara al crearla y también al confirmarse el
 * pago, porque una solicitud sin pago no puede asignarse.
 */
const emparejador: Subscriber = {
  nombre: 'emparejar-automatico',
  tipos: ['SolicitudCreada', 'PagoAprobado'],
  async handle(ev, ctx) {
    const { autoEmparejar } = await ctx.repos.ajustes.obtener();
    if (!autoEmparejar) return;
    const { solicitudId } = ev.payload as { solicitudId: string };
    await emparejarAutomatico(ctx, solicitudId);
  },
};

export const subscribers: Subscriber[] = [
  notificar,
  notificacionesApp,
  actualizarStock,
  emparejador,
];
