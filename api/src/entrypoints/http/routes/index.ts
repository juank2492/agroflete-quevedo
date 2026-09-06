import type { RouteDef } from '../types.js';
import { authRoutes } from './auth.js';
import { healthRoutes } from './health.js';
import { monitoreoRoutes } from './monitoreo.js';
import { solicitudesRoutes } from './solicitudes.js';
import { tarifasRoutes } from './tarifas.js';
import { vehiculosRoutes } from './vehiculos.js';

/**
 * Registro único de rutas de la API. La capa de transporte (Express en local,
 * API Gateway en AWS) itera este arreglo; la lógica vive en los handlers.
 */
export const routes: RouteDef[] = [
  ...healthRoutes,
  ...authRoutes,
  ...tarifasRoutes,
  ...solicitudesRoutes,
  ...vehiculosRoutes,
  ...monitoreoRoutes,
];
