import { z } from 'zod';
import { ESTADOS_FLETE } from '../domain.js';

export const metricasOperativasSchema = z.object({
  /** Horas promedio entre creación de la solicitud y su asignación a un flete. */
  tiempoMedioAsignacionH: z.number(),
  /** Porcentaje de solicitudes que esperaron más de 6 h sin asignación. */
  pctEsperaMayor6h: z.number(),
  /** Conteo de fletes por estado. */
  fletesPorEstado: z.record(z.enum(ESTADOS_FLETE), z.number()),
  /** Tarifa promedio de los fletes registrados. */
  tarifaMedia: z.number(),
  /** Solicitudes actualmente pendientes. */
  solicitudesPendientes: z.number(),
  /** Nº de alertas de retraso emitidas. */
  retrasosDetectados: z.number(),
});
export type MetricasOperativas = z.infer<typeof metricasOperativasSchema>;
