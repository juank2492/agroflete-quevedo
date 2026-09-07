import type {
  Acopio,
  AjustesOperacion,
  EstadoFlete,
  EstadoSolicitud,
  EstadoUsuario,
  EstadoVehiculo,
  Flete,
  ReglasTarifa,
  Rol,
  Solicitud,
  TipoEvento,
  UbicacionFlete,
  Vehiculo,
  Zona,
} from '@agroflete/shared';

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
  crear(usuario: UsuarioRecord): Promise<void>;
  porId(id: string): Promise<UsuarioRecord | null>;
  porEmail(email: string): Promise<UsuarioRecord | null>;
  /** Lista usuarios por rol. */
  listarPorRol(rol: Rol): Promise<UsuarioRecord[]>;
  /** Actualiza campos; `undefined` elimina el atributo. */
  actualizar(id: string, patch: Partial<UsuarioRecord>): Promise<void>;
}

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

export interface AcopioRepository {
  listar(): Promise<Acopio[]>;
  porId(id: string): Promise<Acopio | null>;
  guardar(acopio: Acopio): Promise<void>;
}

export interface StockRecord {
  acopioId: string;
  cultivo: string;
  cantidadActual: number;
  umbralMinimo: number;
  umbralMaximo: number;
}

export interface InventarioRepository {
  porAcopio(acopioId: string): Promise<StockRecord[]>;
  obtener(acopioId: string, cultivo: string): Promise<StockRecord | null>;
  guardar(rec: StockRecord): Promise<void>;
}

export interface ReglasTarifaRepository {
  /** Devuelve las reglas vigentes o las predeterminadas. */
  obtener(): Promise<ReglasTarifa>;
  guardar(reglas: ReglasTarifa): Promise<void>;
}

export interface AjustesRepository {
  /** Devuelve los ajustes vigentes o los predeterminados. */
  obtener(): Promise<AjustesOperacion>;
  guardar(ajustes: AjustesOperacion): Promise<void>;
}

export interface SolicitudRepository {
  crear(solicitud: Solicitud): Promise<void>;
  porId(id: string): Promise<Solicitud | null>;
  porProductor(productorId: string): Promise<Solicitud[]>;
  porEstado(estado: EstadoSolicitud): Promise<Solicitud[]>;
  /** Cambia el estado y puede exigir el estado actual. */
  actualizar(
    id: string,
    patch: Partial<
      Pick<
        Solicitud,
        | 'estado'
        | 'fleteId'
        | 'retrasoNotificado'
        | 'reasignacionPorIncidencia'
        | 'motivoIncidencia'
      >
    >,
    opts?: { estadoActual?: EstadoSolicitud },
  ): Promise<void>;
  /** Solicitudes PENDIENTE creadas antes de `fechaIso` (para detectar retrasos). */
  pendientesAntesDe(fechaIso: string): Promise<Solicitud[]>;
}

export interface VehiculoRepository {
  crear(vehiculo: Vehiculo): Promise<void>;
  porId(id: string): Promise<Vehiculo | null>;
  porTransportista(transportistaId: string): Promise<Vehiculo[]>;
  /** Lista toda la flota. */
  listarTodos(): Promise<Vehiculo[]>;
  /** Lista vehículos disponibles por zona. */
  disponiblesEnZona(zona: Zona): Promise<Vehiculo[]>;
  actualizar(
    id: string,
    patch: Partial<Pick<Vehiculo, 'estado' | 'tipo' | 'capacidadTon' | 'zona'>>,
    opts?: { estadoActual?: EstadoVehiculo },
  ): Promise<void>;
}

export interface FleteRepository {
  crear(flete: Flete): Promise<void>;
  porId(id: string): Promise<Flete | null>;
  porTransportista(transportistaId: string): Promise<Flete[]>;
  porProductor(productorId: string): Promise<Flete[]>;
  porEstado(estado: EstadoFlete): Promise<Flete[]>;
  actualizar(
    id: string,
    patch: Partial<
      Pick<Flete, 'estado' | 'timeline' | 'incidencia' | 'ultimaUbicacion' | 'motivoCancelacion'>
    >,
    opts?: { estadoActual?: EstadoFlete },
  ): Promise<void>;
  /** Añade un punto al rastro del flete. */
  agregarTrack(fleteId: string, punto: UbicacionFlete): Promise<void>;
  /** Devuelve el rastro ordenado por tiempo. */
  ruta(fleteId: string): Promise<UbicacionFlete[]>;
}

export interface Repositories {
  usuarios: UsuarioRepository;
  outbox: OutboxRepository;
  acopios: AcopioRepository;
  inventario: InventarioRepository;
  reglas: ReglasTarifaRepository;
  ajustes: AjustesRepository;
  solicitudes: SolicitudRepository;
  vehiculos: VehiculoRepository;
  fletes: FleteRepository;
}
