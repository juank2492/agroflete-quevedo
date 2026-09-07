import { z } from 'zod';
import { cultivoSchema } from '../domain.js';
import { idSchema, latLonSchema } from '../primitives.js';

const rangoMesSchema = z
  .tuple([z.number().int().min(1).max(12), z.number().int().min(1).max(12)])
  .refine(([ini, fin]) => ini <= fin, 'El mes inicial debe ser <= al final');

/** Regla de tarifa para un cultivo. */
export const cultivoTarifaSchema = z.object({
  clave: cultivoSchema,
  nombre: z.string().trim().min(2, 'Nombre demasiado corto').max(40),
  factor: z.number().min(0.5).max(3),
  temporadas: z.array(rangoMesSchema).max(6),
  /** Los cultivos referenciados se desactivan en vez de borrarse. */
  activo: z.boolean().optional(),
});
export type CultivoTarifa = z.infer<typeof cultivoTarifaSchema>;

export const reglasTarifaSchema = z.object({
  tarifaBaseKm: z.number().positive().max(50),
  recargoTemporada: z.number().min(0).max(1),
  factorSinuosidad: z.number().min(1).max(2),
  cultivos: z
    .array(cultivoTarifaSchema)
    .min(1, 'Debe haber al menos un cultivo')
    .max(20)
    .refine(
      (cs) => new Set(cs.map((c) => c.clave)).size === cs.length,
      'Hay claves de cultivo repetidas',
    ),
});
export type ReglasTarifa = z.infer<typeof reglasTarifaSchema>;

export const REGLAS_TARIFA_DEFAULT: ReglasTarifa = {
  tarifaBaseKm: 0.9,
  recargoTemporada: 0.2,
  factorSinuosidad: 1.3,
  cultivos: [
    {
      clave: 'maiz',
      nombre: 'Maíz',
      factor: 1.0,
      temporadas: [
        [4, 6],
        [10, 12],
      ],
      activo: true,
    },
    { clave: 'banano', nombre: 'Banano', factor: 1.15, temporadas: [[1, 3]], activo: true },
  ],
};

export function claveDesdeNombre(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

/** Actualiza las reglas; el catálogo se reemplaza completo. */
export const actualizarReglasRequestSchema = reglasTarifaSchema.partial();
export type ActualizarReglasRequest = z.infer<typeof actualizarReglasRequestSchema>;

/** Devuelve el catálogo para el selector del productor. */
export const cultivoOpcionSchema = z.object({ clave: z.string(), nombre: z.string() });
export type CultivoOpcion = z.infer<typeof cultivoOpcionSchema>;

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
