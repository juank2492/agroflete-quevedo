import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TRANSICIONES_FLETE,
  puedeReportarIncidencia,
  type EstadoFlete,
  type Flete,
  type LatLon,
} from '@agroflete/shared';
import { FleteService } from '../core/flete.service';
import { GeoService } from '../core/geo.service';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { apiMessage } from '../core/http-error';
import { IconComponent } from '../core/icon.component';
import { EstadoBadgeComponent } from '../shared/estado-badge.component';
import { TimelineComponent } from '../shared/timeline.component';
import { MapaFleteComponent } from '../shared/mapa-flete.component';
import { FiltroChipsComponent, type OpcionFiltro } from '../shared/filtro-chips.component';
import { PaginacionComponent, paginar } from '../shared/paginacion.component';

const LABEL_ACCION: Record<EstadoFlete, string> = {
  ASIGNADO: 'Asignado',
  EN_CAMINO_ORIGEN: 'Salir hacia el origen',
  CARGANDO: 'Empezar a cargar',
  EN_RUTA: 'Salir hacia el acopio',
  ENTREGADO: 'Confirmar entrega',
  CANCELADO: 'Cancelar',
  INCIDENCIA: 'Reportar incidencia',
};

const EN_CURSO = new Set(['ASIGNADO', 'EN_CAMINO_ORIGEN', 'CARGANDO', 'EN_RUTA']);
const POR_PAGINA = 6;
type FiltroFlete = 'TODOS' | 'EN_CURSO' | 'ENTREGADO' | 'CANCELADO' | 'INCIDENCIA';

