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

/** Perillas de negocio configurables (no infraestructura). */
export interface AppConfig {
  confCodeTtlMs: number;
  retrasoUmbralHoras: number;
}

/**
 * Dependencias que reciben los casos de uso. Solo tipos de `core/ports` — el
 * ensamblado concreto vive en `adapters/config/context.ts`.
 */
export interface AppContext {
  logger: Logger;
  clock: Clock;
  ids: IdGenerator;
  config: AppConfig;
  tokens: TokenService;
  hasher: PasswordHasher;
  events: EventBus;
  notifier: Notifier;
  repos: Repositories;
}
