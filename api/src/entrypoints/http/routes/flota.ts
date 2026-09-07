import {
  actualizarTransportistaRequestSchema,
  actualizarVehiculoRequestSchema,
  crearTransportistaRequestSchema,
  crearVehiculoAdminRequestSchema,
} from '@agroflete/shared';
import {
  cambiarActividadTransportista,
  crearTransportista,
  listarTransportistas,
} from '../../../core/application/identidad/gestion-transportistas.js';
import {
  editarVehiculo,
  listarFlota,
  registrarVehiculoAdmin,
} from '../../../core/application/despacho/gestion-vehiculos.js';
import type { RouteDef } from '../types.js';
import { created, ok } from '../types.js';

export const flotaRoutes: RouteDef[] = [
  {
    method: 'GET',
    path: '/admin/transportistas',
    roles: ['admin'],
    handler: async (_req, ctx) => ok(await listarTransportistas(ctx)),
  },
  {
    method: 'POST',
    path: '/admin/transportistas',
    roles: ['admin'],
    handler: async (req, ctx) => {
      const input = crearTransportistaRequestSchema.parse(req.body);
      return created(await crearTransportista(ctx, input));
    },
  },
  {
    method: 'PATCH',
    path: '/admin/transportistas/:id',
    roles: ['admin'],
    handler: async (req, ctx) => {
      const { activo } = actualizarTransportistaRequestSchema.parse(req.body);
      return ok(await cambiarActividadTransportista(ctx, req.params['id'] ?? '', activo));
    },
  },
  {
    method: 'GET',
    path: '/admin/vehiculos',
    roles: ['admin'],
    handler: async (_req, ctx) => ok(await listarFlota(ctx)),
  },
  {
    method: 'POST',
    path: '/admin/vehiculos',
    roles: ['admin'],
    handler: async (req, ctx) => {
      const input = crearVehiculoAdminRequestSchema.parse(req.body);
      return created(await registrarVehiculoAdmin(ctx, input));
    },
  },
  {
    method: 'PATCH',
    path: '/admin/vehiculos/:id',
    roles: ['admin'],
    handler: async (req, ctx) => {
      const patch = actualizarVehiculoRequestSchema.parse(req.body);
      return ok(await editarVehiculo(ctx, req.params['id'] ?? '', patch));
    },
  },
];
