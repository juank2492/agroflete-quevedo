import { z } from 'zod';
import { cultivoSchema, estadoSolicitudSchema, zonaSchema } from '../domain.js';
import { idSchema, isoDateSchema, latLonSchema, toneladasSchema } from '../primitives.js';

export const crearSolicitudRequestSchema = z.object({
  origen: latLonSchema,
  /** Nombre del punto de recogida, si se eligió por dirección. */
  origenNombre: z.string().trim().max(120).optional(),
  acopioId: idSchema,
  cultivo: cultivoSchema,
  pesoTon: toneladasSchema,
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
  zona: zonaSchema,
  distanciaKm: z.number(),
  tarifaEstimada: z.number(),
  estado: estadoSolicitudSchema,
  fleteId: z.string().optional(),
  createdAt: isoDateSchema,
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
