import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import type { EstadoFlete, Flete, UbicacionFlete } from '@agroflete/shared';
import { ConflictError } from '../../../core/domain/errors.js';
import type { FleteRepository } from '../../../core/ports/repositories.js';

const SK = 'META';
const pk = (id: string) => `FLETE#${id}`;
const transpPk = (id: string) => `TRANSP_FLETE#${id}`;
const prodPk = (id: string) => `PRODUCTOR_FLETE#${id}`;
const estadoPk = (e: EstadoFlete) => `ESTADO_FLETE#${e}`;

interface FleteItem extends Flete {
  PK: string;
  SK: string;
  gsi3pk: string;
  gsi3sk: string;
  gsi4pk: string;
  gsi4sk: string;
  gsi5pk: string;
  gsi5sk: string;
}

function toItem(f: Flete): FleteItem {
  return {
    ...f,
    PK: pk(f.id),
    SK,
    gsi3pk: prodPk(f.productorId),
    gsi3sk: f.createdAt,
    gsi4pk: estadoPk(f.estado),
    gsi4sk: f.createdAt,
    gsi5pk: transpPk(f.transportistaId),
    gsi5sk: f.createdAt,
  };
}

function fromItem(item: Record<string, unknown>): Flete {
  const {
    PK: _p,
    SK: _s,
    gsi3pk: _a,
    gsi3sk: _b,
    gsi4pk: _c,
    gsi4sk: _d,
    gsi5pk: _e,
    gsi5sk: _g,
    ...rest
  } = item as unknown as FleteItem;
  return rest;
}

async function queryIndex(
  doc: DynamoDBDocumentClient,
  table: string,
  index: string,
  pkAttr: string,
  pkValue: string,
): Promise<Flete[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: table,
      IndexName: index,
      KeyConditionExpression: `${pkAttr} = :pk`,
      ExpressionAttributeValues: { ':pk': pkValue },
      ScanIndexForward: false,
    }),
  );
  return (res.Items ?? []).map(fromItem);
}

export function makeFleteRepository(doc: DynamoDBDocumentClient, table: string): FleteRepository {
  return {
    async crear(flete) {
      await doc.send(new PutCommand({ TableName: table, Item: toItem(flete) }));
    },

    async porId(id) {
      const res = await doc.send(new GetCommand({ TableName: table, Key: { PK: pk(id), SK } }));
      return res.Item ? fromItem(res.Item) : null;
    },

    porTransportista: (id) => queryIndex(doc, table, 'gsi5', 'gsi5pk', transpPk(id)),
    porProductor: (id) => queryIndex(doc, table, 'gsi3', 'gsi3pk', prodPk(id)),
    porEstado: (estado) => queryIndex(doc, table, 'gsi4', 'gsi4pk', estadoPk(estado)),

    async agregarTrack(fleteId, punto) {
      await doc.send(
        new PutCommand({
          TableName: table,
          Item: {
            PK: pk(fleteId),
            SK: `TRACK#${punto.ts}`,
            lat: punto.lat,
            lon: punto.lon,
            ts: punto.ts,
            ...(punto.velocidad !== undefined ? { velocidad: punto.velocidad } : {}),
          },
        }),
      );
    },

    async ruta(fleteId) {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: { ':pk': pk(fleteId), ':sk': 'TRACK#' },
        }),
      );
      return (res.Items ?? []).map((it) => ({
        lat: Number(it['lat']),
        lon: Number(it['lon']),
        ts: it['ts'] as string,
        ...(it['velocidad'] !== undefined ? { velocidad: Number(it['velocidad']) } : {}),
      })) as UbicacionFlete[];
    },

    async actualizar(id, patch, opts) {
      const names: Record<string, string> = {};
      const values: Record<string, unknown> = {};
      const sets: string[] = [];

      if (patch.estado !== undefined) {
        names['#estado'] = 'estado';
        names['#g4p'] = 'gsi4pk';
        sets.push('#estado = :estado', '#g4p = :g4p');
        values[':estado'] = patch.estado;
        values[':g4p'] = estadoPk(patch.estado);
      }
      if (patch.timeline !== undefined) {
        names['#timeline'] = 'timeline';
        sets.push('#timeline = :timeline');
        values[':timeline'] = patch.timeline;
      }
      if (patch.incidencia !== undefined) {
        names['#incidencia'] = 'incidencia';
        sets.push('#incidencia = :incidencia');
        values[':incidencia'] = patch.incidencia;
      }
      if (patch.ultimaUbicacion !== undefined) {
        names['#ultimaUbicacion'] = 'ultimaUbicacion';
        sets.push('#ultimaUbicacion = :ultimaUbicacion');
        values[':ultimaUbicacion'] = patch.ultimaUbicacion;
      }
      if (patch.motivoCancelacion !== undefined) {
        names['#motivoCancelacion'] = 'motivoCancelacion';
        sets.push('#motivoCancelacion = :motivoCancelacion');
        values[':motivoCancelacion'] = patch.motivoCancelacion;
      }
      if (!sets.length) return;

      let condition = 'attribute_exists(PK)';
      if (opts?.estadoActual) {
        names['#estadoCond'] = 'estado';
        values[':estadoActual'] = opts.estadoActual;
        condition += ' AND #estadoCond = :estadoActual';
      }

      try {
        await doc.send(
          new UpdateCommand({
            TableName: table,
            Key: { PK: pk(id), SK },
            UpdateExpression: `SET ${sets.join(', ')}`,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ConditionExpression: condition,
          }),
        );
      } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
          throw new ConflictError('El flete ya no está en el estado esperado');
        }
        throw err;
      }
    },
  };
}
