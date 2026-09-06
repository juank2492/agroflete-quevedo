import type {
  Acopio,
  EstadoFlete,
  EstadoSolicitud,
  EstadoUsuario,
  EstadoVehiculo,
  Flete,
  ReglasTarifa,
  Rol,
  Solicitud,
  TipoEvento,
  Vehiculo,
  Zona,
} from '@agroflete/shared';

// -------------------- Usuarios --------------------

export interface UsuarioRecord {
  id: string;
  email: string; // en minúsculas
  nombreCompleto: string;
  telefono: string;
  rol: Rol;
  passwordHash: string;
  estado: EstadoUsuario;
  codigoConf?: string;
  codigoExpiraTs?: number;
  createdAt: string;
}

export interface UsuarioRepository {
  /** Inserta; lanza ConflictError si el id ya existe. */
  crear(usuario: UsuarioRecord): Promise<void>;
  porId(id: string): Promise<UsuarioRecord | null>;
  porEmail(email: string): Promise<UsuarioRecord | null>;
  /** Actualiza campos; `undefined` en un campo lo elimina del ítem. */
  actualizar(id: string, patch: Partial<UsuarioRecord>): Promise<void>;
}

// -------------------- Outbox de eventos --------------------

export interface OutboxRecord {
  id: string;
  tipo: TipoEvento;
  payload: unknown;
  createdAt: string;
  estado: 'PENDIENTE' | 'PROCESADO';
  intentos: number;
  /** Nombres de suscriptores que ya procesaron el evento (idempotencia). */
  procesadoPor: string[];
}

export interface OutboxRepository {
  agregar(rec: Pick<OutboxRecord, 'id' | 'tipo' | 'payload' | 'createdAt'>): Promise<void>;
  pendientes(limite: number): Promise<OutboxRecord[]>;
  marcarSuscriptor(id: string, suscriptor: string): Promise<void>;
  marcarProcesado(id: string): Promise<void>;
  registrarIntento(id: string): Promise<void>;
}

// -------------------- Catálogo: centros de acopio --------------------

export interface AcopioRepository {
  listar(): Promise<Acopio[]>;
  porId(id: string): Promise<Acopio | null>;
  guardar(acopio: Acopio): Promise<void>;
}

// -------------------- Reglas de tarifa --------------------

export interface ReglasTarifaRepository {
  /** Devuelve las reglas vigentes; si no hay, las reglas por defecto. */
  obtener(): Promise<ReglasTarifa>;
  guardar(reglas: ReglasTarifa): Promise<void>;
}

// -------------------- Solicitudes de flete --------------------

export interface SolicitudRepository {
  crear(solicitud: Solicitud): Promise<void>;
  porId(id: string): Promise<Solicitud | null>;
  porProductor(productorId: string): Promise<Solicitud[]>;
  porEstado(estado: EstadoSolicitud): Promise<Solicitud[]>;
  /**
   * Cambia estado (y opcionalmente `fleteId`); mantiene el índice por estado.
   * `opts.estadoActual` añade una guarda optimista: si el estado ya cambió,
   * lanza ConflictError.
   */
  actualizar(
    id: string,
    patch: Partial<Pick<Solicitud, 'estado' | 'fleteId' | 'retrasoNotificado'>>,
    opts?: { estadoActual?: EstadoSolicitud },
  ): Promise<void>;
  /** Solicitudes PENDIENTE creadas antes de `fechaIso` (para detectar retrasos). */
  pendientesAntesDe(fechaIso: string): Promise<Solicitud[]>;
}

// -------------------- Vehículos --------------------

export interface VehiculoRepository {
  crear(vehiculo: Vehiculo): Promise<void>;
  porId(id: string): Promise<Vehiculo | null>;
  porTransportista(transportistaId: string): Promise<Vehiculo[]>;
  /** Vehículos con estado DISPONIBLE en una zona (índice gsi2). */
  disponiblesEnZona(zona: Zona): Promise<Vehiculo[]>;
  actualizar(
    id: string,
    patch: Partial<Pick<Vehiculo, 'estado' | 'tipo' | 'capacidadTon' | 'zona'>>,
    opts?: { estadoActual?: EstadoVehiculo },
  ): Promise<void>;
}

// -------------------- Fletes --------------------

export interface FleteRepository {
  crear(flete: Flete): Promise<void>;
  porId(id: string): Promise<Flete | null>;
  porTransportista(transportistaId: string): Promise<Flete[]>;
  porProductor(productorId: string): Promise<Flete[]>;
  porEstado(estado: EstadoFlete): Promise<Flete[]>;
  actualizar(
    id: string,
    patch: Partial<Pick<Flete, 'estado' | 'timeline'>>,
    opts?: { estadoActual?: EstadoFlete },
  ): Promise<void>;
}

// -------------------- Contenedor de repositorios --------------------

export interface Repositories {
  usuarios: UsuarioRepository;
  outbox: OutboxRepository;
  acopios: AcopioRepository;
  reglas: ReglasTarifaRepository;
  solicitudes: SolicitudRepository;
  vehiculos: VehiculoRepository;
  fletes: FleteRepository;
}
