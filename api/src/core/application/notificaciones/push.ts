import type { JwtClaims, PushSubscriptionDTO } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import type { AvisoPlantilla } from './plantillas.js';

export function clavePublicaPush(ctx: AppContext): { clave: string | null } {
  return { clave: ctx.push.clavePublica() };
}

export function guardarSuscripcionPush(
  ctx: AppContext,
  user: JwtClaims,
  sub: PushSubscriptionDTO,
): Promise<void> {
  return ctx.repos.push.guardar(user.sub, sub);
}

export function quitarSuscripcionPush(
  ctx: AppContext,
  user: JwtClaims,
  endpoint: string,
): Promise<void> {
  return ctx.repos.push.eliminar(user.sub, endpoint);
}

/** Envía el aviso a las suscripciones activas del usuario. */
export async function empujarAviso(
  ctx: AppContext,
  userId: string,
  aviso: AvisoPlantilla,
): Promise<void> {
  if (!ctx.push.habilitado) return;
  const subs = await ctx.repos.push.porUsuario(userId);
  await Promise.all(
    subs.map(async (sub) => {
      const r = await ctx.push.enviar(sub, {
        titulo: aviso.titulo,
        cuerpo: aviso.cuerpo,
        url: aviso.enlace,
      });
      if (r === 'expirada') await ctx.repos.push.eliminar(userId, sub.endpoint);
    }),
  );
}
