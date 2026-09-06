import type { PerfilPublico } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { NotFoundError } from '../../domain/errors.js';
import { toPerfilPublico } from '../../domain/usuario.js';

export async function obtenerPerfil(ctx: AppContext, userId: string): Promise<PerfilPublico> {
  const u = await ctx.repos.usuarios.porId(userId);
  if (!u) throw new NotFoundError('Perfil no encontrado');
  return toPerfilPublico(u);
}
