import { z } from 'zod';
import { cultivoSchema } from '../domain.js';
import { idSchema, latLonSchema } from '../primitives.js';

const rangoMesSchema = z
  .tuple([z.number().int().min(1).max(12), z.number().int().min(1).max(12)])
  .refine(([ini, fin]) => ini <= fin, 'El mes inicial debe ser <= al final');

export const reglasTarifaSchema = z.object({
  /** USD por kilómetro recorrido. */
  tarifaBaseKm: z.number().positive().max(50),
  /** Multiplicador para maíz. */
  factorMaiz: z.number().min(0.5).max(3),
  /** Multiplicador para banano (carga más delicada/voluminosa). */
  factorBanano: z.number().min(0.5).max(3),
  /** Recargo fraccionario aplicado en temporada de cosecha (0.2 = +20%). */
  recargoTemporada: z.number().min(0).max(1),
  /** Corrección de distancia geodésica -> vial. */
  factorSinuosidad: z.number().min(1).max(2),
  /** Meses de cosecha por cultivo (rangos [ini, fin] inclusive). */
  temporadas: z.object({
    maiz: z.array(rangoMesSchema).max(6),
    banano: z.array(rangoMesSchema).max(6),
  }),
});
export type ReglasTarifa = z.infer<typeof reglasTarifaSchema>;

export const REGLAS_TARIFA_DEFAULT: ReglasTarifa = {
  tarifaBaseKm: 0.9,
  factorMaiz: 1.0,
  factorBanano: 1.15,
  recargoTemporada: 0.2,
  factorSinuosidad: 1.3,
  temporadas: {
    maiz: [
      [4, 6],
      [10, 12],
    ],
    banano: [[1, 3]],
  },
};

/** Actualización parcial de reglas (PUT /tarifas/reglas). */
export const actualizarReglasRequestSchema = reglasTarifaSchema.partial();
export type ActualizarReglasRequest = z.infer<typeof actualizarReglasRequestSchema>;

export const estimacionTarifaRequestSchema = z.object({
  origen: latLonSchema,
  acopioId: idSchema,
  cultivo: cultivoSchema,
});
export type EstimacionTarifaRequest = z.infer<typeof estimacionTarifaRequestSchema>;

export const estimacionTarifaResponseSchema = z.object({
  distanciaKm: z.number(),
  tarifa: z.number(),
  enTemporada: z.boolean(),
});
export type EstimacionTarifaResponse = z.infer<typeof estimacionTarifaResponseSchema>;
