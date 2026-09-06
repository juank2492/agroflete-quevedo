import { actualizarReglasRequestSchema, estimacionTarifaRequestSchema } from '@agroflete/shared';
import { estimarTarifa } from '../../../core/application/tarifas/estimar-tarifa.js';
import { listarAcopios } from '../../../core/application/tarifas/listar-acopios.js';
import {
  actualizarReglasTarifa,
  obtenerReglasTarifa,
} from '../../../core/application/tarifas/reglas-tarifa.js';
import { UnauthenticatedError } from '../../../core/domain/errors.js';
import type { RouteDef } from '../types.js';
import { ok } from '../types.js';

export const tarifasRoutes: RouteDef[] = [
  {
    method: 'GET',
    path: '/acopios',
    handler: async (_req, ctx) => ok(await listarAcopios(ctx)),
  },
  {
    method: 'GET',
    path: '/tarifas/reglas',
    roles: ['admin'],
    handler: async (_req, ctx) => ok(await obtenerReglasTarifa(ctx)),
  },
  {
    method: 'PUT',
    path: '/tarifas/reglas',
    roles: ['admin'],
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const patch = actualizarReglasRequestSchema.parse(req.body);
      return ok(await actualizarReglasTarifa(ctx, patch, req.user.sub));
    },
  },
  {
    method: 'POST',
    path: '/solicitudes/estimacion',
    roles: ['productor'],
    handler: async (req, ctx) => {
      const input = estimacionTarifaRequestSchema.parse(req.body);
      return ok(await estimarTarifa(ctx, input));
    },
  },
];
