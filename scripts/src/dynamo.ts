import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const TABLE_NAME = process.env.TABLE_NAME ?? 'AgrofleteTable';
export const ENDPOINT = process.env.DYNAMO_ENDPOINT ?? 'http://localhost:8010';

export const rawClient = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: process.env.AWS_REGION ?? 'local',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'local',
  },
});

export const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true },
});

/** Índices secundarios globales sobreescritos (overloaded) usados por la app. */
export const GSIS = [
  { name: 'gsi1', use: 'usuarios por email' },
  { name: 'gsi2', use: 'vehículos disponibles por zona' },
  { name: 'gsi3', use: 'solicitudes / fletes por productor' },
  { name: 'gsi4', use: 'solicitudes / fletes por estado' },
  { name: 'gsi5', use: 'vehículos / fletes por transportista' },
  { name: 'gsi6', use: 'reservado' },
] as const;
