import type { CategoriaNotif, DomainEvent, EstadoFlete, EventPayloadMap } from '@agroflete/shared';

export interface AvisoPlantilla {
  /** Destinatario del aviso. */
  para: 'productor' | 'transportista' | 'admin';
  categoria: CategoriaNotif;
  titulo: string;
  cuerpo: string;
  enlace?: string;
}

const ESTADO_TEXTO: Record<EstadoFlete, string> = {
  ASIGNADO: 'asignado',
  EN_CAMINO_ORIGEN: 'en camino al origen',
  CARGANDO: 'cargando en finca',
  EN_RUTA: 'en ruta al acopio',
  ENTREGADO: 'entregado',
  CANCELADO: 'cancelado',
  INCIDENCIA: 'con una incidencia',
};

const enlaceProductor = (solicitudId: string) => `/p/solicitudes/${solicitudId}`;

/** Traduce un evento de dominio a avisos in-app. */
export function notificacionesDe(ev: DomainEvent): AvisoPlantilla[] {
  switch (ev.tipo) {
    case 'SolicitudCreada': {
      const p = ev.payload as EventPayloadMap['SolicitudCreada'];
      return [
        {
          para: 'productor',
          categoria: 'solicitud',
          titulo: 'Solicitud recibida',
          cuerpo: `Registramos tu solicitud de ${p.cultivo}. Paga la tarifa para que se asigne.`,
          enlace: enlaceProductor(p.solicitudId),
        },
      ];
    }

    case 'PagoAprobado': {
      const p = ev.payload as EventPayloadMap['PagoAprobado'];
      return [
        {
          para: 'productor',
          categoria: 'pago',
          titulo: 'Pago confirmado',
          cuerpo: `Recibimos tu pago de $${p.monto.toFixed(2)}. Tu carga entró en la cola de asignación.`,
          enlace: enlaceProductor(p.solicitudId),
        },
      ];
    }

    case 'PagoRechazado': {
      const p = ev.payload as EventPayloadMap['PagoRechazado'];
      return [
        {
          para: 'productor',
          categoria: 'pago',
          titulo: 'Pago rechazado',
          cuerpo: `No se pudo confirmar tu pago${p.motivo ? ` (${p.motivo})` : ''}. Intenta de nuevo.`,
          enlace: enlaceProductor(p.solicitudId),
        },
      ];
    }

    case 'PagoEnRevision': {
      const p = ev.payload as EventPayloadMap['PagoEnRevision'];
      return [
        {
          para: 'admin',
          categoria: 'pago',
          titulo: 'Comprobante por revisar',
          cuerpo: `Un productor registró un depósito de $${p.monto.toFixed(2)}.`,
          enlace: '/a/pagos',
        },
      ];
    }

    case 'FleteAsignado': {
      const p = ev.payload as EventPayloadMap['FleteAsignado'];
      return [
        {
          para: 'productor',
          categoria: 'flete',
          titulo: 'Transportista asignado',
          cuerpo: p.auto
            ? 'El sistema asignó automáticamente un transportista a tu carga.'
            : 'Ya hay un transportista asignado a tu carga.',
          enlace: enlaceProductor(p.solicitudId),
        },
        {
          para: 'transportista',
          categoria: 'flete',
          titulo: 'Nuevo flete asignado',
          cuerpo: 'Revisa los detalles y actualiza el estado del viaje.',
          enlace: '/t/fletes',
        },
      ];
    }

    case 'EstadoFleteCambiado': {
      const p = ev.payload as EventPayloadMap['EstadoFleteCambiado'];
      if (p.estado === 'ENTREGADO') return [];
      return [
        {
          para: 'productor',
          categoria: p.estado === 'CANCELADO' ? 'incidencia' : 'flete',
          titulo: `Flete ${ESTADO_TEXTO[p.estado]}`,
          cuerpo:
            `Tu flete pasó a: ${ESTADO_TEXTO[p.estado]}.` +
            (p.motivo ? ` Motivo: "${p.motivo}".` : ''),
          enlace: enlaceProductor(p.solicitudId),
        },
      ];
    }

    case 'EntregaConfirmada': {
      const p = ev.payload as EventPayloadMap['EntregaConfirmada'];
      return [
        {
          para: 'productor',
          categoria: 'flete',
          titulo: 'Carga entregada',
          cuerpo: 'Tu carga llegó al centro de acopio. ¡Gracias por usar AgroFlete!',
          enlace: enlaceProductor(p.solicitudId),
        },
      ];
    }

    case 'RetrasoDetectado': {
      const p = ev.payload as EventPayloadMap['RetrasoDetectado'];
      return [
        {
          para: 'productor',
          categoria: 'solicitud',
          titulo: 'Tu solicitud lleva tiempo sin asignar',
          cuerpo: `Van ${p.horasEspera} h esperando transportista. Seguimos buscando.`,
          enlace: enlaceProductor(p.solicitudId),
        },
      ];
    }

    case 'IncidenciaEnRuta': {
      const p = ev.payload as EventPayloadMap['IncidenciaEnRuta'];
      return [
        {
          para: 'productor',
          categoria: 'incidencia',
          titulo: 'Incidencia con tu flete',
          cuerpo: `"${p.motivo}". Tu carga volvió a la cola y se reasignará.`,
          enlace: enlaceProductor(p.solicitudId),
        },
      ];
    }

    case 'StockBajo':
    case 'StockAlto': {
      const p = ev.payload as EventPayloadMap['StockBajo'];
      const bajo = ev.tipo === 'StockBajo';
      return [
        {
          para: 'admin',
          categoria: 'sistema',
          titulo: `Stock ${bajo ? 'bajo' : 'alto'}: ${p.cultivoNombre}`,
          cuerpo: `${p.acopioNombre} está en ${p.cantidadActual} t (umbral ${p.umbral} t).`,
          enlace: '/a/inventario',
        },
      ];
    }

    default:
      return [];
  }
}
