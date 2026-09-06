import type {
  ActualizarVehiculoRequest,
  RegistrarVehiculoRequest,
  Vehiculo,
} from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors.js';

export async function registrarVehiculo(
  ctx: AppContext,
  transportistaId: string,
  input: RegistrarVehiculoRequest,
): Promise<Vehiculo> {
  const vehiculo: Vehiculo = {
    id: ctx.ids.uuid(),
    transportistaId,
    placa: input.placa,
    tipo: input.tipo,
    capacidadTon: input.capacidadTon,
    zona: input.zona,
    estado: 'DISPONIBLE',
  };
  await ctx.repos.vehiculos.crear(vehiculo);
  return vehiculo;
}

export function misVehiculos(ctx: AppContext, transportistaId: string): Promise<Vehiculo[]> {
  return ctx.repos.vehiculos.porTransportista(transportistaId);
}

export async function actualizarVehiculo(
  ctx: AppContext,
  transportistaId: string,
  id: string,
  patch: ActualizarVehiculoRequest,
): Promise<Vehiculo> {
  const actual = await ctx.repos.vehiculos.porId(id);
  if (!actual) throw new NotFoundError('Vehículo no encontrado');
  if (actual.transportistaId !== transportistaId) {
    throw new ForbiddenError('Ese vehículo no es tuyo');
  }
  if (actual.estado === 'OCUPADO' && patch.estado) {
    throw new ConflictError('No puedes cambiar la disponibilidad de un vehículo ocupado');
  }

  await ctx.repos.vehiculos.actualizar(id, patch);
  const actualizado = await ctx.repos.vehiculos.porId(id);
  return actualizado ?? { ...actual, ...patch };
}
