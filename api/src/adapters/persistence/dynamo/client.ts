import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { env } from '../../config/env.js';

/**
 * Cliente de DynamoDB. En local apunta al emulador (DYNAMO_ENDPOINT); en AWS,
 * omitir el endpoint hace que el SDK use el servicio real de la región.
 */
const raw = new DynamoDBClient({
  region: env.AWS_REGION,
  ...(env.DYNAMO_ENDPOINT ? { endpoint: env.DYNAMO_ENDPOINT } : {}),
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export function makeDocClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(raw, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export const TABLE = env.TABLE_NAME;
