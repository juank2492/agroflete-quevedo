import serverlessExpress from '@codegenie/serverless-express';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';
import { loadProductionSecrets } from '../../adapters/config/aws-secrets.js';

type Proxy = (
  event: APIGatewayProxyEventV2,
  context: Context,
) => Promise<APIGatewayProxyStructuredResultV2>;

let proxy: Proxy | undefined;

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyStructuredResultV2> {
  context.callbackWaitsForEmptyEventLoop = false;

  if (!proxy) {
    await loadProductionSecrets();
    const [{ buildContext }, { createApp }] = await Promise.all([
      import('../../adapters/config/context.js'),
      import('../http-express/app.js'),
    ]);
    proxy = serverlessExpress<APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2>({
      app: createApp(buildContext()),
    }) as unknown as Proxy;
  }

  return proxy(event, context);
}
