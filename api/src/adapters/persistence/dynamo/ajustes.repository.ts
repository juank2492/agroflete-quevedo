import { GetCommand, PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  AJUSTES_OPERACION_DEFAULT,
  ajustesOperacionSchema,
  type AjustesOperacion,
} from '@agroflete/shared';
import type { AjustesRepository } from '../../../core/ports/repositories.js';

const KEY = { PK: 'AJUSTE#OPERACION', SK: 'VIGENTE' };

export function makeAjustesRepository(
  doc: DynamoDBDocumentClient,
  table: string,
): AjustesRepository {
  return {
    async obtener() {
      const res = await doc.send(new GetCommand({ TableName: table, Key: KEY }));
      if (!res.Item) return AJUSTES_OPERACION_DEFAULT;
      const parsed = ajustesOperacionSchema.safeParse(res.Item);
      return parsed.success ? parsed.data : AJUSTES_OPERACION_DEFAULT;
    },

    async guardar(ajustes: AjustesOperacion) {
      await doc.send(new PutCommand({ TableName: table, Item: { ...KEY, ...ajustes } }));
    },
  };
}
