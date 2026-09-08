import { z } from 'zod';
import { cultivoSchema, estadoSolicitudSchema, zonaSchema } from '../domain.js';
import { idSchema, isoDateSchema, latLonSchema, toneladasSchema } from '../primitives.js';
import { pagoSolicitudSchema, type PagoSolicitud } from './pago.js';
import { tipoVehiculoSchema } from './vehiculo.js';

export const crearSolicitudRequestSchema = z.object({
  origen: latLonSchema,
  /** Nombre del punto de recogida, si se eligió por dirección. */
  origenNombre: z.string().trim().max(120).optional(),
  acopioId: idSchema,
  cultivo: cultivoSchema,
  pesoTon: toneladasSchema,
  /**
   * Clave única generada por el cliente. Permite reintentar el envío (p. ej. tras
   * recuperar la conexión) sin duplicar la solicitud: si ya existe una con esta
   * clave para el productor, el servidor devuelve esa misma.
   */
  idempotencyKey: z.string().uuid().optional(),
});
export type CrearSolicitudRequest = z.infer<typeof crearSolicitudRequestSchema>;

export const solicitudSchema = z.object({
  id: z.string(),
  productorId: z.string(),
  origen: latLonSchema,
  origenNombre: z.string().optional(),
  acopioId: z.string(),
  acopioNombre: z.string(),
  /** Coordenadas del acopio para el mapa del flete. */
  acopioLat: z.number(),
  acopioLon: z.number(),
  cultivo: cultivoSchema,
  /** Nombre del cultivo guardado al crear la solicitud. */
  cultivoNombre: z.string(),
  pesoTon: z.number(),
  /** Tipo de vehículo que corresponde al peso (fija la tarifa por categoría). */
  categoriaCarga: tipoVehiculoSchema.optional(),
  zona: zonaSchema,
  distanciaKm: z.number(),
  tarifaEstimada: z.number(),
  estado: estadoSolicitudSchema,
  fleteId: z.string().optional(),
  createdAt: isoDateSchema,
  /** Clave de idempotencia con la que se creó (si el cliente la envió). */
  idempotencyKey: z.string().optional(),
  /** Estado del pago de la tarifa. Opcional por compatibilidad con datos previos. */
  pago: pagoSolicitudSchema.optional(),
  /** Interno: evita reenviar la alerta de retraso (DetectarRetrasos). */
  retrasoNotificado: z.boolean().optional(),
  /** La solicitud volvió a la cola porque su flete tuvo una incidencia en ruta. */
  reasignacionPorIncidencia: z.boolean().optional(),
  motivoIncidencia: z.string().optional(),
});
export type Solicitud = z.infer<typeof solicitudSchema>;

export const listarSolicitudesQuerySchema = z.object({
  estado: estadoSolicitudSchema.optional(),
});
export type ListarSolicitudesQuery = z.infer<typeof listarSolicitudesQuerySchema>;

/** Pago de una solicitud, con valor por defecto para datos sin `pago`. */
export function pagoDe(s: Pick<Solicitud, 'pago' | 'createdAt'>): PagoSolicitud {
  return s.pago ?? { estado: 'PENDIENTE', actualizadoEn: s.createdAt };
}

export function pagoConfirmado(s: Pick<Solicitud, 'pago' | 'createdAt'>): boolean {
  return pagoDe(s).estado === 'PAGADO';
}
