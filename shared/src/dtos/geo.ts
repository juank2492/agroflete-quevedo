import { z } from 'zod';
import { latLonSchema } from '../primitives.js';

/** Resultado normalizado del buscador de lugares. */
export const lugarGeocodificadoSchema = latLonSchema.extend({
  nombre: z.string(),
  etiqueta: z.string(),
  tipo: z.string(),
  /** Distancia a Quevedo, en km. */
  distanciaKm: z.number(),
});
export type LugarGeocodificado = z.infer<typeof lugarGeocodificadoSchema>;

export const buscarLugaresQuerySchema = z.object({
  q: z.string().trim().min(3, 'Escribe al menos 3 caracteres').max(120),
});
export type BuscarLugaresQuery = z.infer<typeof buscarLugaresQuerySchema>;

export const buscarLugaresResponseSchema = z.array(lugarGeocodificadoSchema);
export type BuscarLugaresResponse = z.infer<typeof buscarLugaresResponseSchema>;

/** Ruta por carretera devuelta por el backend. */
export const rutaVialQuerySchema = z.object({
  olat: z.coerce.number(),
  olon: z.coerce.number(),
  dlat: z.coerce.number(),
  dlon: z.coerce.number(),
});
export type RutaVialQuery = z.infer<typeof rutaVialQuerySchema>;

export const rutaVialSchema = z.object({
  geometria: z.array(latLonSchema),
  distanciaKm: z.number(),
  duracionMin: z.number(),
  aproximada: z.boolean(),
});
export type RutaVialDTO = z.infer<typeof rutaVialSchema>;
