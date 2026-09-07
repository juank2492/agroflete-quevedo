import type { DomainEvent, EstadoFlete, EventPayloadMap, TipoEvento } from '@agroflete/shared';
import type { AppContext } from '../../core/app-context.js';
import { emparejarAutomatico } from '../../core/application/despacho/emparejar-automatico.js';
import { registrarMovimientoStock } from '../../core/application/inventario/movimiento-stock.js';

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
    'IncidenciaEnRuta',
    'StockBajo',
    'StockAlto',
    'TransportistaCreado',
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
            text: p.auto
              ? `El sistema asignó automáticamente un transportista a tu solicitud. ` +
                `Podrás seguir el estado del flete desde tu panel.`
              : `Tu solicitud ya tiene transportista asignado. Podrás seguir el estado del flete desde tu panel.`,
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
        if (p.estado === 'ENTREGADO') return;
        const to = await correoDe(ctx, p.productorId);
        if (!to) return;
        await ctx.notifier.enviarEmail({
          to,
          subject: `Tu flete cambió de estado — AgroFlete`,
          text:
            `Tu flete pasó a: ${ESTADO_LABEL[p.estado]}.` +
            (p.motivo ? `\nMotivo: "${p.motivo}"` : '') +
            (p.estado === 'CANCELADO'
              ? `\n\nTu solicitud volvió a la cola y se reasignará a otro vehículo.`
              : ''),
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

/** Intenta asignar cada solicitud nueva a un vehículo compatible (si está activo). */
const emparejador: Subscriber = {
  nombre: 'emparejar-automatico',
  tipos: ['SolicitudCreada'],
  async handle(ev, ctx) {
    const p = ev.payload as EventPayloadMap['SolicitudCreada'];
    const { autoEmparejar } = await ctx.repos.ajustes.obtener();
    if (!autoEmparejar) return;
    await emparejarAutomatico(ctx, p.solicitudId);
  },
};

export const subscribers: Subscriber[] = [notificar, actualizarStock, emparejador];
