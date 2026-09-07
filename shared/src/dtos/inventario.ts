import { z } from 'zod';
import { cultivoSchema, zonaSchema } from '../domain.js';
import { idSchema } from '../primitives.js';

export const ESTADOS_STOCK = ['BAJO', 'OK', 'ALTO'] as const;
export const estadoStockSchema = z.enum(ESTADOS_STOCK);
export type EstadoStock = z.infer<typeof estadoStockSchema>;

export const stockCultivoSchema = z.object({
  cultivo: z.string(),
  cultivoNombre: z.string(),
  cantidadActual: z.number(),
  umbralMinimo: z.number(),
  umbralMaximo: z.number(),
  estado: estadoStockSchema,
});
export type StockCultivo = z.infer<typeof stockCultivoSchema>;

export const inventarioAcopioSchema = z.object({
  acopioId: z.string(),
  acopioNombre: z.string(),
  zona: zonaSchema,
  stock: z.array(stockCultivoSchema),
});
export type InventarioAcopio = z.infer<typeof inventarioAcopioSchema>;

export const fijarUmbralesRequestSchema = z
  .object({
    umbralMinimo: z.number().min(0).max(100_000),
    umbralMaximo: z.number().min(0).max(100_000),
  })
  .refine((v) => v.umbralMinimo <= v.umbralMaximo, {
    message: 'El umbral mínimo debe ser <= al máximo',
  });
export type FijarUmbralesRequest = z.infer<typeof fijarUmbralesRequestSchema>;

export const ajustarStockRequestSchema = z.object({
  delta: z.number().refine((n) => n !== 0, 'El ajuste no puede ser 0'),
  motivo: z.string().trim().min(3, 'Indica el motivo').max(200),
});
export type AjustarStockRequest = z.infer<typeof ajustarStockRequestSchema>;

export const stockParamsSchema = z.object({ id: idSchema, cultivo: cultivoSchema });
