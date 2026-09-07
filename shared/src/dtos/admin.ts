import { z } from 'zod';
import { emailSchema, idSchema, telefonoSchema } from '../primitives.js';
import { perfilPublicoSchema } from './auth.js';
import { registrarVehiculoRequestSchema } from './vehiculo.js';

export const crearTransportistaRequestSchema = z.object({
  nombreCompleto: z.string().trim().min(3, 'Nombre demasiado corto').max(120),
  email: emailSchema,
  telefono: telefonoSchema,
});
export type CrearTransportistaRequest = z.infer<typeof crearTransportistaRequestSchema>;

export const crearTransportistaResponseSchema = z.object({
  perfil: perfilPublicoSchema,
  passwordTemporal: z.string(),
});
export type CrearTransportistaResponse = z.infer<typeof crearTransportistaResponseSchema>;

export const actualizarTransportistaRequestSchema = z.object({
  activo: z.boolean(),
});
export type ActualizarTransportistaRequest = z.infer<typeof actualizarTransportistaRequestSchema>;

export const crearVehiculoAdminRequestSchema = registrarVehiculoRequestSchema.extend({
  transportistaId: idSchema,
});
export type CrearVehiculoAdminRequest = z.infer<typeof crearVehiculoAdminRequestSchema>;
