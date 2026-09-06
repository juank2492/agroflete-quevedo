import type { ConfirmarRequest } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { codigoVigente } from '../../domain/usuario.js';

export async function confirmarUsuario(ctx: AppContext, input: ConfirmarRequest): Promise<void> {
  const u = await ctx.repos.usuarios.porEmail(input.email);
  if (!u) throw new NotFoundError('No hay una cuenta con ese correo');
  if (u.estado === 'CONFIRMADO') throw new ConflictError('La cuenta ya está confirmada');

  if (!u.codigoConf || u.codigoConf !== input.codigo) {
    throw new ValidationError('Código incorrecto');
  }
  if (!codigoVigente(u, ctx.clock.now().getTime())) {
    throw new ValidationError('El código expiró; vuelve a registrarte para recibir uno nuevo');
  }

  await ctx.repos.usuarios.actualizar(u.id, {
    estado: 'CONFIRMADO',
    codigoConf: undefined,
    codigoExpiraTs: undefined,
  });
}
