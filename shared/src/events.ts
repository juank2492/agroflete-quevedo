import { z } from 'zod';
import { cultivoSchema, estadoFleteSchema, tipoEventoSchema } from './domain.js';

/** Contratos de eventos de dominio validados por sus esquemas. */
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
    auto: z.boolean().optional(),
  }),
  EstadoFleteCambiado: z.object({
    fleteId: z.string(),
    solicitudId: z.string(),
    productorId: z.string(),
    transportistaId: z.string(),
    estado: estadoFleteSchema,
    motivo: z.string().optional(),
  }),
  EntregaConfirmada: z.object({
    fleteId: z.string(),
    solicitudId: z.string(),
    productorId: z.string(),
    transportistaId: z.string(),
    acopioId: z.string(),
    cultivo: z.string(),
    pesoTon: z.number(),
  }),
  RetrasoDetectado: z.object({
    solicitudId: z.string(),
    productorId: z.string(),
    horasEspera: z.number(),
  }),
  IncidenciaEnRuta: z.object({
    fleteId: z.string(),
    solicitudId: z.string(),
    productorId: z.string(),
    transportistaId: z.string(),
    motivo: z.string(),
  }),
  StockBajo: z.object({
    acopioId: z.string(),
    acopioNombre: z.string(),
    cultivo: z.string(),
    cultivoNombre: z.string(),
    cantidadActual: z.number(),
    umbral: z.number(),
  }),
  StockAlto: z.object({
    acopioId: z.string(),
    acopioNombre: z.string(),
    cultivo: z.string(),
    cultivoNombre: z.string(),
    cantidadActual: z.number(),
    umbral: z.number(),
  }),
  TransportistaCreado: z.object({
    userId: z.string(),
    email: z.string(),
    nombreCompleto: z.string(),
    passwordTemporal: z.string(),
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
