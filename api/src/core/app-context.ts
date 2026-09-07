import type { GeocodingPort, RoutingPort } from './ports/geo.js';
import type { Repositories } from './ports/repositories.js';
import type {
  Clock,
  EventBus,
  IdGenerator,
  Logger,
  Notifier,
  PasswordHasher,
  TokenService,
} from './ports/services.js';

/** Configuración de negocio. */
export interface AppConfig {
  confCodeTtlMs: number;
  retrasoUmbralHoras: number;
  adminEmail: string;
  /** Radio de confirmación automática de entrega. */
  geocercaAcopioM: number;
}

/** Dependencias recibidas por los casos de uso. */
export interface AppContext {
  logger: Logger;
  clock: Clock;
  ids: IdGenerator;
  config: AppConfig;
  tokens: TokenService;
  hasher: PasswordHasher;
  events: EventBus;
  notifier: Notifier;
  geocoding: GeocodingPort;
  routing: RoutingPort;
  repos: Repositories;
}
