import { pushSubscriptionSchema, quitarPushRequestSchema } from '@agroflete/shared';
import {
  listarNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
} from '../../../core/application/notificaciones/consultar-notificaciones.js';
import {
  clavePublicaPush,
  guardarSuscripcionPush,
  quitarSuscripcionPush,
} from '../../../core/application/notificaciones/push.js';
import { UnauthenticatedError } from '../../../core/domain/errors.js';
import type { RouteDef } from '../types.js';
import { ok } from '../types.js';

export const notificacionesRoutes: RouteDef[] = [
  {
    method: 'GET',
    path: '/notificaciones',
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      return ok(await listarNotificaciones(ctx, req.user));
    },
  },
  {
    method: 'POST',
    path: '/notificaciones/leer-todas',
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      return ok({ marcadas: await marcarTodasLeidas(ctx, req.user) });
    },
  },
  {
    method: 'POST',
    path: '/notificaciones/:id/leida',
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      await marcarLeida(ctx, req.user, req.params['id'] ?? '');
      return ok({ ok: true });
    },
  },
  {
    method: 'GET',
    path: '/notificaciones/push/clave-publica',
    auth: false,
    handler: async (_req, ctx) => ok(clavePublicaPush(ctx)),
  },
  {
    method: 'POST',
    path: '/notificaciones/push/suscripcion',
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      await guardarSuscripcionPush(ctx, req.user, pushSubscriptionSchema.parse(req.body));
      return ok({ ok: true });
    },
  },
  {
    method: 'DELETE',
    path: '/notificaciones/push/suscripcion',
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const { endpoint } = quitarPushRequestSchema.parse(req.body);
      await quitarSuscripcionPush(ctx, req.user, endpoint);
      return ok({ ok: true });
    },
  },
];
