import { z } from 'zod';
import { estadoFleteSchema } from '../domain.js';
import { idSchema, isoDateSchema } from '../primitives.js';

export const asignarFleteRequestSchema = z.object({
  solicitudId: idSchema,
  vehiculoId: idSchema,
});
export type AsignarFleteRequest = z.infer<typeof asignarFleteRequestSchema>;

export const cambiarEstadoFleteRequestSchema = z.object({
  nuevoEstado: estadoFleteSchema,
});
export type CambiarEstadoFleteRequest = z.infer<typeof cambiarEstadoFleteRequestSchema>;

export const eventoTimelineSchema = z.object({
  estado: estadoFleteSchema,
  ts: isoDateSchema,
  actorId: z.string(),
});
export type EventoTimeline = z.infer<typeof eventoTimelineSchema>;

export const fleteSchema = z.object({
  id: z.string(),
  solicitudId: z.string(),
  vehiculoId: z.string(),
  transportistaId: z.string(),
  productorId: z.string(),
  tarifa: z.number(),
  estado: estadoFleteSchema,
  timeline: z.array(eventoTimelineSchema),
  createdAt: isoDateSchema,
});
export type Flete = z.infer<typeof fleteSchema>;

export const listarFletesQuerySchema = z.object({
  estado: estadoFleteSchema.optional(),
});
export type ListarFletesQuery = z.infer<typeof listarFletesQuerySchema>;
