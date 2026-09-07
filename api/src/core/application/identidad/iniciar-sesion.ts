import type { LoginRequest, LoginResponse } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ForbiddenError } from '../../domain/errors.js';
import { toPerfilPublico } from '../../domain/usuario.js';

export async function iniciarSesion(ctx: AppContext, input: LoginRequest): Promise<LoginResponse> {
  const u = await ctx.repos.usuarios.porEmail(input.email);
  const credencialesInvalidas = new ForbiddenError('Correo o contraseña incorrectos');

  if (!u) throw credencialesInvalidas;
  if (u.estado === 'INACTIVO') {
    throw new ForbiddenError('Tu cuenta está dada de baja. Contacta al administrador.');
  }
  if (u.estado !== 'CONFIRMADO') {
    throw new ForbiddenError('Debes confirmar tu correo antes de iniciar sesión');
  }
  const ok = await ctx.hasher.compare(input.password, u.passwordHash);
  if (!ok) throw credencialesInvalidas;

  const token = ctx.tokens.sign({
    sub: u.id,
    email: u.email,
    role: u.rol,
    name: u.nombreCompleto,
  });

  return { token, perfil: toPerfilPublico(u) };
}
