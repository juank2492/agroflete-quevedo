import { ajustarStockRequestSchema, fijarUmbralesRequestSchema } from '@agroflete/shared';
import { ajustarStock } from '../../../core/application/inventario/ajustar-stock.js';
import { obtenerInventario } from '../../../core/application/inventario/consultar-inventario.js';
import { fijarUmbrales } from '../../../core/application/inventario/fijar-umbrales.js';
import { UnauthenticatedError } from '../../../core/domain/errors.js';
import type { RouteDef } from '../types.js';
import { ok } from '../types.js';

export const inventarioRoutes: RouteDef[] = [
  {
    method: 'GET',
    path: '/admin/inventario',
    roles: ['admin'],
    handler: async (_req, ctx) => ok(await obtenerInventario(ctx)),
  },
  {
    method: 'PUT',
    path: '/acopios/:id/stock/:cultivo',
    roles: ['admin'],
    handler: async (req, ctx) => {
      const input = fijarUmbralesRequestSchema.parse(req.body);
      const acopioId = req.params['id'] ?? '';
      const cultivo = req.params['cultivo'] ?? '';
      return ok(await fijarUmbrales(ctx, acopioId, cultivo, input));
    },
  },
  {
    method: 'POST',
    path: '/acopios/:id/stock/:cultivo/ajuste',
    roles: ['admin'],
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const input = ajustarStockRequestSchema.parse(req.body);
      const acopioId = req.params['id'] ?? '';
      const cultivo = req.params['cultivo'] ?? '';
      return ok(await ajustarStock(ctx, acopioId, cultivo, input, req.user.sub));
    },
  },
];
