import {
  ESTADOS_FLETE,
  ESTADOS_SOLICITUD,
  type ConteoCultivo,
  type EstadoFlete,
  type EstadoSolicitud,
  type MetricasOperativas,
  type PuntoSerieDia,
} from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const DIAS_SERIE = 14;

/** Serie de conteos por día para los últimos `DIAS_SERIE` días (incluye hoy). */
function serieUltimosDias(fechasIso: string[], hoyIso: string): PuntoSerieDia[] {
  const conteo = new Map<string, number>();
  for (const iso of fechasIso) {
    const dia = iso.slice(0, 10);
    conteo.set(dia, (conteo.get(dia) ?? 0) + 1);
  }
  const hoy = new Date(hoyIso.slice(0, 10) + 'T00:00:00.000Z');
  return Array.from({ length: DIAS_SERIE }, (_, i) => {
    const d = new Date(hoy);
    d.setUTCDate(d.getUTCDate() - (DIAS_SERIE - 1 - i));
    const fecha = d.toISOString().slice(0, 10);
    return { fecha, cantidad: conteo.get(fecha) ?? 0 };
  });
}

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

  const solicitudesPorEstado = Object.fromEntries(
    ESTADOS_SOLICITUD.map((e) => [e, todasSolicitudes.filter((s) => s.estado === e).length]),
  ) as Record<EstadoSolicitud, number>;

  const conteoCultivo = new Map<string, number>();
  for (const s of todasSolicitudes) {
    const clave = s.cultivoNombre || s.cultivo;
    conteoCultivo.set(clave, (conteoCultivo.get(clave) ?? 0) + 1);
  }
  const solicitudesPorCultivo: ConteoCultivo[] = [...conteoCultivo.entries()]
    .map(([cultivo, cantidad]) => ({ cultivo, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const ahoraIso = ctx.clock.nowIso();
  const solicitudesPorDia = serieUltimosDias(
    todasSolicitudes.map((s) => s.createdAt),
    ahoraIso,
  );
  const entregasPorDia = serieUltimosDias(
    todosFletes
      .filter((f) => f.estado === 'ENTREGADO')
      .map((f) => f.timeline.find((t) => t.estado === 'ENTREGADO')?.ts ?? f.createdAt),
    ahoraIso,
  );

  const tarifaMedia = todosFletes.length
    ? round2(todosFletes.reduce((a, f) => a + f.tarifa, 0) / todosFletes.length)
    : 0;

  return {
    tiempoMedioAsignacionH,
    pctEsperaMayor6h,
    fletesPorEstado,
    solicitudesPorEstado,
    solicitudesPorCultivo,
    solicitudesPorDia,
    entregasPorDia,
    tarifaMedia,
    solicitudesPendientes: todasSolicitudes.filter((s) => s.estado === 'PENDIENTE').length,
    retrasosDetectados: todasSolicitudes.filter((s) => s.retrasoNotificado).length,
  };
}
