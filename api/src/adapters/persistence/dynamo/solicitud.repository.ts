import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import type { EstadoSolicitud, Solicitud } from '@agroflete/shared';
import { ConflictError } from '../../../core/domain/errors.js';
import type { SolicitudRepository } from '../../../core/ports/repositories.js';

const SK = 'META';
const pk = (id: string) => `SOLICITUD#${id}`;
const idempPk = (productorId: string, key: string) => `SOL_IDEMP#${productorId}#${key}`;
const gsiProductor = (productorId: string) => `PRODUCTOR#${productorId}`;
const gsiEstado = (estado: EstadoSolicitud) => `ESTADO_SOL#${estado}`;

interface SolicitudItem extends Solicitud {
  PK: string;
  SK: string;
  gsi3pk: string;
  gsi3sk: string;
  gsi4pk: string;
  gsi4sk: string;
}

function toItem(s: Solicitud): SolicitudItem {
  return {
    ...s,
    PK: pk(s.id),
    SK,
    gsi3pk: gsiProductor(s.productorId),
    gsi3sk: s.createdAt,
    gsi4pk: gsiEstado(s.estado),
    gsi4sk: s.createdAt,
  };
}

function fromItem(item: Record<string, unknown>): Solicitud {
  const {
    PK: _pk,
    SK: _sk,
    gsi3pk: _g3p,
    gsi3sk: _g3s,
    gsi4pk: _g4p,
    gsi4sk: _g4s,
    ...rest
  } = item as unknown as SolicitudItem;
  return rest;
}

export function makeSolicitudRepository(
  doc: DynamoDBDocumentClient,
  table: string,
): SolicitudRepository {
  return {
    async crear(solicitud) {
      await doc.send(new PutCommand({ TableName: table, Item: toItem(solicitud) }));
    },

    async porId(id) {
      const res = await doc.send(new GetCommand({ TableName: table, Key: { PK: pk(id), SK } }));
      return res.Item ? fromItem(res.Item) : null;
    },

    async porProductor(productorId) {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          IndexName: 'gsi3',
          KeyConditionExpression: 'gsi3pk = :pk',
          ExpressionAttributeValues: { ':pk': gsiProductor(productorId) },
          ScanIndexForward: false,
        }),
      );
      return (res.Items ?? []).map(fromItem);
    },

    async porEstado(estado) {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          IndexName: 'gsi4',
          KeyConditionExpression: 'gsi4pk = :pk',
          ExpressionAttributeValues: { ':pk': gsiEstado(estado) },
          ScanIndexForward: false,
        }),
      );
      return (res.Items ?? []).map(fromItem);
    },

    async actualizar(id, patch, opts) {
      const sets: string[] = [];
      const removes: string[] = [];
      const names: Record<string, string> = {};
      const values: Record<string, unknown> = {};

      if (patch.estado !== undefined) {
        names['#estado'] = 'estado';
        names['#g4p'] = 'gsi4pk';
        sets.push('#estado = :estado', '#g4p = :g4p');
        values[':estado'] = patch.estado;
        values[':g4p'] = gsiEstado(patch.estado);
      }
      if ('fleteId' in patch) {
        names['#fleteId'] = 'fleteId';
        if (patch.fleteId === undefined) removes.push('#fleteId');
        else {
          sets.push('#fleteId = :fleteId');
          values[':fleteId'] = patch.fleteId;
        }
      }
      if (patch.retrasoNotificado !== undefined) {
        names['#retrasoNotificado'] = 'retrasoNotificado';
        sets.push('#retrasoNotificado = :retrasoNotificado');
        values[':retrasoNotificado'] = patch.retrasoNotificado;
      }
      if (patch.reasignacionPorIncidencia !== undefined) {
        names['#rpi'] = 'reasignacionPorIncidencia';
        sets.push('#rpi = :rpi');
        values[':rpi'] = patch.reasignacionPorIncidencia;
      }
      if (patch.motivoIncidencia !== undefined) {
        names['#mi'] = 'motivoIncidencia';
        sets.push('#mi = :mi');
        values[':mi'] = patch.motivoIncidencia;
      }
      if (patch.pago !== undefined) {
        names['#pago'] = 'pago';
        sets.push('#pago = :pago');
        values[':pago'] = patch.pago;
      }
      if (!sets.length && !removes.length) return;

      const expr = [
        sets.length ? `SET ${sets.join(', ')}` : '',
        removes.length ? `REMOVE ${removes.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' ');

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
            UpdateExpression: expr,
            ExpressionAttributeNames: names,
            ...(Object.keys(values).length ? { ExpressionAttributeValues: values } : {}),
            ConditionExpression: condition,
          }),
        );
      } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
          throw new ConflictError('La solicitud ya no está en el estado esperado');
        }
        throw err;
      }
    },

    async pendientesAntesDe(fechaIso) {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          IndexName: 'gsi4',
          KeyConditionExpression: 'gsi4pk = :pk AND gsi4sk < :corte',
          ExpressionAttributeValues: { ':pk': gsiEstado('PENDIENTE'), ':corte': fechaIso },
        }),
      );
      return (res.Items ?? []).map(fromItem);
    },

    async porIdempotencyKey(productorId, key) {
      const ptr = await doc.send(
        new GetCommand({ TableName: table, Key: { PK: idempPk(productorId, key), SK } }),
      );
      const solicitudId = ptr.Item?.['solicitudId'] as string | undefined;
      if (!solicitudId) return null;
      const res = await doc.send(
        new GetCommand({ TableName: table, Key: { PK: pk(solicitudId), SK } }),
      );
      return res.Item ? fromItem(res.Item) : null;
    },

    async registrarIdempotencia(productorId, key, solicitudId) {
      await doc.send(
        new PutCommand({
          TableName: table,
          Item: { PK: idempPk(productorId, key), SK, solicitudId },
        }),
      );
    },
  };
}
