import {
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { Notificacion } from '@agroflete/shared';
import type { NotificacionRepository } from '../../../core/ports/repositories.js';

const pk = (userId: string) => `NOTIF#${userId}`;
const sk = (id: string) => `NOTIF#${id}`;

type Item = Notificacion & { PK: string; SK: string };

function fromItem(it: Record<string, unknown>): Notificacion {
  const { PK: _p, SK: _s, ...rest } = it as unknown as Item;
  return rest;
}

export function makeNotificacionRepository(
  doc: DynamoDBDocumentClient,
  table: string,
): NotificacionRepository {
  return {
    async crear(n) {
      await doc.send(
        new PutCommand({ TableName: table, Item: { ...n, PK: pk(n.userId), SK: sk(n.id) } }),
      );
    },

    async listar(userId, limite) {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: { ':pk': pk(userId), ':sk': 'NOTIF#' },
          ScanIndexForward: false, // ULID descendente: primero las más recientes
          Limit: limite,
        }),
      );
      return (res.Items ?? []).map(fromItem);
    },

    async marcarLeida(userId, id, leidoEnIso) {
      await doc.send(
        new UpdateCommand({
          TableName: table,
          Key: { PK: pk(userId), SK: sk(id) },
          UpdateExpression: 'SET leidoEn = :t',
          ConditionExpression: 'attribute_exists(PK)',
          ExpressionAttributeValues: { ':t': leidoEnIso },
        }),
      );
    },

    async marcarTodasLeidas(userId, leidoEnIso) {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: { ':pk': pk(userId), ':sk': 'NOTIF#' },
          ScanIndexForward: false,
          Limit: 100,
        }),
      );
      const noLeidas = (res.Items ?? []).filter((it) => it['leidoEn'] === undefined);
      await Promise.all(
        noLeidas.map((it) =>
          doc.send(
            new UpdateCommand({
              TableName: table,
              Key: { PK: it['PK'], SK: it['SK'] },
              UpdateExpression: 'SET leidoEn = :t',
              ExpressionAttributeValues: { ':t': leidoEnIso },
            }),
          ),
        ),
      );
      return noLeidas.length;
    },
  };
}