@Component({
  selector: 'app-mis-fletes',
  imports: [
    DecimalPipe,
    FormsModule,
    IconComponent,
    EstadoBadgeComponent,
    TimelineComponent,
    MapaFleteComponent,
    FiltroChipsComponent,
    PaginacionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl">
      <h1 class="text-2xl font-bold">Mis fletes</h1>

      @if (cargando()) {
        <div class="mt-6 space-y-3">
          @for (i of [1, 2]; track i) {
            <div class="h-32 animate-pulse rounded-box bg-base-300"></div>
          }
        </div>
      } @else if (fletes().length === 0) {
        <p class="mt-8 rounded-box bg-base-100 p-6 text-center text-base-content/70 shadow-card">
          Todavía no tienes fletes asignados.
        </p>
      } @else {
        <div class="mt-6">
          <app-filtro-chips
            [opciones]="opcionesFiltro()"
            [valor]="filtro()"
            (valorChange)="cambiarFiltro($event)"
          />
        </div>

        @if (filtradas().length === 0) {
          <p class="mt-6 rounded-box bg-base-100 p-6 text-center text-base-content/70 shadow-card">
            No tienes fletes en este estado.
          </p>
        } @else {
          <ul class="mt-4 space-y-4">
            @for (f of visibles(); track f.id) {
              <li class="rounded-box border border-base-300 bg-base-100 p-4 shadow-card">
                <div class="flex items-center justify-between">
                  <span class="font-display font-semibold">
                    Flete · $ {{ f.tarifa | number: '1.2-2' }}
                    @if (f.auto) {
                      <span class="badge badge-ghost badge-sm ml-1">asignación automática</span>
                    }
                  </span>
                  <app-estado-badge [estado]="f.estado" />
                </div>

                @if (f.origenNombre) {
                  <p class="mt-1 text-sm text-base-content/70">
                    <app-icon name="pin" [size]="14" class="text-base-content/50" />
                    Recoger en: {{ f.origenNombre }}
                  </p>
                }

                @if (f.incidencia; as inc) {
                  <p class="mt-2 rounded-field bg-error/10 px-3 py-2 text-sm text-error">
                    Incidencia: {{ inc.motivo }}
                  </p>
                }

                @if (enCurso(f.estado)) {
                  <div class="mt-3">
                    <app-mapa-flete
                      [origen]="f.origen ?? null"
                      [destino]="f.destino ?? null"
                      [ultima]="f.ultimaUbicacion ?? null"
                      [rutaVial]="rutaVialDe(f)"
                    />
                    <div class="mt-2 flex flex-wrap gap-2">
                      <button
                        class="btn btn-sm rounded-full"
                        [disabled]="enviandoUbic() === f.id"
                        (click)="compartirUna(f)"
                      >
                        <app-icon name="pin" [size]="16" /> Compartir ubicación
                      </button>
                      <button
                        class="btn btn-sm rounded-full"
                        [class.btn-primary]="liveId() === f.id"
                        (click)="toggleLive(f)"
                      >
                        {{ liveId() === f.id ? 'Detener envío en vivo' : 'Enviar en vivo' }}
                      </button>
                    </div>
                  </div>
                }

                <div class="mt-3">
                  <app-timeline [eventos]="f.timeline" />
                </div>

                @if (siguientes(f.estado).length > 0 || puedeIncidencia(f.estado)) {
                  <div class="mt-2 flex flex-wrap gap-2">
                    @for (sig of siguientes(f.estado); track sig) {
                      <button
                        class="btn btn-sm rounded-full"
                        [class.btn-primary]="sig !== 'CANCELADO'"
                        [class.btn-ghost]="sig === 'CANCELADO'"
                        [disabled]="actualizandoId() === f.id"
                        (click)="sig === 'CANCELADO' ? abrirCancelar(f) : avanzar(f, sig)"
                      >
                        {{ accion(sig) }}
                      </button>
                    }
                    @if (puedeIncidencia(f.estado)) {
                      <button
                        class="btn btn-outline btn-error btn-sm rounded-full"
                        [disabled]="actualizandoId() === f.id"
                        (click)="abrirIncidencia(f)"
                      >
                        Reportar incidencia
                      </button>
                    }
                  </div>
                }
              </li>
            }
          </ul>

          <app-paginacion
            [total]="filtradas().length"
            [pagina]="pagina()"
            [porPagina]="porPagina"
            (paginaChange)="pagina.set($event)"
          />
        }
      }
    </div>

    <dialog class="modal" [class.modal-open]="!!cancelarDe()">
      <div class="modal-box">
        <h3 class="text-lg font-bold">Cancelar flete</h3>
        <p class="mt-1 text-sm text-base-content/60">
          La carga volverá a la cola del administrador. Indica por qué cancelas.
        </p>

        <label class="form-control mt-4 w-full">
          <span class="label-text mb-1">Motivo</span>
          <textarea
            class="textarea textarea-bordered w-full"
            rows="3"
            placeholder="No llego a tiempo, se dañó el vehículo, la finca canceló la carga…"
            [(ngModel)]="motivoCancel"
          ></textarea>
        </label>

        <div class="modal-action">
          <button class="btn btn-ghost" (click)="cerrarCancelar()">Volver</button>
          <button
            class="btn btn-error rounded-full"
            [disabled]="motivoCancel().trim().length < 3 || enviandoCancel()"
            (click)="confirmarCancelar()"
          >
            @if (enviandoCancel()) {
              <span class="loading loading-spinner loading-sm"></span>
            }
            Cancelar flete
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" (submit)="cerrarCancelar()">
        <button>close</button>
      </form>
    </dialog>

    <dialog class="modal" [class.modal-open]="!!incidenciaDe()">
      <div class="modal-box">
        <h3 class="text-lg font-bold">Reportar incidencia en ruta</h3>
        <p class="mt-1 text-sm text-base-content/60">
          La carga volverá a la cola del administrador para reasignarla a otro vehículo.
        </p>

        <label class="form-control mt-4 w-full">
          <span class="label-text mb-1">¿Qué pasó?</span>
          <textarea
            class="textarea textarea-bordered w-full"
            rows="3"
            placeholder="Avería del motor, vía cerrada, accidente…"
            [(ngModel)]="motivo"
          ></textarea>
        </label>

        <label class="mt-3 flex cursor-pointer items-center gap-3">
          <input type="checkbox" class="checkbox checkbox-sm" [(ngModel)]="fueraDeServicio" />
          <span class="text-sm">El vehículo queda fuera de servicio (INACTIVO)</span>
        </label>

        <div class="modal-action">
          <button class="btn btn-ghost" (click)="cerrarIncidencia()">Cancelar</button>
          <button
            class="btn btn-error rounded-full"
            [disabled]="motivo().trim().length < 3 || enviandoInc()"
            (click)="confirmarIncidencia()"
          >
            @if (enviandoInc()) {
              <span class="loading loading-spinner loading-sm"></span>
            }
            Reportar
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" (submit)="cerrarIncidencia()">
        <button>close</button>
      </form>
    </dialog>
  `,
})
export class MisFletesComponent implements OnInit, OnDestroy {
  private readonly service = inject(FleteService);
  private readonly geo = inject(GeoService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly cargando = signal(true);
  protected readonly fletes = signal<Flete[]>([]);
  protected readonly actualizandoId = signal<string | null>(null);
  /** Rutas obtenidas para fletes antiguos sin ruta guardada. */
  private readonly rutasVial = signal<Record<string, LatLon[]>>({});

  protected readonly filtro = signal<FiltroFlete>('TODOS');
  protected readonly pagina = signal(1);
  protected readonly porPagina = POR_PAGINA;

  protected readonly opcionesFiltro = computed<OpcionFiltro[]>(() => {
    const enCurso = this.fletes().some((f) => EN_CURSO.has(f.estado));
    const tiene = (e: EstadoFlete) => this.fletes().some((f) => f.estado === e);
    return [
      { valor: 'TODOS', etiqueta: 'Todos' },
      ...(enCurso ? [{ valor: 'EN_CURSO', etiqueta: 'En curso' }] : []),
      ...(tiene('ENTREGADO') ? [{ valor: 'ENTREGADO', etiqueta: 'Entregados' }] : []),
      ...(tiene('CANCELADO') ? [{ valor: 'CANCELADO', etiqueta: 'Cancelados' }] : []),
      ...(tiene('INCIDENCIA') ? [{ valor: 'INCIDENCIA', etiqueta: 'Incidencia' }] : []),
    ];
  });

  protected readonly filtradas = computed(() => {
    const f = this.filtro();
    const list = this.fletes();
    if (f === 'TODOS') return list;
    if (f === 'EN_CURSO') return list.filter((x) => EN_CURSO.has(x.estado));
    return list.filter((x) => x.estado === f);
  });

  protected readonly visibles = computed(() =>
    paginar(this.filtradas(), this.pagina(), this.porPagina),
  );

  protected readonly cancelarDe = signal<Flete | null>(null);
  protected readonly motivoCancel = signal('');
  protected readonly enviandoCancel = signal(false);

  protected readonly incidenciaDe = signal<Flete | null>(null);
  protected readonly motivo = signal('');
  protected readonly fueraDeServicio = signal(false);
  protected readonly enviandoInc = signal(false);

  protected readonly enviandoUbic = signal<string | null>(null);
  protected readonly liveId = signal<string | null>(null);
  private watchId: number | null = null;
  private ultimoEnvio = 0;

  ngOnInit(): void {
    this.recargar();
  }

  ngOnDestroy(): void {
    this.detenerWatch();
  }

  protected enCurso(estado: EstadoFlete): boolean {
    return EN_CURSO.has(estado);
  }

  /** Estados de avance normal. */
  protected siguientes(estado: EstadoFlete): EstadoFlete[] {
    return TRANSICIONES_FLETE[estado].filter((e) => e !== 'INCIDENCIA');
  }

  protected puedeIncidencia(estado: EstadoFlete): boolean {
    return puedeReportarIncidencia(estado);
  }

  protected accion(estado: EstadoFlete): string {
    return LABEL_ACCION[estado];
  }

  protected rutaVialDe(f: Flete): LatLon[] {
    return f.rutaVial?.length ? f.rutaVial : (this.rutasVial()[f.id] ?? []);
  }

  private recargar(): void {
    this.cargando.set(true);
    this.service.listar().subscribe({
      next: (list) => {
        this.fletes.set(list);
        this.cargando.set(false);
        for (const f of list) this.asegurarRuta(f);
      },
      error: () => this.cargando.set(false),
    });
  }

  /** Obtiene la ruta si el flete no la tiene guardada. */
  private asegurarRuta(f: Flete): void {
    if (!EN_CURSO.has(f.estado) || f.rutaVial?.length || this.rutasVial()[f.id]) return;
    if (!f.origen || !f.destino) return;
    this.geo.ruta(f.origen, f.destino).subscribe({
      next: (r) => this.rutasVial.update((m) => ({ ...m, [f.id]: r.geometria })),
    });
  }

  private enviar(fleteId: string, pos: GeolocationPosition): void {
    const velRaw = pos.coords.speed;
    const body = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      ...(velRaw != null && velRaw >= 0 ? { velocidad: Math.round(velRaw * 3.6) } : {}),
    };
    this.service.registrarUbicacion(fleteId, body).subscribe({
      next: (res) => {
        this.enviandoUbic.set(null);
        if (res.entregaDetectada) {
          this.detenerWatch();
          this.feedback.success('Llegada al acopio detectada · entrega confirmada');
        }
        this.recargar();
      },
      error: (err) => {
        this.enviandoUbic.set(null);
        this.feedback.error(apiMessage(err, 'No se pudo enviar la ubicación'));
      },
    });
  }

  compartirUna(f: Flete): void {
    if (!('geolocation' in navigator)) {
      this.feedback.error('Este dispositivo no comparte ubicación');
      return;
    }
    this.enviandoUbic.set(f.id);
    navigator.geolocation.getCurrentPosition(
      (pos) => this.enviar(f.id, pos),
      () => {
        this.enviandoUbic.set(null);
        this.feedback.error('No se pudo obtener tu ubicación');
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  toggleLive(f: Flete): void {
    if (this.liveId() === f.id) {
      this.detenerWatch();
      return;
    }
    this.detenerWatch();
    if (!('geolocation' in navigator)) {
      this.feedback.error('Este dispositivo no comparte ubicación');
      return;
    }
    this.ultimoEnvio = 0;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const ahora = Date.now();
        if (ahora - this.ultimoEnvio < 15_000) return; // limita a 1 envío / 15 s
        this.ultimoEnvio = ahora;
        this.enviar(f.id, pos);
      },
      () => this.feedback.error('Se perdió la señal de ubicación'),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    this.liveId.set(f.id);
    this.feedback.success('Enviando ubicación en vivo');
  }

  private detenerWatch(): void {
    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.liveId.set(null);
  }

  avanzar(f: Flete, nuevoEstado: EstadoFlete): void {
    this.actualizandoId.set(f.id);
    this.service.cambiarEstado(f.id, { nuevoEstado }).subscribe({
      next: () => {
        this.actualizandoId.set(null);
        this.feedback.success('Estado actualizado');
        if (!EN_CURSO.has(nuevoEstado)) this.detenerWatch();
        this.recargar();
      },
      error: (err) => {
        this.actualizandoId.set(null);
        this.feedback.error(apiMessage(err, 'No se pudo actualizar el estado'));
      },
    });
  }

  protected cambiarFiltro(v: string): void {
    this.filtro.set(v as FiltroFlete);
    this.pagina.set(1);
  }

  abrirCancelar(f: Flete): void {
    this.motivoCancel.set('');
    this.cancelarDe.set(f);
  }

  cerrarCancelar(): void {
    this.cancelarDe.set(null);
  }

  confirmarCancelar(): void {
    const f = this.cancelarDe();
    const motivo = this.motivoCancel().trim();
    if (!f || motivo.length < 3) return;
    this.enviandoCancel.set(true);
    this.service.cambiarEstado(f.id, { nuevoEstado: 'CANCELADO', motivo }).subscribe({
      next: () => {
        this.enviandoCancel.set(false);
        this.cerrarCancelar();
        this.detenerWatch();
        this.feedback.success('Flete cancelado. La carga volvió a la cola.');
        this.recargar();
      },
      error: (err) => {
        this.enviandoCancel.set(false);
        this.feedback.error(apiMessage(err, 'No se pudo cancelar el flete'));
      },
    });
  }

  abrirIncidencia(f: Flete): void {
    this.motivo.set('');
    this.fueraDeServicio.set(false);
    this.incidenciaDe.set(f);
  }

  cerrarIncidencia(): void {
    this.incidenciaDe.set(null);
  }

  confirmarIncidencia(): void {
    const f = this.incidenciaDe();
    if (!f || this.motivo().trim().length < 3) return;
    this.enviandoInc.set(true);
    this.service
      .reportarIncidencia(f.id, {
        motivo: this.motivo().trim(),
        vehiculoFueraDeServicio: this.fueraDeServicio(),
      })
      .subscribe({
        next: () => {
          this.enviandoInc.set(false);
          this.cerrarIncidencia();
          this.detenerWatch();
          this.feedback.success('Incidencia reportada. La carga volvió a la cola.');
          this.recargar();
        },
        error: (err) => {
          this.enviandoInc.set(false);
          this.feedback.error(apiMessage(err, 'No se pudo reportar la incidencia'));
        },
      });
  }
}
