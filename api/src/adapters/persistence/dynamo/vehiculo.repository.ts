import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import type { Vehiculo, Zona } from '@agroflete/shared';
import { ConflictError } from '../../../core/domain/errors.js';
import type { VehiculoRepository } from '../../../core/ports/repositories.js';

const SK = 'META';
const pk = (id: string) => `VEHICULO#${id}`;
const dispPk = (zona: Zona) => `DISP#${zona}`;
const transpPk = (transportistaId: string) => `TRANSP_VEH#${transportistaId}`;

interface VehiculoItem extends Vehiculo {
  PK: string;
  SK: string;
  gsi2pk?: string;
  gsi2sk?: string;
  gsi5pk: string;
  gsi5sk: string;
}

function toItem(v: Vehiculo): VehiculoItem {
  const base: VehiculoItem = {
    ...v,
    PK: pk(v.id),
    SK,
    gsi5pk: transpPk(v.transportistaId),
    gsi5sk: pk(v.id),
  };
  if (v.estado === 'DISPONIBLE') {
    base.gsi2pk = dispPk(v.zona);
    base.gsi2sk = pk(v.id);
  }
  return base;
}

function fromItem(item: Record<string, unknown>): Vehiculo {
  const {
    PK: _p,
    SK: _s,
    gsi2pk: _g2p,
    gsi2sk: _g2s,
    gsi5pk: _g5p,
    gsi5sk: _g5s,
    ...rest
  } = item as unknown as VehiculoItem;
  return rest;
}

export function makeVehiculoRepository(
  doc: DynamoDBDocumentClient,
  table: string,
): VehiculoRepository {
  return {
    async crear(vehiculo) {
      await doc.send(new PutCommand({ TableName: table, Item: toItem(vehiculo) }));
    },

    async porId(id) {
      const res = await doc.send(new GetCommand({ TableName: table, Key: { PK: pk(id), SK } }));
      return res.Item ? fromItem(res.Item) : null;
    },

    async porTransportista(transportistaId) {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          IndexName: 'gsi5',
          KeyConditionExpression: 'gsi5pk = :pk',
          ExpressionAttributeValues: { ':pk': transpPk(transportistaId) },
        }),
      );
      return (res.Items ?? []).map(fromItem);
    },

    async listarTodos() {
      const res = await doc.send(
        new ScanCommand({
          TableName: table,
          FilterExpression: 'SK = :sk AND begins_with(PK, :pfx)',
          ExpressionAttributeValues: { ':sk': SK, ':pfx': 'VEHICULO#' },
        }),
      );
      return (res.Items ?? []).map(fromItem);
    },

    async disponiblesEnZona(zona) {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          IndexName: 'gsi2',
          KeyConditionExpression: 'gsi2pk = :pk',
          ExpressionAttributeValues: { ':pk': dispPk(zona) },
        }),
      );
      return (res.Items ?? []).map(fromItem);
    },

    async actualizar(id, patch, opts) {
      const actual = await this.porId(id);
      if (!actual) throw new ConflictError('El vehículo no existe');

      const nuevo: Vehiculo = { ...actual, ...patch };
      const sets: string[] = [];
      const removes: string[] = [];
      const names: Record<string, string> = {};
      const values: Record<string, unknown> = {};

      for (const key of ['estado', 'tipo', 'capacidadTon', 'zona'] as const) {
        if (patch[key] !== undefined) {
          names[`#${key}`] = key;
          sets.push(`#${key} = :${key}`);
          values[`:${key}`] = patch[key];
        }
      }

      // Mantiene el índice de disponibilidad.
      names['#g2p'] = 'gsi2pk';
      names['#g2s'] = 'gsi2sk';
      if (nuevo.estado === 'DISPONIBLE') {
        sets.push('#g2p = :g2p', '#g2s = :g2s');
        values[':g2p'] = dispPk(nuevo.zona);
        values[':g2s'] = pk(id);
      } else {
        removes.push('#g2p', '#g2s');
      }

      const expr = [
        sets.length ? `SET ${sets.join(', ')}` : '',
        removes.length ? `REMOVE ${removes.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' ');

      let condition = 'attribute_exists(PK)';
      if (opts?.estadoActual) {
        names['#estado'] = 'estado';
        values[':estadoActual'] = opts.estadoActual;
        condition += ' AND #estado = :estadoActual';
      }

      try {
        await doc.send(
          new UpdateCommand({
            TableName: table,
            Key: { PK: pk(id), SK },
            UpdateExpression: expr,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ConditionExpression: condition,
          }),
        );
      } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
          throw new ConflictError('El vehículo ya no está en el estado esperado');
        }
        throw err;
      }
    },
  };
}
