import {
  puedeReportarIncidencia,
  type Flete,
  type IncidenciaFlete,
  type JwtClaims,
  type RegistrarIncidenciaRequest,
} from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors.js';

/**
 * Registra una incidencia en ruta.
 *
 * - `leve`: el vehículo sigue el viaje. El flete no cambia de estado; solo se
 *   deja constancia y se avisa al productor de la demora.
 * - `grave`: la carga vuelve a la cola del administrador y el vehículo se libera
 *   (o se inactiva) para reasignar el flete a otro vehículo.
 */
export async function registrarIncidencia(
  ctx: AppContext,
  user: JwtClaims,
  id: string,
  input: RegistrarIncidenciaRequest,
): Promise<Flete> {
  const flete = await ctx.repos.fletes.porId(id);
  if (!flete) throw new NotFoundError('Flete no encontrado');

  const esDueno = user.role === 'transportista' && flete.transportistaId === user.sub;
  if (!esDueno && user.role !== 'admin') {
    throw new ForbiddenError('No puedes reportar incidencias en este flete');
  }
  if (!puedeReportarIncidencia(flete.estado)) {
    throw new ConflictError(`No se puede reportar una incidencia desde ${flete.estado}`);
  }

  const ts = ctx.clock.nowIso();
  const leve = input.gravedad === 'leve';
  const incidencia: IncidenciaFlete = {
    motivo: input.motivo,
    ts,
    gravedad: input.gravedad,
    vehiculoFueraDeServicio: leve ? false : input.vehiculoFueraDeServicio,
  };
  const timeline = [...flete.timeline, { estado: 'INCIDENCIA' as const, ts, actorId: user.sub }];

  if (leve) {
    // El flete mantiene su estado; solo se deja el registro y se avisa.
    await ctx.repos.fletes.actualizar(id, { timeline, incidencia }, { estadoActual: flete.estado });
    await ctx.events.publish('IncidenciaEnRuta', {
      fleteId: id,
      solicitudId: flete.solicitudId,
      productorId: flete.productorId,
      transportistaId: flete.transportistaId,
      motivo: input.motivo,
      gravedad: 'leve',
    });
    return { ...flete, timeline, incidencia };
  }

  await ctx.repos.fletes.actualizar(
    id,
    { estado: 'INCIDENCIA', timeline, incidencia },
    { estadoActual: flete.estado },
  );

  await ctx.repos.solicitudes.actualizar(flete.solicitudId, {
    estado: 'PENDIENTE',
    fleteId: undefined,
    reasignacionPorIncidencia: true,
    motivoIncidencia: input.motivo,
  });

  await ctx.repos.vehiculos.actualizar(flete.vehiculoId, {
    estado: input.vehiculoFueraDeServicio ? 'INACTIVO' : 'DISPONIBLE',
  });

  await ctx.events.publish('IncidenciaEnRuta', {
    fleteId: id,
    solicitudId: flete.solicitudId,
    productorId: flete.productorId,
    transportistaId: flete.transportistaId,
    motivo: input.motivo,
    gravedad: 'grave',
  });

  return { ...flete, estado: 'INCIDENCIA', timeline, incidencia };
}
