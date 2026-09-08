import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import {
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  AJUSTES_OPERACION_DEFAULT,
  REGLAS_TARIFA_DEFAULT,
  acopioSchema,
  emailSchema,
  passwordSchema,
  telefonoSchema,
  type Acopio,
} from '@agroflete/shared';

interface BootstrapConfig {
  admin: {
    email: string;
    nombreCompleto: string;
    telefono: string;
  };
  acopios: Acopio[];
}

const region = process.env['AWS_REGION'];
const table = process.env['TABLE_NAME'];
const password = process.env['ADMIN_PASSWORD'];
const confirmation = process.env['CONFIRM_PRODUCTION'];
const configPath = resolve(
  process.cwd(),
  process.env['BOOTSTRAP_CONFIG'] ?? '../infra/bootstrap-prod.local.json',
);

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Falta ${name}`);
  return value;
}

function parseConfig(value: unknown): BootstrapConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('El archivo de bootstrap debe contener un objeto JSON');
  }
  const raw = value as Record<string, unknown>;
  const rawAdmin = raw['admin'];
  if (!rawAdmin || typeof rawAdmin !== 'object' || Array.isArray(rawAdmin)) {
    throw new Error('Falta admin en el archivo de bootstrap');
  }
  const admin = rawAdmin as Record<string, unknown>;
  const nombreCompleto = String(admin['nombreCompleto'] ?? '').trim();
  if (nombreCompleto.length < 3 || nombreCompleto.length > 120) {
    throw new Error('admin.nombreCompleto debe tener entre 3 y 120 caracteres');
  }

  const acopios = acopioSchema.array().min(1).parse(raw['acopios']);
  if (new Set(acopios.map((item) => item.id)).size !== acopios.length) {
    throw new Error('Los identificadores de acopio no pueden repetirse');
  }

  return {
    admin: {
      email: emailSchema.parse(admin['email']),
      nombreCompleto,
      telefono: telefonoSchema.parse(admin['telefono']),
    },
    acopios,
  };
}

async function putIfMissing(
  doc: DynamoDBDocumentClient,
  tableName: string,
  key: { PK: string; SK: string },
  item: Record<string, unknown>,
): Promise<'creado' | 'existente'> {
  const current = await doc.send(new GetCommand({ TableName: tableName, Key: key }));
  if (current.Item) return 'existente';
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    }),
  );
  return 'creado';
}

async function main(): Promise<void> {
  const prodRegion = required(region, 'AWS_REGION');
  const prodTable = required(table, 'TABLE_NAME');
  const adminPassword = required(password, 'ADMIN_PASSWORD');

  if (region === 'local' || process.env['DYNAMO_ENDPOINT']) {
    throw new Error('bootstrap:prod no admite DynamoDB Local');
  }
  if (confirmation !== prodTable || !prodTable.endsWith('-prod')) {
    throw new Error('CONFIRM_PRODUCTION debe coincidir con la tabla terminada en -prod');
  }
  passwordSchema.parse(adminPassword);
  if (adminPassword.length < 12)
    throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres');

  const parsed: unknown = JSON.parse(await readFile(configPath, 'utf8'));
  const config = parseConfig(parsed);
  const raw = new DynamoDBClient({ region: prodRegion });
  const doc = DynamoDBDocumentClient.from(raw, {
    marshallOptions: { removeUndefinedValues: true },
  });

  try {
    const description = await raw.send(new DescribeTableCommand({ TableName: prodTable }));
    if (description.Table?.TableStatus !== 'ACTIVE') throw new Error('La tabla no está ACTIVE');
  } catch (err) {
    if (err instanceof ResourceNotFoundException)
      throw new Error(`No existe la tabla ${prodTable}`);
    throw err;
  }

  const emailLookup = await doc.send(
    new QueryCommand({
      TableName: prodTable,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `EMAIL#${config.admin.email}`,
        ':sk': 'USUARIO',
      },
      Limit: 1,
    }),
  );
  const existingAdmin = emailLookup.Items?.[0];
  if (existingAdmin && existingAdmin['rol'] !== 'admin') {
    throw new Error('El correo del administrador ya pertenece a otro rol');
  }

  let adminResult: 'creado' | 'existente' = 'existente';
  if (!existingAdmin) {
    const id = 'prod-admin';
    const reservedAdmin = await doc.send(
      new GetCommand({ TableName: prodTable, Key: { PK: `USUARIO#${id}`, SK: 'PERFIL' } }),
    );
    if (reservedAdmin.Item) {
      throw new Error('prod-admin ya existe con un correo diferente');
    }
    adminResult = await putIfMissing(
      doc,
      prodTable,
      { PK: `USUARIO#${id}`, SK: 'PERFIL' },
      {
        PK: `USUARIO#${id}`,
        SK: 'PERFIL',
        gsi1pk: `EMAIL#${config.admin.email}`,
        gsi1sk: 'USUARIO',
        id,
        ...config.admin,
        rol: 'admin',
        passwordHash: await bcrypt.hash(adminPassword, 12),
        estado: 'CONFIRMADO',
        createdAt: new Date().toISOString(),
      },
    );
  }

  const tarifas = await putIfMissing(
    doc,
    prodTable,
    { PK: 'TARIFA#REGLAS', SK: 'VIGENTE' },
    { PK: 'TARIFA#REGLAS', SK: 'VIGENTE', ...REGLAS_TARIFA_DEFAULT },
  );
  const ajustes = await putIfMissing(
    doc,
    prodTable,
    { PK: 'AJUSTE#OPERACION', SK: 'VIGENTE' },
    { PK: 'AJUSTE#OPERACION', SK: 'VIGENTE', ...AJUSTES_OPERACION_DEFAULT },
  );

  let acopiosCreados = 0;
  for (const acopio of config.acopios) {
    const result = await putIfMissing(
      doc,
      prodTable,
      { PK: 'CATALOGO#ACOPIOS', SK: `ACOPIO#${acopio.id}` },
      { PK: 'CATALOGO#ACOPIOS', SK: `ACOPIO#${acopio.id}`, ...acopio },
    );
    if (result === 'creado') acopiosCreados++;
  }

  console.log(
    JSON.stringify({
      table: prodTable,
      region: prodRegion,
      admin: adminResult,
      tarifas,
      ajustes,
      acopiosCreados,
      acopiosExistentes: config.acopios.length - acopiosCreados,
    }),
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
