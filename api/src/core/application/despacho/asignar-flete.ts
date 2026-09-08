import {
  pagoConfirmado,
  type AsignarFleteRequest,
  type Flete,
  type Vehiculo,
} from '@agroflete/shared';
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
  opts?: { auto?: boolean },
): Promise<Flete> {
  const auto = opts?.auto === true;
  const solicitud = await ctx.repos.solicitudes.porId(input.solicitudId);
  if (!solicitud) throw new NotFoundError('Solicitud no encontrada');
  if (solicitud.estado !== 'PENDIENTE') {
    throw new ConflictError('La solicitud ya no está pendiente');
  }
  if (ctx.config.pagoObligatorio && !pagoConfirmado(solicitud)) {
    throw new ConflictError('La solicitud aún no tiene el pago confirmado');
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
  const origen = solicitud.origen;
  const destino = { lat: solicitud.acopioLat, lon: solicitud.acopioLon };
  const [transportista, productor] = await Promise.all([
    ctx.repos.usuarios.porId(vehiculo.transportistaId),
    ctx.repos.usuarios.porId(solicitud.productorId),
  ]);

  // La ruta es opcional: un fallo del proveedor no bloquea la asignación.
  let vial: Partial<
    Pick<Flete, 'rutaVial' | 'distanciaVialKm' | 'duracionEstimadaMin' | 'rutaAproximada'>
  > = {};
  try {
    const r = await ctx.routing.calcularRuta(origen, destino);
    vial = {
      rutaVial: r.geometria,
      distanciaVialKm: r.distanciaKm,
      duracionEstimadaMin: r.duracionMin,
      rutaAproximada: r.aproximada,
    };
  } catch (err) {
    ctx.logger.warn(
      { err, solicitudId: solicitud.id },
      'no se pudo calcular la ruta vial del flete',
    );
  }

  // La tarifa del flete es SIEMPRE la que el productor ya pagó (`tarifaEstimada`).
  // La ruta vial solo sirve para el mapa: nunca cambia lo cobrado.
  const flete: Flete = {
    id: ctx.ids.uuid(),
    solicitudId: solicitud.id,
    vehiculoId: vehiculo.id,
    transportistaId: vehiculo.transportistaId,
    productorId: solicitud.productorId,
    origen,
    ...(solicitud.origenNombre ? { origenNombre: solicitud.origenNombre } : {}),
    destino,
    cultivoNombre: solicitud.cultivoNombre,
    pesoTon: solicitud.pesoTon,
    acopioNombre: solicitud.acopioNombre,
    ...(transportista ? { transportistaNombre: transportista.nombreCompleto } : {}),
    ...(productor ? { productorNombre: productor.nombreCompleto } : {}),
    vehiculoPlaca: vehiculo.placa,
    tarifa: solicitud.tarifaEstimada,
    estado: 'ASIGNADO',
    timeline: [{ estado: 'ASIGNADO', ts, actorId: adminId }],
    createdAt: ts,
    ...vial,
    ...(auto ? { auto: true } : {}),
  };

  // Evita asignaciones concurrentes.
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
    ...(auto ? { auto: true } : {}),
  });

  return flete;
}
