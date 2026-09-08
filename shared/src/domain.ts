import { z } from 'zod';

export const ROLES = ['productor', 'transportista', 'admin'] as const;
export const rolSchema = z.enum(ROLES);
export type Rol = z.infer<typeof rolSchema>;

/** Solo `productor` puede registrarse desde el portal público. */
export const rolRegistrableSchema = z.enum(['productor']);

/** Clave libre del catálogo de cultivos administrado por el admin. */
export const cultivoSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]{2,32}$/, 'Clave de cultivo inválida');
export type Cultivo = z.infer<typeof cultivoSchema>;

export const ZONAS = [
  'quevedo-centro',
  'quevedo-norte',
  'quevedo-sur',
  'san-carlos',
  'la-esperanza',
  'mocache',
  'buena-fe',
  'valencia',
] as const;
export const zonaSchema = z.enum(ZONAS);
export type Zona = z.infer<typeof zonaSchema>;

export const ESTADOS_USUARIO = ['PENDIENTE_CONF', 'CONFIRMADO', 'INACTIVO'] as const;
export const estadoUsuarioSchema = z.enum(ESTADOS_USUARIO);
export type EstadoUsuario = z.infer<typeof estadoUsuarioSchema>;

export const ESTADOS_SOLICITUD = [
  'PENDIENTE',
  'ASIGNADA',
  'EN_PROCESO',
  'COMPLETADA',
  'CANCELADA',
] as const;
export const estadoSolicitudSchema = z.enum(ESTADOS_SOLICITUD);
export type EstadoSolicitud = z.infer<typeof estadoSolicitudSchema>;

export const ESTADOS_VEHICULO = ['DISPONIBLE', 'OCUPADO', 'INACTIVO'] as const;
export const estadoVehiculoSchema = z.enum(ESTADOS_VEHICULO);
export type EstadoVehiculo = z.infer<typeof estadoVehiculoSchema>;

export const ESTADOS_FLETE = [
  'ASIGNADO',
  'EN_CAMINO_ORIGEN',
  'CARGANDO',
  'EN_RUTA',
  'ENTREGADO',
  'CANCELADO',
  'INCIDENCIA',
] as const;
export const estadoFleteSchema = z.enum(ESTADOS_FLETE);
export type EstadoFlete = z.infer<typeof estadoFleteSchema>;

/** Fuente única de verdad para las transiciones de estado del flete. */
export const TRANSICIONES_FLETE: Record<EstadoFlete, EstadoFlete[]> = {
  ASIGNADO: ['EN_CAMINO_ORIGEN', 'CANCELADO'],
  EN_CAMINO_ORIGEN: ['CARGANDO', 'CANCELADO', 'INCIDENCIA'],
  CARGANDO: ['EN_RUTA', 'CANCELADO', 'INCIDENCIA'],
  EN_RUTA: ['ENTREGADO', 'CANCELADO', 'INCIDENCIA'],
  ENTREGADO: [],
  CANCELADO: [],
  INCIDENCIA: [],
};

export function puedeTransicionarFlete(actual: EstadoFlete, siguiente: EstadoFlete): boolean {
  return TRANSICIONES_FLETE[actual].includes(siguiente);
}

/** Estados desde los que el transportista puede reportar una incidencia en ruta. */
export function puedeReportarIncidencia(actual: EstadoFlete): boolean {
  return TRANSICIONES_FLETE[actual].includes('INCIDENCIA');
}

export const TIPOS_EVENTO = [
  'UsuarioRegistrado',
  'ReglasTarifaActualizadas',
  'SolicitudCreada',
  'FleteAsignado',
  'EstadoFleteCambiado',
  'EntregaConfirmada',
  'RetrasoDetectado',
  'IncidenciaEnRuta',
  'StockBajo',
  'StockAlto',
  'TransportistaCreado',
  'PagoAprobado',
  'PagoRechazado',
  'PagoEnRevision',
] as const;
export const tipoEventoSchema = z.enum(TIPOS_EVENTO);
export type TipoEvento = z.infer<typeof tipoEventoSchema>;
