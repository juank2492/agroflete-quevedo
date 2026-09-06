import { z } from 'zod';

export const ROLES = ['productor', 'transportista', 'admin'] as const;
export const rolSchema = z.enum(ROLES);
export type Rol = z.infer<typeof rolSchema>;

/** Roles que se pueden auto-registrar desde el portal. `admin` se crea por seed. */
export const rolRegistrableSchema = z.enum(['productor', 'transportista']);

export const CULTIVOS = ['maiz', 'banano'] as const;
export const cultivoSchema = z.enum(CULTIVOS);
export type Cultivo = z.infer<typeof cultivoSchema>;

/** Zonas logísticas del cantón Quevedo y alrededores usadas para emparejar oferta/demanda. */
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

export const ESTADOS_USUARIO = ['PENDIENTE_CONF', 'CONFIRMADO'] as const;
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
] as const;
export const estadoFleteSchema = z.enum(ESTADOS_FLETE);
export type EstadoFlete = z.infer<typeof estadoFleteSchema>;

/**
 * Máquina de estados del flete. Fuente única de verdad, compartida por backend
 * (validación) y frontend (mostrar la siguiente acción válida).
 */
export const TRANSICIONES_FLETE: Record<EstadoFlete, EstadoFlete[]> = {
  ASIGNADO: ['EN_CAMINO_ORIGEN', 'CANCELADO'],
  EN_CAMINO_ORIGEN: ['CARGANDO', 'CANCELADO'],
  CARGANDO: ['EN_RUTA', 'CANCELADO'],
  EN_RUTA: ['ENTREGADO', 'CANCELADO'],
  ENTREGADO: [],
  CANCELADO: [],
};

export function puedeTransicionarFlete(actual: EstadoFlete, siguiente: EstadoFlete): boolean {
  return TRANSICIONES_FLETE[actual].includes(siguiente);
}

export const TIPOS_EVENTO = [
  'UsuarioRegistrado',
  'ReglasTarifaActualizadas',
  'SolicitudCreada',
  'FleteAsignado',
  'EstadoFleteCambiado',
  'EntregaConfirmada',
  'RetrasoDetectado',
] as const;
export const tipoEventoSchema = z.enum(TIPOS_EVENTO);
export type TipoEvento = z.infer<typeof tipoEventoSchema>;
