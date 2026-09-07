import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { ConflictError } from '../../../core/domain/errors.js';
import type { UsuarioRecord, UsuarioRepository } from '../../../core/ports/repositories.js';

const SK = 'PERFIL';
const pk = (id: string) => `USUARIO#${id}`;

interface UsuarioItem extends UsuarioRecord {
  PK: string;
  SK: string;
  gsi1pk: string;
  gsi1sk: string;
}

function toItem(u: UsuarioRecord): UsuarioItem {
  return {
    ...u,
    PK: pk(u.id),
    SK,
    gsi1pk: `EMAIL#${u.email}`,
    gsi1sk: 'USUARIO',
  };
}

function fromItem(item: Record<string, unknown>): UsuarioRecord {
  const { PK: _pk, SK: _sk, gsi1pk: _g1, gsi1sk: _g2, ...rest } = item as unknown as UsuarioItem;
  return rest;
}

export function makeUsuarioRepository(
  doc: DynamoDBDocumentClient,
  table: string,
): UsuarioRepository {
  return {
    async crear(usuario) {
      try {
        await doc.send(
          new PutCommand({
            TableName: table,
            Item: toItem(usuario),
            ConditionExpression: 'attribute_not_exists(PK)',
          }),
        );
      } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
          throw new ConflictError('La cuenta ya existe');
        }
        throw err;
      }
    },

    async porId(id) {
      const res = await doc.send(new GetCommand({ TableName: table, Key: { PK: pk(id), SK } }));
      return res.Item ? fromItem(res.Item) : null;
    },

    async porEmail(email) {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          IndexName: 'gsi1',
          KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk = :sk',
          ExpressionAttributeValues: { ':pk': `EMAIL#${email}`, ':sk': 'USUARIO' },
          Limit: 1,
        }),
      );
      const item = res.Items?.[0];
      return item ? fromItem(item) : null;
    },

    async listarPorRol(rol) {
      const res = await doc.send(
        new ScanCommand({
          TableName: table,
          FilterExpression: 'SK = :sk AND #rol = :rol',
          ExpressionAttributeNames: { '#rol': 'rol' },
          ExpressionAttributeValues: { ':sk': SK, ':rol': rol },
        }),
      );
      return (res.Items ?? []).map(fromItem);
    },

    async actualizar(id, patch) {
      const sets: string[] = [];
      const removes: string[] = [];
      const names: Record<string, string> = {};
      const values: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(patch)) {
        if (key === 'id') continue;
        names[`#${key}`] = key;
        if (value === undefined) {
          removes.push(`#${key}`);
        } else {
          sets.push(`#${key} = :${key}`);
          values[`:${key}`] = value;
        }
      }
      if (!sets.length && !removes.length) return;

      const expr = [
        sets.length ? `SET ${sets.join(', ')}` : '',
        removes.length ? `REMOVE ${removes.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' ');

      await doc.send(
        new UpdateCommand({
          TableName: table,
          Key: { PK: pk(id), SK },
          UpdateExpression: expr,
          ExpressionAttributeNames: names,
          ...(Object.keys(values).length ? { ExpressionAttributeValues: values } : {}),
          ConditionExpression: 'attribute_exists(PK)',
        }),
      );
    },
  };
}
