import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

if (process.env['NODE_ENV'] !== 'production') {
  for (const candidate of [
    resolve(process.cwd(), '../.env.local'),
    resolve(process.cwd(), '.env.local'),
  ]) {
    if (existsSync(candidate)) loadDotenv({ path: candidate, override: false });
  }
}

const bool = z
  .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])
  .transform((v) => v === '1' || v === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    WEB_ORIGIN: z.string().default('http://localhost:4200'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    JWT_SECRET: z.string().min(8).default('dev-secret-local-agroflete-2026'),
    JWT_EXPIRES_IN: z.string().default('8h'),
    CONF_CODE_TTL_MINUTES: z.coerce.number().int().positive().default(15),

    TABLE_NAME: z.string().default('AgrofleteTable'),
    DYNAMO_ENDPOINT: z.string().default('http://localhost:8010'),
    AWS_REGION: z.string().default('local'),
    AWS_ACCESS_KEY_ID: z.string().default('local'),
    AWS_SECRET_ACCESS_KEY: z.string().default('local'),

    SMTP_HOST: z.string().default('127.0.0.1'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_SECURE: bool.optional(),
    SMTP_FROM: z.string().default('AgrofleteQ <no-reply@agroflete.local>'),
    /** Destinatario de las alertas operativas. */
    ADMIN_EMAIL: z.string().default('admin@agroflete.ec'),

    OUTBOX_POLL_MS: z.coerce.number().int().positive().default(2000),
    CRON_DEMO: bool.default('0'),
    RETRASO_UMBRAL_HORAS: z.coerce.number().int().positive().default(6),
    /** Exige el pago confirmado de la solicitud antes de asignarla. */
    PAGO_OBLIGATORIO: bool.default('1'),

    /** Claves VAPID para Web Push. Si faltan, el push queda deshabilitado. */
    VAPID_PUBLIC_KEY: z.string().default(''),
    VAPID_PRIVATE_KEY: z.string().default(''),
    VAPID_SUBJECT: z.string().default('mailto:no-reply@agroflete.local'),

    /** Endpoint del proveedor de rutas. */
    OSRM_URL: z.string().default('https://router.project-osrm.org'),
    /** Radio de confirmación automática de entrega. */
    GEOCERCA_ACOPIO_M: z.coerce.number().int().positive().default(300),
    /** Centro y radio de búsqueda de lugares. */
    GEO_CENTRO_LAT: z.coerce.number().default(-1.03),
    GEO_CENTRO_LON: z.coerce.number().default(-79.46),
    GEO_RADIO_KM: z.coerce.number().positive().default(90),
    APP_SECRET_ARN: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;

    const invalid = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (value.AWS_REGION === 'local') invalid('AWS_REGION', 'AWS_REGION debe ser una región AWS');
    if (!value.WEB_ORIGIN.startsWith('https://'))
      invalid('WEB_ORIGIN', 'WEB_ORIGIN debe usar HTTPS');
    if (value.JWT_SECRET.length < 32 || value.JWT_SECRET.includes('dev-secret'))
      invalid('JWT_SECRET', 'JWT_SECRET de producción debe tener al menos 32 caracteres');
    if (value.SMTP_HOST === '127.0.0.1' || value.SMTP_HOST === 'localhost')
      invalid('SMTP_HOST', 'SMTP_HOST debe apuntar al proveedor de producción');
    if (value.SMTP_FROM.includes('agroflete.local'))
      invalid('SMTP_FROM', 'SMTP_FROM debe ser un remitente autorizado');
    if (!value.APP_SECRET_ARN) invalid('APP_SECRET_ARN', 'Falta APP_SECRET_ARN');
  });

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
