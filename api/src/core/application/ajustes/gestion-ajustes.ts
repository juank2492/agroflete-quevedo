import {
  ajustesOperacionSchema,
  type ActualizarAjustesRequest,
  type AjustesOperacion,
} from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ValidationError } from '../../domain/errors.js';

export function obtenerAjustes(ctx: AppContext): Promise<AjustesOperacion> {
  return ctx.repos.ajustes.obtener();
}

export async function actualizarAjustes(
  ctx: AppContext,
  patch: ActualizarAjustesRequest,
  actorId: string,
): Promise<AjustesOperacion> {
  const actuales = await ctx.repos.ajustes.obtener();
  const parsed = ajustesOperacionSchema.safeParse({ ...actuales, ...patch });
  if (!parsed.success) {
    throw new ValidationError('Ajustes inválidos', { issues: parsed.error.issues });
  }
  await ctx.repos.ajustes.guardar(parsed.data);
  ctx.logger.info({ actorId, patch }, 'ajustes de operación actualizados');
  return parsed.data;
}
