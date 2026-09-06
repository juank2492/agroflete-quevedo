import { GetCommand, PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { REGLAS_TARIFA_DEFAULT, reglasTarifaSchema, type ReglasTarifa } from '@agroflete/shared';
import type { ReglasTarifaRepository } from '../../../core/ports/repositories.js';

const KEY = { PK: 'TARIFA#REGLAS', SK: 'VIGENTE' };

export function makeReglasTarifaRepository(
  doc: DynamoDBDocumentClient,
  table: string,
): ReglasTarifaRepository {
  return {
    async obtener() {
      const res = await doc.send(new GetCommand({ TableName: table, Key: KEY }));
      if (!res.Item) return REGLAS_TARIFA_DEFAULT;
      const parsed = reglasTarifaSchema.safeParse(res.Item);
      return parsed.success ? parsed.data : REGLAS_TARIFA_DEFAULT;
    },

    async guardar(reglas: ReglasTarifa) {
      await doc.send(new PutCommand({ TableName: table, Item: { ...KEY, ...reglas } }));
    },
  };
}
