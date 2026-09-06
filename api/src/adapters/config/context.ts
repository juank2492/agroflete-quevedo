import type { AppContext } from '../../core/app-context.js';
import { makeLocalTokenService } from '../auth/local-jwt/token.service.js';
import { bcryptHasher } from '../auth/local-jwt/password.hasher.js';
import { makeOutboxEventBus } from '../events/local-outbox/event-bus.js';
import { makeSmtpNotifier } from '../notify/smtp/notifier.js';
import { TABLE, makeDocClient } from '../persistence/dynamo/client.js';
import { makeAcopioRepository } from '../persistence/dynamo/acopio.repository.js';
import { makeFleteRepository } from '../persistence/dynamo/flete.repository.js';
import { makeOutboxRepository } from '../persistence/dynamo/outbox.repository.js';
import { makeReglasTarifaRepository } from '../persistence/dynamo/reglas-tarifa.repository.js';
import { makeSolicitudRepository } from '../persistence/dynamo/solicitud.repository.js';
import { makeUsuarioRepository } from '../persistence/dynamo/usuario.repository.js';
import { makeVehiculoRepository } from '../persistence/dynamo/vehiculo.repository.js';
import { idGenerator, systemClock } from '../system/clock.js';
import { logger } from '../system/pino-logger.js';
import { env } from './env.js';

export type { AppContext } from '../../core/app-context.js';

/** Ensambla el contexto concreto que reciben los casos de uso. */
export function buildContext(): AppContext {
  const doc = makeDocClient();
  const outbox = makeOutboxRepository(doc, TABLE);
  const usuarios = makeUsuarioRepository(doc, TABLE);
  const acopios = makeAcopioRepository(doc, TABLE);
  const reglas = makeReglasTarifaRepository(doc, TABLE);
  const solicitudes = makeSolicitudRepository(doc, TABLE);
  const vehiculos = makeVehiculoRepository(doc, TABLE);
  const fletes = makeFleteRepository(doc, TABLE);

  return {
    logger,
    clock: systemClock,
    ids: idGenerator,
    config: {
      confCodeTtlMs: env.CONF_CODE_TTL_MINUTES * 60_000,
      retrasoUmbralHoras: env.RETRASO_UMBRAL_HORAS,
    },
    tokens: makeLocalTokenService(env.JWT_SECRET, env.JWT_EXPIRES_IN),
    hasher: bcryptHasher,
    events: makeOutboxEventBus({ outbox, ids: idGenerator, clock: systemClock }),
    notifier: makeSmtpNotifier({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      from: env.SMTP_FROM,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      secure: env.SMTP_SECURE,
    }),
    repos: { usuarios, outbox, acopios, reglas, solicitudes, vehiculos, fletes },
  };
}
