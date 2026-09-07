import type { ActualizarPerfilRequest, PerfilPublico } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { NotFoundError } from '../../domain/errors.js';
import { toPerfilPublico } from '../../domain/usuario.js';

/** Actualiza los datos personales sin cambiar email ni rol. */
export async function actualizarPerfil(
  ctx: AppContext,
  userId: string,
  input: ActualizarPerfilRequest,
): Promise<PerfilPublico> {
  const u = await ctx.repos.usuarios.porId(userId);
  if (!u) throw new NotFoundError('Perfil no encontrado');

  const patch: Partial<typeof u> = {};
  if (input.nombreCompleto !== undefined) patch.nombreCompleto = input.nombreCompleto;
  if (input.telefono !== undefined) patch.telefono = input.telefono;

  await ctx.repos.usuarios.actualizar(userId, patch);
  return toPerfilPublico({ ...u, ...patch });
}
