import {
  ESTADOS_FLETE,
  ESTADOS_SOLICITUD,
  type EstadoFlete,
  type MetricasOperativas,
} from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export async function obtenerMetricasOperativas(ctx: AppContext): Promise<MetricasOperativas> {
  const [todasSolicitudes, todosFletes] = await Promise.all([
    Promise.all(ESTADOS_SOLICITUD.map((e) => ctx.repos.solicitudes.porEstado(e))).then((r) =>
      r.flat(),
    ),
    Promise.all(ESTADOS_FLETE.map((e) => ctx.repos.fletes.porEstado(e))).then((r) => r.flat()),
  ]);

  const fletesPorId = new Map(todosFletes.map((f) => [f.id, f]));

  const tiemposAsignacionH = todasSolicitudes
    .filter((s) => s.fleteId)
    .map((s) => {
      const flete = fletesPorId.get(s.fleteId as string);
      const asignadoTs =
        flete?.timeline.find((t) => t.estado === 'ASIGNADO')?.ts ?? flete?.createdAt;
      if (!asignadoTs) return null;
      return (new Date(asignadoTs).getTime() - new Date(s.createdAt).getTime()) / 3_600_000;
    })
    .filter((h): h is number => h !== null);

  const tiempoMedioAsignacionH = tiemposAsignacionH.length
    ? round2(tiemposAsignacionH.reduce((a, b) => a + b, 0) / tiemposAsignacionH.length)
    : 0;

  const pctEsperaMayor6h = tiemposAsignacionH.length
    ? round2((tiemposAsignacionH.filter((h) => h > 6).length / tiemposAsignacionH.length) * 100)
    : 0;

  const fletesPorEstado = Object.fromEntries(
    ESTADOS_FLETE.map((e) => [e, todosFletes.filter((f) => f.estado === e).length]),
  ) as Record<EstadoFlete, number>;

  const tarifaMedia = todosFletes.length
    ? round2(todosFletes.reduce((a, f) => a + f.tarifa, 0) / todosFletes.length)
    : 0;

  return {
    tiempoMedioAsignacionH,
    pctEsperaMayor6h,
    fletesPorEstado,
    tarifaMedia,
    solicitudesPendientes: todasSolicitudes.filter((s) => s.estado === 'PENDIENTE').length,
    retrasosDetectados: todasSolicitudes.filter((s) => s.retrasoNotificado).length,
  };
}
