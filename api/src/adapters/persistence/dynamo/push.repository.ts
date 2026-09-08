import { createHash } from 'node:crypto';
import {
  DeleteCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { PushSubscriptionDTO } from '@agroflete/shared';
import type { PushSubscriptionRepository } from '../../../core/ports/repositories.js';

const pk = (userId: string) => `PUSH#${userId}`;
const sk = (endpoint: string) => `SUB#${createHash('sha256').update(endpoint).digest('hex')}`;

export function makePushSubscriptionRepository(
  doc: DynamoDBDocumentClient,
  table: string,
): PushSubscriptionRepository {
  return {
    async guardar(userId, sub) {
      await doc.send(
        new PutCommand({
          TableName: table,
          Item: { PK: pk(userId), SK: sk(sub.endpoint), ...sub },
        }),
      );
    },

    async porUsuario(userId) {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: { ':pk': pk(userId), ':sk': 'SUB#' },
        }),
      );
      return (res.Items ?? []).map((it) => ({
        endpoint: it['endpoint'] as string,
        keys: it['keys'] as PushSubscriptionDTO['keys'],
        ...(it['expirationTime'] !== undefined
          ? { expirationTime: it['expirationTime'] as number | null }
          : {}),
      }));
    },

    async eliminar(userId, endpoint) {
      await doc.send(
        new DeleteCommand({ TableName: table, Key: { PK: pk(userId), SK: sk(endpoint) } }),
      );
    },
  };
}
