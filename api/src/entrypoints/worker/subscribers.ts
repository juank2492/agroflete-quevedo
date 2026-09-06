import type { DomainEvent, EstadoFlete, EventPayloadMap, TipoEvento } from '@agroflete/shared';
import type { AppContext } from '../../core/app-context.js';

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
};

async function correoDe(ctx: AppContext, userId: string): Promise<string | null> {
  const u = await ctx.repos.usuarios.porId(userId);
  return u?.email ?? null;
}

/** Envía correos (a Mailpit en local) según el tipo de evento. */
const notificar: Subscriber = {
  nombre: 'notificar',
  tipos: [
    'UsuarioRegistrado',
    'SolicitudCreada',
    'FleteAsignado',
    'EstadoFleteCambiado',
    'EntregaConfirmada',
    'RetrasoDetectado',
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

      case 'SolicitudCreada': {
        const p = ev.payload as EventPayloadMap['SolicitudCreada'];
        const to = await correoDe(ctx, p.productorId);
        if (!to) return;
        await ctx.notifier.enviarEmail({
          to,
          subject: 'Solicitud recibida — AgroFlete',
          text:
            `Recibimos tu solicitud de flete (${p.cultivo}).\n` +
            `Tarifa estimada: $${p.tarifaEstimada.toFixed(2)}.\n\n` +
            `Te avisaremos cuando se asigne un transportista.`,
        });
        return;
      }

      case 'FleteAsignado': {
        const p = ev.payload as EventPayloadMap['FleteAsignado'];
        const [prodEmail, transEmail] = await Promise.all([
          correoDe(ctx, p.productorId),
          correoDe(ctx, p.transportistaId),
        ]);
        if (prodEmail) {
          await ctx.notifier.enviarEmail({
            to: prodEmail,
            subject: 'Se asignó un transportista a tu carga — AgroFlete',
            text: `Tu solicitud ya tiene transportista asignado. Podrás seguir el estado del flete desde tu panel.`,
          });
        }
        if (transEmail) {
          await ctx.notifier.enviarEmail({
            to: transEmail,
            subject: 'Nuevo flete asignado — AgroFlete',
            text: `Se te asignó un nuevo flete. Revisa los detalles en "Mis fletes" y actualiza el estado del viaje.`,
          });
        }
        return;
      }

      case 'EstadoFleteCambiado': {
        const p = ev.payload as EventPayloadMap['EstadoFleteCambiado'];
        if (p.estado === 'ENTREGADO') return; // lo cubre EntregaConfirmada
        const to = await correoDe(ctx, p.productorId);
        if (!to) return;
        await ctx.notifier.enviarEmail({
          to,
          subject: `Tu flete cambió de estado — AgroFlete`,
          text: `Tu flete pasó a: ${ESTADO_LABEL[p.estado]}.`,
        });
        return;
      }

      case 'EntregaConfirmada': {
        const p = ev.payload as EventPayloadMap['EntregaConfirmada'];
        const to = await correoDe(ctx, p.productorId);
        if (!to) return;
        await ctx.notifier.enviarEmail({
          to,
          subject: 'Carga entregada — AgroFlete',
          text: `Tu carga fue entregada en el centro de acopio. ¡Gracias por usar AgroFlete!`,
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

      default:
        return;
    }
  },
};

export const subscribers: Subscriber[] = [notificar];
