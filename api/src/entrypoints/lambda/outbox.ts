import type { Context, DynamoDBBatchResponse, DynamoDBStreamEvent } from 'aws-lambda';
import { loadProductionSecrets } from '../../adapters/config/aws-secrets.js';

type OutboxEvent = DynamoDBStreamEvent | { source?: string };

export async function handler(
  event: OutboxEvent,
  context: Context,
): Promise<DynamoDBBatchResponse> {
  context.callbackWaitsForEmptyEventLoop = false;
  await loadProductionSecrets();

  const [{ buildContext }, { procesarEventoOutbox, procesarOutbox }] = await Promise.all([
    import('../../adapters/config/context.js'),
    import('../worker/dispatcher.js'),
  ]);
  const ctx = buildContext();
  const batchItemFailures: DynamoDBBatchResponse['batchItemFailures'] = [];

  if (!('Records' in event)) {
    const procesados = await procesarOutbox(ctx, 100);
    ctx.logger.info({ procesados }, 'recuperación programada de outbox completada');
    return { batchItemFailures };
  }

  for (const record of event.Records) {
    const itemIdentifier = record.dynamodb?.SequenceNumber ?? record.eventID;
    if (!itemIdentifier) throw new Error('Registro de DynamoDB Streams sin identificador');
    const id = record.dynamodb?.NewImage?.['id']?.S;
    if (!id) {
      ctx.logger.error({ eventId: record.eventID }, 'evento outbox sin id');
      batchItemFailures.push({ itemIdentifier });
      continue;
    }

    try {
      await procesarEventoOutbox(ctx, id);
    } catch (err) {
      ctx.logger.error({ eventId: record.eventID, outboxId: id, err: String(err) }, 'fallo outbox');
      batchItemFailures.push({ itemIdentifier });
    }
  }

  return { batchItemFailures };
}
