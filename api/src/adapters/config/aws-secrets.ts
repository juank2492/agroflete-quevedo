import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const secretKeys = [
  'JWT_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_SECURE',
  'SMTP_FROM',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
] as const;

let loading: Promise<void> | undefined;

async function fetchProductionSecrets(): Promise<void> {
  if (process.env['NODE_ENV'] !== 'production') return;

  const secretId = process.env['APP_SECRET_ARN'];
  if (!secretId) throw new Error('Falta APP_SECRET_ARN');

  const response = await new SecretsManagerClient({}).send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );
  if (!response.SecretString) throw new Error('El secreto de producción no contiene SecretString');

  const parsed: unknown = JSON.parse(response.SecretString);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('El secreto de producción debe ser un objeto JSON');
  }

  const values = parsed as Record<string, unknown>;
  for (const key of secretKeys) {
    const value = values[key];
    if (value !== undefined && value !== null) process.env[key] = String(value);
  }
}

export function loadProductionSecrets(): Promise<void> {
  loading ??= fetchProductionSecrets();
  return loading;
}
