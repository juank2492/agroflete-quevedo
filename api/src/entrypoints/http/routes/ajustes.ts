import { actualizarAjustesRequestSchema } from '@agroflete/shared';
import {
  actualizarAjustes,
  obtenerAjustes,
} from '../../../core/application/ajustes/gestion-ajustes.js';
import { UnauthenticatedError } from '../../../core/domain/errors.js';
import type { RouteDef } from '../types.js';
import { ok } from '../types.js';

export const ajustesRoutes: RouteDef[] = [
  {
    method: 'GET',
    path: '/admin/ajustes',
    roles: ['admin'],
    handler: async (_req, ctx) => ok(await obtenerAjustes(ctx)),
  },
  {
    method: 'PUT',
    path: '/admin/ajustes',
    roles: ['admin'],
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const patch = actualizarAjustesRequestSchema.parse(req.body);
      return ok(await actualizarAjustes(ctx, patch, req.user.sub));
    },
  },
];
