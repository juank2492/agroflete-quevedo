import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { ENDPOINT, GSIS, TABLE_NAME, rawClient } from './dynamo.js';

const reset = process.argv.includes('--reset');

async function tableExists(): Promise<boolean> {
  try {
    await rawClient.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    return true;
  } catch (err) {
    if (err instanceof ResourceNotFoundException) return false;
    throw err;
  }
}

async function main(): Promise<void> {
  console.log(`DynamoDB endpoint: ${ENDPOINT}`);
  console.log(`Tabla: ${TABLE_NAME}`);

  if (await tableExists()) {
    if (!reset) {
      console.log('La tabla ya existe. Usa --reset para recrearla.');
      return;
    }
    console.log('Eliminando tabla existente (--reset)...');
    await rawClient.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
    await new Promise((r) => setTimeout(r, 500));
  }

  const attributeNames = ['PK', 'SK', ...GSIS.flatMap((g) => [`${g.name}pk`, `${g.name}sk`])];

  await rawClient.send(
    new CreateTableCommand({
      TableName: TABLE_NAME,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: attributeNames.map((name) => ({
        AttributeName: name,
        AttributeType: 'S',
      })),
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: GSIS.map((g) => ({
        IndexName: g.name,
        KeySchema: [
          { AttributeName: `${g.name}pk`, KeyType: 'HASH' as const },
          { AttributeName: `${g.name}sk`, KeyType: 'RANGE' as const },
        ],
        Projection: { ProjectionType: 'ALL' as const },
      })),
    }),
  );

  await waitUntilTableExists({ client: rawClient, maxWaitTime: 30 }, { TableName: TABLE_NAME });
  console.log('Tabla creada:');
  for (const g of GSIS) console.log(`  - ${g.name}: ${g.use}`);
}

main().catch((err) => {
  console.error('Fallo en migrate:', err);
  process.exit(1);
});
