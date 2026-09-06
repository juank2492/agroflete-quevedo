import { ERROR_STATUS } from '@agroflete/shared';
import type { DomainError } from './errors.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
  isDomainError,
} from './errors.js';

describe('errores de dominio', () => {
  it('cada subclase expone el code correcto y un status HTTP mapeable', () => {
    const cases: Array<[DomainError, keyof typeof ERROR_STATUS]> = [
      [new ValidationError(), 'VALIDATION'],
      [new UnauthenticatedError(), 'UNAUTHENTICATED'],
      [new ForbiddenError(), 'FORBIDDEN'],
      [new NotFoundError(), 'NOT_FOUND'],
      [new ConflictError(), 'CONFLICT'],
    ];
    for (const [err, code] of cases) {
      expect(err.code).toBe(code);
      expect(ERROR_STATUS[err.code]).toBeGreaterThanOrEqual(400);
      expect(isDomainError(err)).toBe(true);
    }
  });

  it('isDomainError distingue errores comunes', () => {
    expect(isDomainError(new Error('x'))).toBe(false);
    expect(isDomainError(null)).toBe(false);
  });

  it('conserva details', () => {
    const err = new ValidationError('mal', { campo: 'email' });
    expect(err.details).toEqual({ campo: 'email' });
  });
});
