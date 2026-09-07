import {
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { InventarioRepository, StockRecord } from '../../../core/ports/repositories.js';

const pk = (acopioId: string) => `ACOPIO#${acopioId}`;
const sk = (cultivo: string) => `STOCK#${cultivo}`;

function fromItem(it: Record<string, unknown>, acopioId: string): StockRecord {
  return {
    acopioId,
    cultivo: it['cultivo'] as string,
    cantidadActual: Number(it['cantidadActual'] ?? 0),
    umbralMinimo: Number(it['umbralMinimo'] ?? 0),
    umbralMaximo: Number(it['umbralMaximo'] ?? 0),
  };
}

export function makeInventarioRepository(
  doc: DynamoDBDocumentClient,
  table: string,
): InventarioRepository {
  return {
    async porAcopio(acopioId) {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: { ':pk': pk(acopioId), ':sk': 'STOCK#' },
        }),
      );
      return (res.Items ?? []).map((it) => fromItem(it, acopioId));
    },

    async obtener(acopioId, cultivo) {
      const res = await doc.send(
        new GetCommand({ TableName: table, Key: { PK: pk(acopioId), SK: sk(cultivo) } }),
      );
      return res.Item ? fromItem(res.Item, acopioId) : null;
    },

    async guardar(rec) {
      await doc.send(
        new PutCommand({
          TableName: table,
          Item: {
            PK: pk(rec.acopioId),
            SK: sk(rec.cultivo),
            cultivo: rec.cultivo,
            cantidadActual: rec.cantidadActual,
            umbralMinimo: rec.umbralMinimo,
            umbralMaximo: rec.umbralMaximo,
          },
        }),
      );
    },
  };
}
