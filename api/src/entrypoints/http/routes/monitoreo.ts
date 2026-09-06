import { cambiarEstadoFleteRequestSchema, listarFletesQuerySchema } from '@agroflete/shared';
import { cambiarEstadoFlete } from '../../../core/application/monitoreo/cambiar-estado-flete.js';
import {
  listarFletes,
  obtenerFlete,
} from '../../../core/application/monitoreo/consultar-fletes.js';
import { obtenerMetricasOperativas } from '../../../core/application/monitoreo/metricas-operativas.js';
import { UnauthenticatedError } from '../../../core/domain/errors.js';
import type { RouteDef } from '../types.js';
import { ok } from '../types.js';

export const monitoreoRoutes: RouteDef[] = [
  {
    method: 'GET',
    path: '/fletes',
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const query = listarFletesQuerySchema.parse(req.query);
      return ok(await listarFletes(ctx, req.user, query));
    },
  },
  {
    method: 'GET',
    path: '/fletes/:id',
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      return ok(await obtenerFlete(ctx, req.user, req.params['id'] ?? ''));
    },
  },
  {
    method: 'PATCH',
    path: '/fletes/:id/estado',
    roles: ['transportista', 'admin'],
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const { nuevoEstado } = cambiarEstadoFleteRequestSchema.parse(req.body);
      return ok(await cambiarEstadoFlete(ctx, req.user, req.params['id'] ?? '', nuevoEstado));
    },
  },
  {
    method: 'GET',
    path: '/admin/metricas',
    roles: ['admin'],
    handler: async (_req, ctx) => ok(await obtenerMetricasOperativas(ctx)),
  },
];
