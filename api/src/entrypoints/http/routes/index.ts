import type { RouteDef } from '../types.js';
import { ajustesRoutes } from './ajustes.js';
import { authRoutes } from './auth.js';
import { flotaRoutes } from './flota.js';
import { geoRoutes } from './geo.js';
import { healthRoutes } from './health.js';
import { inventarioRoutes } from './inventario.js';
import { monitoreoRoutes } from './monitoreo.js';
import { solicitudesRoutes } from './solicitudes.js';
import { tarifasRoutes } from './tarifas.js';
import { vehiculosRoutes } from './vehiculos.js';

/** Registro único de rutas de la API. */
export const routes: RouteDef[] = [
  ...healthRoutes,
  ...authRoutes,
  ...geoRoutes,
  ...tarifasRoutes,
  ...solicitudesRoutes,
  ...vehiculosRoutes,
  ...monitoreoRoutes,
  ...inventarioRoutes,
  ...ajustesRoutes,
  ...flotaRoutes,
];
