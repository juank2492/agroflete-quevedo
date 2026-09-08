import {
  pagarPasarelaRequestSchema,
  registrarDepositoRequestSchema,
  revisarPagoRequestSchema,
} from '@agroflete/shared';
import {
  pagarConPasarela,
  registrarDeposito,
} from '../../../core/application/pagos/pagar-solicitud.js';
import {
  listarPagosEnRevision,
  revisarPago,
} from '../../../core/application/pagos/revisar-pago.js';
import { UnauthenticatedError } from '../../../core/domain/errors.js';
import type { RouteDef } from '../types.js';
import { ok } from '../types.js';

export const pagosRoutes: RouteDef[] = [
  {
    method: 'POST',
    path: '/solicitudes/:id/pago/pasarela',
    roles: ['productor'],
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const input = pagarPasarelaRequestSchema.parse(req.body);
      return ok(await pagarConPasarela(ctx, req.user, req.params['id'] ?? '', input));
    },
  },
  {
    method: 'POST',
    path: '/solicitudes/:id/pago/deposito',
    roles: ['productor'],
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      const input = registrarDepositoRequestSchema.parse(req.body);
      return ok(await registrarDeposito(ctx, req.user, req.params['id'] ?? '', input));
    },
  },
  {
    method: 'GET',
    path: '/admin/pagos',
    roles: ['admin'],
    handler: async (_req, ctx) => ok(await listarPagosEnRevision(ctx)),
  },
  {
    method: 'POST',
    path: '/admin/pagos/:id/revision',
    roles: ['admin'],
    handler: async (req, ctx) => {
      const input = revisarPagoRequestSchema.parse(req.body);
      return ok(await revisarPago(ctx, req.params['id'] ?? '', input));
    },
  },
];
