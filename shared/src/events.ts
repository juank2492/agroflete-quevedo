import { z } from 'zod';
import { cultivoSchema, estadoFleteSchema, tipoEventoSchema } from './domain.js';

/**
 * Contratos de los eventos de dominio que viajan por el outbox (local) y, más
 * adelante, por EventBridge. El `payload` se valida con estos esquemas.
 */
export const eventPayloadSchemas = {
  UsuarioRegistrado: z.object({
    userId: z.string(),
    email: z.string(),
    nombreCompleto: z.string(),
    codigo: z.string(),
  }),
  ReglasTarifaActualizadas: z.object({
    actorId: z.string(),
  }),
  SolicitudCreada: z.object({
    solicitudId: z.string(),
    productorId: z.string(),
    cultivo: cultivoSchema,
    tarifaEstimada: z.number(),
  }),
  FleteAsignado: z.object({
    fleteId: z.string(),
    solicitudId: z.string(),
    productorId: z.string(),
    transportistaId: z.string(),
  }),
  EstadoFleteCambiado: z.object({
    fleteId: z.string(),
    solicitudId: z.string(),
    productorId: z.string(),
    transportistaId: z.string(),
    estado: estadoFleteSchema,
  }),
  EntregaConfirmada: z.object({
    fleteId: z.string(),
    solicitudId: z.string(),
    productorId: z.string(),
    transportistaId: z.string(),
  }),
  RetrasoDetectado: z.object({
    solicitudId: z.string(),
    productorId: z.string(),
    horasEspera: z.number(),
  }),
} as const;

export type EventPayloadMap = {
  [K in keyof typeof eventPayloadSchemas]: z.infer<(typeof eventPayloadSchemas)[K]>;
};

export interface DomainEvent<K extends keyof EventPayloadMap = keyof EventPayloadMap> {
  id: string;
  tipo: K;
  payload: EventPayloadMap[K];
  createdAt: string;
}

export const domainEventEnvelopeSchema = z.object({
  id: z.string(),
  tipo: tipoEventoSchema,
  payload: z.unknown(),
  createdAt: z.string(),
});
