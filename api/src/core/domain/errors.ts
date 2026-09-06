import type { ErrorCode } from '@agroflete/shared';

/** Error base de dominio: transporta un `code` estable que la capa HTTP mapea a un status. */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'Datos inválidos', details?: Record<string, unknown>) {
    super('VALIDATION', message, details);
  }
}

export class UnauthenticatedError extends DomainError {
  constructor(message = 'No autenticado') {
    super('UNAUTHENTICATED', message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'No autorizado') {
    super('FORBIDDEN', message);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Recurso no encontrado') {
    super('NOT_FOUND', message);
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Conflicto con el estado actual', details?: Record<string, unknown>) {
    super('CONFLICT', message, details);
  }
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}
