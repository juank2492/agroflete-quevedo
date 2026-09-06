import { z } from 'zod';
import { cultivoSchema, estadoSolicitudSchema, zonaSchema } from '../domain.js';
import { idSchema, isoDateSchema, latLonSchema, toneladasSchema } from '../primitives.js';

export const crearSolicitudRequestSchema = z.object({
  origen: latLonSchema,
  acopioId: idSchema,
  cultivo: cultivoSchema,
  pesoTon: toneladasSchema,
});
export type CrearSolicitudRequest = z.infer<typeof crearSolicitudRequestSchema>;

export const solicitudSchema = z.object({
  id: z.string(),
  productorId: z.string(),
  origen: latLonSchema,
  acopioId: z.string(),
  acopioNombre: z.string(),
  cultivo: cultivoSchema,
  pesoTon: z.number(),
  zona: zonaSchema,
  distanciaKm: z.number(),
  tarifaEstimada: z.number(),
  estado: estadoSolicitudSchema,
  fleteId: z.string().optional(),
  createdAt: isoDateSchema,
  /** Interno: evita reenviar la alerta de retraso (DetectarRetrasos). */
  retrasoNotificado: z.boolean().optional(),
});
export type Solicitud = z.infer<typeof solicitudSchema>;

export const listarSolicitudesQuerySchema = z.object({
  estado: estadoSolicitudSchema.optional(),
});
export type ListarSolicitudesQuery = z.infer<typeof listarSolicitudesQuerySchema>;
