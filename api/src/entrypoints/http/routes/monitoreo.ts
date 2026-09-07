import {
  cambiarEstadoFleteRequestSchema,
  listarFletesQuerySchema,
  reasignarFleteRequestSchema,
  registrarIncidenciaRequestSchema,
  registrarUbicacionRequestSchema,
} from '@agroflete/shared';
import { cambiarEstadoFlete } from '../../../core/application/monitoreo/cambiar-estado-flete.js';
import { reasignarFlete } from '../../../core/application/despacho/reasignar-flete.js';
import {
  listarFletes,
  obtenerFlete,
} from '../../../core/application/monitoreo/consultar-fletes.js';
import { obtenerMetricasOperativas } from '../../../core/application/monitoreo/metricas-operativas.js';
import { registrarIncidencia } from '../../../core/application/monitoreo/registrar-incidencia.js';
import {
  consultarRuta,
  registrarUbicacion,
} from '../../../core/application/monitoreo/registrar-ubicacion.js';
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
      const { nuevoEstado, motivo } = cambiarEstadoFleteRequestSchema.parse(req.body);
      return ok(
        await cambiarEstadoFlete(ctx, req.user, req.params['id'] ?? '', nuevoEstado, motivo),
      );
    },
  },
  {
    method: 'POST',
    path: '/fletes/:id/reasignar',
    roles: ['admin'],
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const { vehiculoId } = reasignarFleteRequestSchema.parse(req.body);
      return ok(await reasignarFlete(ctx, req.user, req.params['id'] ?? '', vehiculoId));
    },
  },
  {
    method: 'PATCH',
    path: '/fletes/:id/incidencia',
    roles: ['transportista', 'admin'],
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const input = registrarIncidenciaRequestSchema.parse(req.body);
      return ok(await registrarIncidencia(ctx, req.user, req.params['id'] ?? '', input));
    },
  },
  {
    method: 'POST',
    path: '/fletes/:id/ubicacion',
    roles: ['transportista', 'admin'],
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const input = registrarUbicacionRequestSchema.parse(req.body);
      return ok(await registrarUbicacion(ctx, req.user, req.params['id'] ?? '', input));
    },
  },
  {
    method: 'GET',
    path: '/fletes/:id/ruta',
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      return ok(await consultarRuta(ctx, req.user, req.params['id'] ?? ''));
    },
  },
  {
    method: 'GET',
    path: '/admin/metricas',
    roles: ['admin'],
    handler: async (_req, ctx) => ok(await obtenerMetricasOperativas(ctx)),
  },
];
