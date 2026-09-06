import type { AsignarFleteRequest, Flete, Vehiculo } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ConflictError, NotFoundError } from '../../domain/errors.js';

export async function listarVehiculosCompatibles(
  ctx: AppContext,
  solicitudId: string,
): Promise<Vehiculo[]> {
  const solicitud = await ctx.repos.solicitudes.porId(solicitudId);
  if (!solicitud) throw new NotFoundError('Solicitud no encontrada');

  const disponibles = await ctx.repos.vehiculos.disponiblesEnZona(solicitud.zona);
  return disponibles.filter((v) => v.capacidadTon >= solicitud.pesoTon);
}

export async function asignarFlete(
  ctx: AppContext,
  adminId: string,
  input: AsignarFleteRequest,
): Promise<Flete> {
  const solicitud = await ctx.repos.solicitudes.porId(input.solicitudId);
  if (!solicitud) throw new NotFoundError('Solicitud no encontrada');
  if (solicitud.estado !== 'PENDIENTE') {
    throw new ConflictError('La solicitud ya no está pendiente');
  }

  const vehiculo = await ctx.repos.vehiculos.porId(input.vehiculoId);
  if (!vehiculo) throw new NotFoundError('Vehículo no encontrado');
  if (vehiculo.estado !== 'DISPONIBLE') {
    throw new ConflictError('El vehículo no está disponible');
  }
  if (vehiculo.zona !== solicitud.zona) {
    throw new ConflictError('El vehículo no opera en la zona de la solicitud');
  }
  if (vehiculo.capacidadTon < solicitud.pesoTon) {
    throw new ConflictError('El vehículo no tiene capacidad suficiente');
  }

  const ts = ctx.clock.nowIso();
  const flete: Flete = {
    id: ctx.ids.uuid(),
    solicitudId: solicitud.id,
    vehiculoId: vehiculo.id,
    transportistaId: vehiculo.transportistaId,
    productorId: solicitud.productorId,
    tarifa: solicitud.tarifaEstimada,
    estado: 'ASIGNADO',
    timeline: [{ estado: 'ASIGNADO', ts, actorId: adminId }],
    createdAt: ts,
  };

  // Guardas optimistas: si otra asignación ganó la carrera, esto lanza ConflictError.
  await ctx.repos.solicitudes.actualizar(
    solicitud.id,
    { estado: 'ASIGNADA', fleteId: flete.id },
    { estadoActual: 'PENDIENTE' },
  );
  await ctx.repos.vehiculos.actualizar(
    vehiculo.id,
    { estado: 'OCUPADO' },
    { estadoActual: 'DISPONIBLE' },
  );
  await ctx.repos.fletes.crear(flete);

  await ctx.events.publish('FleteAsignado', {
    fleteId: flete.id,
    solicitudId: solicitud.id,
    productorId: solicitud.productorId,
    transportistaId: vehiculo.transportistaId,
  });

  return flete;
}
