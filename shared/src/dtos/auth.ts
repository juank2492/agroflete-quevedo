import { z } from 'zod';
import {
  codigoConfirmacionSchema,
  emailSchema,
  passwordSchema,
  telefonoSchema,
} from '../primitives.js';
import { rolRegistrableSchema, rolSchema, estadoUsuarioSchema } from '../domain.js';

export const registroRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  nombreCompleto: z.string().trim().min(3, 'Nombre demasiado corto').max(120),
  telefono: telefonoSchema,
  rol: rolRegistrableSchema,
});
export type RegistroRequest = z.infer<typeof registroRequestSchema>;

export const registroResponseSchema = z.object({
  userId: z.string(),
});
export type RegistroResponse = z.infer<typeof registroResponseSchema>;

export const confirmarRequestSchema = z.object({
  email: emailSchema,
  codigo: codigoConfirmacionSchema,
});
export type ConfirmarRequest = z.infer<typeof confirmarRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Contraseña requerida'),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const perfilPublicoSchema = z.object({
  id: z.string(),
  email: z.string(),
  nombreCompleto: z.string(),
  telefono: z.string(),
  rol: rolSchema,
  estado: estadoUsuarioSchema,
});
export type PerfilPublico = z.infer<typeof perfilPublicoSchema>;

export const loginResponseSchema = z.object({
  token: z.string(),
  perfil: perfilPublicoSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** Claims del JWT emitido por el módulo de auth local (y, más adelante, por Cognito). */
export const jwtClaimsSchema = z.object({
  sub: z.string(),
  email: z.string(),
  role: rolSchema,
  name: z.string(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type JwtClaims = z.infer<typeof jwtClaimsSchema>;
