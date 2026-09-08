import { z } from 'zod';
import { estadoFleteSchema } from '../domain.js';
import { idSchema, isoDateSchema, latLonSchema } from '../primitives.js';

export const asignarFleteRequestSchema = z.object({
  solicitudId: idSchema,
  vehiculoId: idSchema,
});
export type AsignarFleteRequest = z.infer<typeof asignarFleteRequestSchema>;

export const reasignarFleteRequestSchema = z.object({
  vehiculoId: idSchema,
});
export type ReasignarFleteRequest = z.infer<typeof reasignarFleteRequestSchema>;

export const cambiarEstadoFleteRequestSchema = z.object({
  nuevoEstado: estadoFleteSchema,
  /** Obligatorio cuando un transportista cancela un flete asignado. */
  motivo: z.string().trim().min(3, 'Describe brevemente el motivo').max(300).optional(),
});
export type CambiarEstadoFleteRequest = z.infer<typeof cambiarEstadoFleteRequestSchema>;

/** `leve`: el vehículo sigue el viaje. `grave`: la carga vuelve a la cola. */
export const gravedadIncidenciaSchema = z.enum(['leve', 'grave']);
export type GravedadIncidencia = z.infer<typeof gravedadIncidenciaSchema>;

export const registrarIncidenciaRequestSchema = z.object({
  motivo: z.string().trim().min(3, 'Describe brevemente la incidencia').max(300),
  gravedad: gravedadIncidenciaSchema,
  /** Solo aplica a incidencias graves. */
  vehiculoFueraDeServicio: z.boolean(),
});
export type RegistrarIncidenciaRequest = z.infer<typeof registrarIncidenciaRequestSchema>;

export const incidenciaFleteSchema = z.object({
  motivo: z.string(),
  ts: isoDateSchema,
  vehiculoFueraDeServicio: z.boolean(),
  /** Ausente en incidencias antiguas (se asumen graves). */
  gravedad: gravedadIncidenciaSchema.optional(),
});
export type IncidenciaFlete = z.infer<typeof incidenciaFleteSchema>;

export const eventoTimelineSchema = z.object({
  estado: estadoFleteSchema,
  ts: isoDateSchema,
  actorId: z.string(),
  motivo: z.string().optional(),
});
export type EventoTimeline = z.infer<typeof eventoTimelineSchema>;

export const ubicacionFleteSchema = latLonSchema.extend({
  ts: isoDateSchema,
  /** Velocidad en km/h. */
  velocidad: z.number().nonnegative().max(300).optional(),
});
export type UbicacionFlete = z.infer<typeof ubicacionFleteSchema>;

export const registrarUbicacionRequestSchema = latLonSchema.extend({
  velocidad: z.number().nonnegative().max(300).optional(),
});
export type RegistrarUbicacionRequest = z.infer<typeof registrarUbicacionRequestSchema>;

export const registrarUbicacionResponseSchema = z.object({
  punto: ubicacionFleteSchema,
  /** Indica si la geocerca confirmó la entrega. */
  entregaDetectada: z.boolean(),
});
export type RegistrarUbicacionResponse = z.infer<typeof registrarUbicacionResponseSchema>;

export const rutaFleteSchema = z.array(ubicacionFleteSchema);
export type RutaFlete = z.infer<typeof rutaFleteSchema>;

export const fleteSchema = z.object({
  id: z.string(),
  solicitudId: z.string(),
  vehiculoId: z.string(),
  transportistaId: z.string(),
  productorId: z.string(),
  /** Datos opcionales para compatibilidad con fletes antiguos. */
  origen: latLonSchema.optional(),
  origenNombre: z.string().optional(),
  destino: latLonSchema.optional(),
  cultivoNombre: z.string().optional(),
  pesoTon: z.number().optional(),
  acopioNombre: z.string().optional(),
  transportistaNombre: z.string().optional(),
  productorNombre: z.string().optional(),
  vehiculoPlaca: z.string().optional(),
  tarifa: z.number(),
  estado: estadoFleteSchema,
  timeline: z.array(eventoTimelineSchema),
  createdAt: isoDateSchema,
  incidencia: incidenciaFleteSchema.optional(),
  motivoCancelacion: z.string().optional(),
  auto: z.boolean().optional(),
  ultimaUbicacion: ubicacionFleteSchema.optional(),
  /** Ruta vial denormalizada para pintar el mapa sin recalcularla. */
  rutaVial: z.array(latLonSchema).optional(),
  /** Distancia vial en km. */
  distanciaVialKm: z.number().optional(),
  /** Duración estimada en minutos. */
  duracionEstimadaMin: z.number().optional(),
  /** Indica si la ruta es el respaldo en línea recta. */
  rutaAproximada: z.boolean().optional(),
});
export type Flete = z.infer<typeof fleteSchema>;

export const listarFletesQuerySchema = z.object({
  estado: estadoFleteSchema.optional(),
});
export type ListarFletesQuery = z.infer<typeof listarFletesQuerySchema>;
