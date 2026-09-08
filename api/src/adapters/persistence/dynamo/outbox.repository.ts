import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { OutboxRecord, OutboxRepository } from '../../../core/ports/repositories.js';

const SK = 'EVENTO';
const PENDIENTE_PK = 'OUTBOX#PENDIENTE';
const pk = (id: string) => `OUTBOX#${id}`;

export function makeOutboxRepository(doc: DynamoDBDocumentClient, table: string): OutboxRepository {
  const toRecord = (it: Record<string, unknown>): OutboxRecord => ({
    id: it['id'] as string,
    tipo: it['tipo'] as OutboxRecord['tipo'],
    payload: it['payload'],
    createdAt: it['createdAt'] as string,
    estado: it['estado'] as OutboxRecord['estado'],
    intentos: (it['intentos'] as number | undefined) ?? 0,
    procesadoPor: (it['procesadoPor'] as string[] | undefined) ?? [],
  });

  return {
    async agregar(rec) {
      const item: Record<string, unknown> = {
        PK: pk(rec.id),
        SK,
        id: rec.id,
        tipo: rec.tipo,
        payload: rec.payload,
        createdAt: rec.createdAt,
        estado: 'PENDIENTE',
        intentos: 0,
        procesadoPor: [],
        // Al procesarlo se elimina del índice de pendientes.
        gsi6pk: PENDIENTE_PK,
        gsi6sk: rec.id,
      };
      await doc.send(new PutCommand({ TableName: table, Item: item }));
    },

    async porId(id) {
      const res = await doc.send(new GetCommand({ TableName: table, Key: { PK: pk(id), SK } }));
      return res.Item ? toRecord(res.Item) : null;
    },

    async pendientes(limite) {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          IndexName: 'gsi6',
          KeyConditionExpression: 'gsi6pk = :pk',
          ExpressionAttributeValues: { ':pk': PENDIENTE_PK },
          Limit: limite,
          ScanIndexForward: true,
        }),
      );
      return (res.Items ?? []).map(toRecord);
    },

    async marcarSuscriptor(id, suscriptor) {
      await doc.send(
        new UpdateCommand({
          TableName: table,
          Key: { PK: pk(id), SK },
          UpdateExpression:
            'SET procesadoPor = list_append(if_not_exists(procesadoPor, :empty), :s)',
          ExpressionAttributeValues: { ':s': [suscriptor], ':empty': [] },
        }),
      );
    },

    async marcarProcesado(id) {
      await doc.send(
        new UpdateCommand({
          TableName: table,
          Key: { PK: pk(id), SK },
          UpdateExpression: 'SET #estado = :done REMOVE gsi6pk, gsi6sk',
          ExpressionAttributeNames: { '#estado': 'estado' },
          ExpressionAttributeValues: { ':done': 'PROCESADO' },
        }),
      );
    },

    async registrarIntento(id) {
      await doc.send(
        new UpdateCommand({
          TableName: table,
          Key: { PK: pk(id), SK },
          UpdateExpression: 'ADD intentos :one',
          ExpressionAttributeValues: { ':one': 1 },
        }),
      );
    },
  };
}
