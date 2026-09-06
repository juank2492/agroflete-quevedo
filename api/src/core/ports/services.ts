import type { DomainEvent, EventPayloadMap, JwtClaims } from '@agroflete/shared';

export interface Logger {
  debug(obj: unknown, msg?: string): void;
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

export interface Clock {
  now(): Date;
  nowIso(): string;
}

export interface IdGenerator {
  uuid(): string;
  /** Identificador ordenable en el tiempo (para el outbox). */
  ulid(): string;
  /** Código numérico aleatorio de N dígitos (confirmación de cuenta). */
  codigoNumerico(digitos: number): string;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export interface TokenService {
  sign(claims: Omit<JwtClaims, 'iat' | 'exp'>): string;
  verify(token: string): JwtClaims;
}

/** Publica eventos de dominio. En local escribe al outbox; en AWS irá a EventBridge. */
export interface EventBus {
  publish<K extends keyof EventPayloadMap>(tipo: K, payload: EventPayloadMap[K]): Promise<void>;
}

export type EventHandler = (event: DomainEvent) => Promise<void>;

export interface Notifier {
  enviarEmail(input: { to: string; subject: string; text: string }): Promise<void>;
}
