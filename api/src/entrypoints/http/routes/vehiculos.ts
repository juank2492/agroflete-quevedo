import {
  actualizarVehiculoRequestSchema,
  asignarFleteRequestSchema,
  registrarVehiculoRequestSchema,
} from '@agroflete/shared';
import { z } from 'zod';
import {
  asignarFlete,
  listarVehiculosCompatibles,
} from '../../../core/application/despacho/asignar-flete.js';
import {
  actualizarVehiculo,
  misVehiculos,
  registrarVehiculo,
} from '../../../core/application/despacho/gestion-vehiculos.js';
import { UnauthenticatedError } from '../../../core/domain/errors.js';
import type { RouteDef } from '../types.js';
import { created, ok } from '../types.js';

const compatiblesQuerySchema = z.object({ solicitudId: z.string().min(1) });

export const vehiculosRoutes: RouteDef[] = [
  {
    method: 'GET',
    path: '/vehiculos/mios',
    roles: ['transportista'],
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      return ok(await misVehiculos(ctx, req.user.sub));
    },
  },
  {
    method: 'GET',
    path: '/vehiculos/compatibles',
    roles: ['admin'],
    handler: async (req, ctx) => {
      const { solicitudId } = compatiblesQuerySchema.parse(req.query);
      return ok(await listarVehiculosCompatibles(ctx, solicitudId));
    },
  },
  {
    method: 'POST',
    path: '/vehiculos',
    roles: ['transportista'],
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const input = registrarVehiculoRequestSchema.parse(req.body);
      return created(await registrarVehiculo(ctx, req.user.sub, input));
    },
  },
  {
    method: 'PATCH',
    path: '/vehiculos/:id',
    roles: ['transportista'],
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const patch = actualizarVehiculoRequestSchema.parse(req.body);
      return ok(await actualizarVehiculo(ctx, req.user.sub, req.params['id'] ?? '', patch));
    },
  },
  {
    method: 'POST',
    path: '/fletes',
    roles: ['admin'],
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const input = asignarFleteRequestSchema.parse(req.body);
      return created(await asignarFlete(ctx, req.user.sub, input));
    },
  },
];
