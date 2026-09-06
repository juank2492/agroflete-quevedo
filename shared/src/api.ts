import { z } from 'zod';

/** Códigos de error estables que el frontend puede mapear a mensajes/acciones. */
export const ERROR_CODES = [
  'VALIDATION',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const apiErrorSchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export interface ApiOk<T> {
  data: T;
}
export interface ApiFail {
  error: ApiError;
}
export type ApiResponse<T> = ApiOk<T> | ApiFail;

export function ok<T>(data: T): ApiOk<T> {
  return { data };
}
export function fail(error: ApiError): ApiFail {
  return { error };
}

/** HTTP status por código de error de dominio. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};
