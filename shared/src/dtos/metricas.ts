import { z } from 'zod';
import { ESTADOS_FLETE, ESTADOS_SOLICITUD } from '../domain.js';

export const puntoSerieDiaSchema = z.object({
  /** Fecha en formato YYYY-MM-DD. */
  fecha: z.string(),
  cantidad: z.number(),
});
export type PuntoSerieDia = z.infer<typeof puntoSerieDiaSchema>;

export const conteoCultivoSchema = z.object({
  cultivo: z.string(),
  cantidad: z.number(),
});
export type ConteoCultivo = z.infer<typeof conteoCultivoSchema>;

export const metricasOperativasSchema = z.object({
  /** Horas promedio entre creación de la solicitud y su asignación a un flete. */
  tiempoMedioAsignacionH: z.number(),
  /** Porcentaje de solicitudes que esperaron más de 6 h sin asignación. */
  pctEsperaMayor6h: z.number(),
  /** Conteo de fletes por estado. */
  fletesPorEstado: z.record(z.enum(ESTADOS_FLETE), z.number()),
  /** Conteo de solicitudes por estado. */
  solicitudesPorEstado: z.record(z.enum(ESTADOS_SOLICITUD), z.number()),
  /** Solicitudes por cultivo, de mayor a menor. */
  solicitudesPorCultivo: z.array(conteoCultivoSchema),
  /** Solicitudes creadas por día en los últimos 14 días (más antiguo primero). */
  solicitudesPorDia: z.array(puntoSerieDiaSchema),
  /** Entregas confirmadas por día en los últimos 14 días. */
  entregasPorDia: z.array(puntoSerieDiaSchema),
  /** Tarifa promedio de los fletes registrados. */
  tarifaMedia: z.number(),
  /** Solicitudes actualmente pendientes. */
  solicitudesPendientes: z.number(),
  /** Nº de alertas de retraso emitidas. */
  retrasosDetectados: z.number(),
});
export type MetricasOperativas = z.infer<typeof metricasOperativasSchema>;
