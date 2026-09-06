/**
 * Espera a que DynamoDB Local acepte conexiones antes de migrar/sembrar.
 * `docker compose up -d` devuelve enseguida, pero el contenedor tarda ~1-2 s
 * en estar listo. Sondea ListTables hasta que responda o venza el tiempo.
 */
import { ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { ENDPOINT, rawClient } from './dynamo.js';

const TIMEOUT_MS = 30_000;
const INTERVALO_MS = 500;

async function esperar(): Promise<void> {
  const limite = Date.now() + TIMEOUT_MS;
  let intento = 0;
  for (;;) {
    intento++;
    try {
      await rawClient.send(new ListTablesCommand({}));
      console.log(`DynamoDB Local listo en ${ENDPOINT} (intento ${intento}).`);
      return;
    } catch (err) {
      if (Date.now() >= limite) {
        console.error(`DynamoDB Local no respondió en ${TIMEOUT_MS / 1000}s (${ENDPOINT}).`);
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, INTERVALO_MS));
    }
  }
}

void esperar();
