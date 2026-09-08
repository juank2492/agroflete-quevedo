import type { JwtClaims, Notificacion } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';

const LIMITE_DEFECTO = 30;

export function listarNotificaciones(
  ctx: AppContext,
  user: JwtClaims,
  limite = LIMITE_DEFECTO,
): Promise<Notificacion[]> {
  return ctx.repos.notificaciones.listar(user.sub, Math.min(Math.max(limite, 1), 100));
}

export function marcarLeida(ctx: AppContext, user: JwtClaims, id: string): Promise<void> {
  return ctx.repos.notificaciones.marcarLeida(user.sub, id, ctx.clock.nowIso());
}

export function marcarTodasLeidas(ctx: AppContext, user: JwtClaims): Promise<number> {
  return ctx.repos.notificaciones.marcarTodasLeidas(user.sub, ctx.clock.nowIso());
}
