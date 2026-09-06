import type { RegistroRequest, RegistroResponse } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ConflictError } from '../../domain/errors.js';

export async function registrarUsuario(
  ctx: AppContext,
  input: RegistroRequest,
): Promise<RegistroResponse> {
  const existente = await ctx.repos.usuarios.porEmail(input.email);
  if (existente) {
    throw new ConflictError('Ya existe una cuenta registrada con ese correo');
  }

  const id = ctx.ids.uuid();
  const codigo = ctx.ids.codigoNumerico(6);
  const passwordHash = await ctx.hasher.hash(input.password);
  const codigoExpiraTs = ctx.clock.now().getTime() + ctx.config.confCodeTtlMs;

  await ctx.repos.usuarios.crear({
    id,
    email: input.email,
    nombreCompleto: input.nombreCompleto,
    telefono: input.telefono,
    rol: input.rol,
    passwordHash,
    estado: 'PENDIENTE_CONF',
    codigoConf: codigo,
    codigoExpiraTs,
    createdAt: ctx.clock.nowIso(),
  });

  await ctx.events.publish('UsuarioRegistrado', {
    userId: id,
    email: input.email,
    nombreCompleto: input.nombreCompleto,
    codigo,
  });

  return { userId: id };
}
