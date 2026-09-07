import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { haversineKm } from '@agroflete/shared';
import type { AppContext } from '../core/app-context.js';
import type { GeocodingPort, RoutingPort } from '../core/ports/geo.js';
import type { Clock, Notifier } from '../core/ports/services.js';
import { makeLocalTokenService } from '../adapters/auth/local-jwt/token.service.js';
import { bcryptHasher } from '../adapters/auth/local-jwt/password.hasher.js';
import { makeOutboxEventBus } from '../adapters/events/local-outbox/event-bus.js';
import { makeAcopioRepository } from '../adapters/persistence/dynamo/acopio.repository.js';
import { makeInventarioRepository } from '../adapters/persistence/dynamo/inventario.repository.js';
import { makeFleteRepository } from '../adapters/persistence/dynamo/flete.repository.js';
import { makeOutboxRepository } from '../adapters/persistence/dynamo/outbox.repository.js';
import { makeAjustesRepository } from '../adapters/persistence/dynamo/ajustes.repository.js';
import { makeReglasTarifaRepository } from '../adapters/persistence/dynamo/reglas-tarifa.repository.js';
import { makeSolicitudRepository } from '../adapters/persistence/dynamo/solicitud.repository.js';
import { makeUsuarioRepository } from '../adapters/persistence/dynamo/usuario.repository.js';
import { makeVehiculoRepository } from '../adapters/persistence/dynamo/vehiculo.repository.js';
import { idGenerator, systemClock } from '../adapters/system/clock.js';
import { logger } from '../adapters/system/pino-logger.js';

const ENDPOINT = process.env.DYNAMO_ENDPOINT ?? 'http://localhost:8010';

const raw = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'local',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

const probe = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'local',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  maxAttempts: 1,
  requestHandler: { connectionTimeout: 700, requestTimeout: 1500 },
});

const GSIS = ['gsi1', 'gsi2', 'gsi3', 'gsi4', 'gsi5', 'gsi6'];

export async function dynamoDisponible(): Promise<boolean> {
  try {
    await probe.send(new ListTablesCommand({}));
    return true;
  } catch {
    return false;
  }
}

export async function crearTablaTest(nombre: string): Promise<void> {
  await borrarTablaTest(nombre);
  const attrs = ['PK', 'SK', ...GSIS.flatMap((g) => [`${g}pk`, `${g}sk`])];
  await raw.send(
    new CreateTableCommand({
      TableName: nombre,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: attrs.map((AttributeName) => ({ AttributeName, AttributeType: 'S' })),
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: GSIS.map((g) => ({
        IndexName: g,
        KeySchema: [
          { AttributeName: `${g}pk`, KeyType: 'HASH' as const },
          { AttributeName: `${g}sk`, KeyType: 'RANGE' as const },
        ],
        Projection: { ProjectionType: 'ALL' as const },
      })),
    }),
  );
  await waitUntilTableExists({ client: raw, maxWaitTime: 60 }, { TableName: nombre });
}

export async function borrarTablaTest(nombre: string): Promise<void> {
  try {
    await raw.send(new DeleteTableCommand({ TableName: nombre }));
  } catch {
    // La tabla puede no existir todavía.
  }
}

export interface CtxDePrueba {
  ctx: AppContext;
  correos: Array<{ to: string; subject: string; text: string }>;
}

/** Routing determinista para pruebas: recta de dos puntos, sin red. */
const routingDePrueba: RoutingPort = {
  async calcularRuta(origen, destino) {
    return {
      geometria: [origen, destino],
      distanciaKm: Math.round(haversineKm(origen, destino) * 1.3 * 100) / 100,
      duracionMin: 20,
      aproximada: true,
    };
  },
};

/** Geocodificación vacía en pruebas (los casos que la necesiten inyectan la suya). */
const geocodingDePrueba: GeocodingPort = {
  async buscar() {
    return [];
  },
};

/** Reloj fijo, útil para crear datos "del pasado" en pruebas de retrasos. */
export function relojFijo(iso: string): Clock {
  const fija = new Date(iso);
  return { now: () => fija, nowIso: () => fija.toISOString() };
}

export function contextoDePrueba(tabla: string, clock: Clock = systemClock): CtxDePrueba {
  const doc = DynamoDBDocumentClient.from(raw, {
    marshallOptions: { removeUndefinedValues: true },
  });
  const outbox = makeOutboxRepository(doc, tabla);
  const correos: CtxDePrueba['correos'] = [];
  const notifier: Notifier = {
    async enviarEmail(m) {
      correos.push(m);
    },
  };

  const ctx: AppContext = {
    logger,
    clock,
    ids: idGenerator,
    config: {
      confCodeTtlMs: 15 * 60_000,
      retrasoUmbralHoras: 6,
      adminEmail: 'admin@agroflete.ec',
      geocercaAcopioM: 300,
    },
    tokens: makeLocalTokenService('secreto-it-1234567890', '1h'),
    hasher: bcryptHasher,
    events: makeOutboxEventBus({ outbox, ids: idGenerator, clock }),
    notifier,
    geocoding: geocodingDePrueba,
    routing: routingDePrueba,
    repos: {
      usuarios: makeUsuarioRepository(doc, tabla),
      outbox,
      acopios: makeAcopioRepository(doc, tabla),
      inventario: makeInventarioRepository(doc, tabla),
      reglas: makeReglasTarifaRepository(doc, tabla),
      ajustes: makeAjustesRepository(doc, tabla),
      solicitudes: makeSolicitudRepository(doc, tabla),
      vehiculos: makeVehiculoRepository(doc, tabla),
      fletes: makeFleteRepository(doc, tabla),
    },
  };
  return { ctx, correos };
}
