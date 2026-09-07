import { buscarLugaresQuerySchema, rutaVialQuerySchema } from '@agroflete/shared';
import { buscarLugares } from '../../../core/application/geo/buscar-lugares.js';
import { calcularRutaVial } from '../../../core/application/geo/calcular-ruta-vial.js';
import type { RouteDef } from '../types.js';
import { ok } from '../types.js';

export const geoRoutes: RouteDef[] = [
  {
    method: 'GET',
    path: '/geo/buscar',
    handler: async (req, ctx) => {
      const { q } = buscarLugaresQuerySchema.parse(req.query);
      return ok(await buscarLugares(ctx, q));
    },
  },
  {
    method: 'GET',
    path: '/geo/ruta',
    handler: async (req, ctx) => {
      const { olat, olon, dlat, dlon } = rutaVialQuerySchema.parse(req.query);
      return ok(await calcularRutaVial(ctx, { lat: olat, lon: olon }, { lat: dlat, lon: dlon }));
    },
  },
];
