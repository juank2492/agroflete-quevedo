import {
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { Acopio } from '@agroflete/shared';
import type { AcopioRepository } from '../../../core/ports/repositories.js';

const PK = 'CATALOGO#ACOPIOS';
const sk = (id: string) => `ACOPIO#${id}`;

export function makeAcopioRepository(doc: DynamoDBDocumentClient, table: string): AcopioRepository {
  return {
    async listar() {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: { ':pk': PK },
        }),
      );
      return (res.Items ?? []).map((it) => ({
        id: it['id'],
        nombre: it['nombre'],
        lat: it['lat'],
        lon: it['lon'],
        zona: it['zona'],
      })) as Acopio[];
    },

    async porId(id) {
      const res = await doc.send(new GetCommand({ TableName: table, Key: { PK, SK: sk(id) } }));
      if (!res.Item) return null;
      const it = res.Item;
      return {
        id: it['id'],
        nombre: it['nombre'],
        lat: it['lat'],
        lon: it['lon'],
        zona: it['zona'],
      };
    },

    async guardar(acopio) {
      await doc.send(
        new PutCommand({
          TableName: table,
          Item: { PK, SK: sk(acopio.id), ...acopio },
        }),
      );
    },
  };
}
