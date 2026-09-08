import type { GeocodingPort, RoutingPort } from './ports/geo.js';
import type { Repositories } from './ports/repositories.js';
import type {
  Clock,
  EventBus,
  IdGenerator,
  Logger,
  Notifier,
  PasswordHasher,
  PushSender,
  TokenService,
} from './ports/services.js';

/** Configuración de negocio. */
export interface AppConfig {
  confCodeTtlMs: number;
  retrasoUmbralHoras: number;
  adminEmail: string;
  /** Radio de confirmación automática de entrega. */
  geocercaAcopioM: number;
  /** Exige que la solicitud tenga el pago confirmado antes de poder asignarla. */
  pagoObligatorio: boolean;
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
  push: PushSender;
  geocoding: GeocodingPort;
  routing: RoutingPort;
  repos: Repositories;
}
