import { z } from 'zod';
import { estadoVehiculoSchema, zonaSchema } from '../domain.js';
import { placaSchema, toneladasSchema } from '../primitives.js';

export const TIPOS_VEHICULO = ['camion', 'camion-tolva', 'furgon', 'plataforma'] as const;
export const tipoVehiculoSchema = z.enum(TIPOS_VEHICULO);
export type TipoVehiculo = z.infer<typeof tipoVehiculoSchema>;

export const registrarVehiculoRequestSchema = z.object({
  placa: placaSchema,
  tipo: tipoVehiculoSchema,
  capacidadTon: toneladasSchema,
  zona: zonaSchema,
});
export type RegistrarVehiculoRequest = z.infer<typeof registrarVehiculoRequestSchema>;

export const actualizarVehiculoRequestSchema = z.object({
  tipo: tipoVehiculoSchema.optional(),
  capacidadTon: toneladasSchema.optional(),
  zona: zonaSchema.optional(),
  /** Solo se permite alternar DISPONIBLE <-> INACTIVO. */
  estado: z.enum(['DISPONIBLE', 'INACTIVO']).optional(),
});
export type ActualizarVehiculoRequest = z.infer<typeof actualizarVehiculoRequestSchema>;

export const vehiculoSchema = z.object({
  id: z.string(),
  transportistaId: z.string(),
  placa: z.string(),
  tipo: tipoVehiculoSchema,
  capacidadTon: z.number(),
  zona: zonaSchema,
  estado: estadoVehiculoSchema,
});
export type Vehiculo = z.infer<typeof vehiculoSchema>;
