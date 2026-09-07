import {
  reglasTarifaSchema,
  type ActualizarReglasRequest,
  type ReglasTarifa,
} from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ValidationError } from '../../domain/errors.js';

export function obtenerReglasTarifa(ctx: AppContext): Promise<ReglasTarifa> {
  return ctx.repos.reglas.obtener();
}

/** Actualiza y valida las reglas vigentes. */
export async function actualizarReglasTarifa(
  ctx: AppContext,
  patch: ActualizarReglasRequest,
  actorId: string,
): Promise<ReglasTarifa> {
  const actuales = await ctx.repos.reglas.obtener();
  // `cultivos` se reemplaza entero cuando viene en el patch; el resto se fusiona.
  const fusion: ReglasTarifa = { ...actuales, ...patch };

  const parsed = reglasTarifaSchema.safeParse(fusion);
  if (!parsed.success) {
    throw new ValidationError('Reglas de tarifa inválidas', { issues: parsed.error.issues });
  }

  await ctx.repos.reglas.guardar(parsed.data);
  await ctx.events.publish('ReglasTarifaActualizadas', { actorId });
  return parsed.data;
}
