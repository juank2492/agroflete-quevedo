import type { EstadoFlete, EstadoSolicitud, EstadoVehiculo } from '@agroflete/shared';

export type EstadoCualquiera = EstadoSolicitud | EstadoFlete | EstadoVehiculo;

/** Etiquetas visibles para los estados del dominio. */
export const ESTADO_LABEL: Record<EstadoCualquiera, string> = {
  PENDIENTE: 'Pendiente',
  ASIGNADA: 'Asignada',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  ASIGNADO: 'Asignado',
  EN_CAMINO_ORIGEN: 'En camino al origen',
  CARGANDO: 'Cargando',
  EN_RUTA: 'En ruta',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  INCIDENCIA: 'Incidencia',
  DISPONIBLE: 'Disponible',
  OCUPADO: 'Ocupado',
  INACTIVO: 'Inactivo',
};

export function estadoLabel(estado: string): string {
  return ESTADO_LABEL[estado as EstadoCualquiera] ?? estado;
}
