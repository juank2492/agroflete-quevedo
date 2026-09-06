import type { RouteDef } from '../types.js';
import { ok } from '../types.js';

export const healthRoutes: RouteDef[] = [
  {
    method: 'GET',
    path: '/salud',
    auth: false,
    handler: () =>
      ok({
        status: 'ok',
        servicio: 'agroflete-api',
        ts: new Date().toISOString(),
      }),
  },
];
