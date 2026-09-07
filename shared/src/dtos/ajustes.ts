import { z } from 'zod';

/** Ajustes operativos editables por el administrador. */
export const ajustesOperacionSchema = z.object({
  /** Activa el emparejamiento automático. */
  autoEmparejar: z.boolean(),
});
export type AjustesOperacion = z.infer<typeof ajustesOperacionSchema>;

export const AJUSTES_OPERACION_DEFAULT: AjustesOperacion = {
  autoEmparejar: true,
};

/** Solicitud parcial de actualización. */
export const actualizarAjustesRequestSchema = ajustesOperacionSchema.partial();
export type ActualizarAjustesRequest = z.infer<typeof actualizarAjustesRequestSchema>;
