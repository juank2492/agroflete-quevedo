import type { CambiarPasswordRequest } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ForbiddenError, NotFoundError } from '../../domain/errors.js';

/** Cambia la contraseña después de verificar la actual. */
export async function cambiarPassword(
  ctx: AppContext,
  userId: string,
  input: CambiarPasswordRequest,
): Promise<void> {
  const u = await ctx.repos.usuarios.porId(userId);
  if (!u) throw new NotFoundError('Perfil no encontrado');

  const coincide = await ctx.hasher.compare(input.passwordActual, u.passwordHash);
  if (!coincide) throw new ForbiddenError('La contraseña actual no es correcta');

  const passwordHash = await ctx.hasher.hash(input.passwordNueva);
  await ctx.repos.usuarios.actualizar(userId, { passwordHash });
}
