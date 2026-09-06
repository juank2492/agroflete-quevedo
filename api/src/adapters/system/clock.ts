import { randomInt, randomUUID } from 'node:crypto';
import { ulid } from 'ulid';
import type { Clock, IdGenerator } from '../../core/ports/services.js';

export const systemClock: Clock = {
  now: () => new Date(),
  nowIso: () => new Date().toISOString(),
};

export const idGenerator: IdGenerator = {
  uuid: () => randomUUID(),
  ulid: () => ulid(),
  codigoNumerico: (digitos) => {
    const max = 10 ** digitos;
    return String(randomInt(0, max)).padStart(digitos, '0');
  },
};
