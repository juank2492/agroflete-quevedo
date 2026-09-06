import { crearSolicitudRequestSchema, listarSolicitudesQuerySchema } from '@agroflete/shared';
import { crearSolicitud } from '../../../core/application/despacho/crear-solicitud.js';
import {
  listarSolicitudes,
  obtenerSolicitud,
} from '../../../core/application/despacho/consultar-solicitudes.js';
import { UnauthenticatedError } from '../../../core/domain/errors.js';
import type { RouteDef } from '../types.js';
import { created, ok } from '../types.js';

export const solicitudesRoutes: RouteDef[] = [
  {
    method: 'POST',
    path: '/solicitudes',
    roles: ['productor'],
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const input = crearSolicitudRequestSchema.parse(req.body);
      return created(await crearSolicitud(ctx, req.user.sub, input));
    },
  },
  {
    method: 'GET',
    path: '/solicitudes',
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const query = listarSolicitudesQuerySchema.parse(req.query);
      return ok(await listarSolicitudes(ctx, req.user, query));
    },
  },
  {
    method: 'GET',
    path: '/solicitudes/:id',
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      return ok(await obtenerSolicitud(ctx, req.user, req.params['id'] ?? ''));
    },
  },
];
