import {
  puedeReportarIncidencia,
  type Flete,
  type JwtClaims,
  type RegistrarIncidenciaRequest,
} from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors.js';

/** Devuelve la solicitud a la cola y libera o inactiva el vehículo afectado. */
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
  const incidencia = {
    motivo: input.motivo,
    ts,
    vehiculoFueraDeServicio: input.vehiculoFueraDeServicio,
  };
  const timeline = [...flete.timeline, { estado: 'INCIDENCIA' as const, ts, actorId: user.sub }];

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
  });

  return { ...flete, estado: 'INCIDENCIA', timeline, incidencia };
}
