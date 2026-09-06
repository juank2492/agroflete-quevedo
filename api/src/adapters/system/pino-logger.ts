import pino from 'pino';
import type { Logger } from '../../core/ports/services.js';
import { env } from '../config/env.js';

const base = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        }
      : undefined,
});

function call(fn: pino.LogFn, obj: unknown, msg?: string): void {
  if (typeof obj === 'string') fn(obj);
  else fn(obj as object, msg);
}

function wrap(instance: pino.Logger): Logger {
  return {
    debug: (obj, msg) => call(instance.debug.bind(instance), obj, msg),
    info: (obj, msg) => call(instance.info.bind(instance), obj, msg),
    warn: (obj, msg) => call(instance.warn.bind(instance), obj, msg),
    error: (obj, msg) => call(instance.error.bind(instance), obj, msg),
    child: (bindings) => wrap(instance.child(bindings)),
  };
}

export const logger: Logger = wrap(base);
