import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ESTADOS_FLETE,
  type EstadoFlete,
  type Flete,
  type PerfilPublico,
  type Vehiculo,
} from '@agroflete/shared';
import { FleteService } from '../core/flete.service';
import { FlotaService } from '../core/flota.service';
import { VehiculoService } from '../core/vehiculo.service';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { apiMessage } from '../core/http-error';
import { EstadoBadgeComponent } from '../shared/estado-badge.component';
import { TimelineComponent } from '../shared/timeline.component';
import { FiltroChipsComponent, type OpcionFiltro } from '../shared/filtro-chips.component';
import { PaginacionComponent, paginar } from '../shared/paginacion.component';
import { estadoLabel } from '../shared/estado-labels';

type Filtro = EstadoFlete | 'TODOS';

const POR_PAGINA = 10;
const REASIGNABLE = new Set<EstadoFlete>(['ASIGNADO', 'EN_CAMINO_ORIGEN', 'CARGANDO', 'EN_RUTA']);

@Component({
  selector: 'app-fletes-admin',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    EstadoBadgeComponent,
    TimelineComponent,
    FiltroChipsComponent,
    PaginacionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-4xl">
      <h1 class="text-2xl font-bold">Fletes</h1>

      <div class="mt-4">
        <app-filtro-chips
          [opciones]="opcionesFiltro"
          [valor]="filtro()"
          (valorChange)="filtrar($event)"
        />
      </div>

      @if (cargando()) {
        <div class="mt-6 h-40 animate-pulse rounded-box bg-base-300"></div>
      } @else if (fletes().length === 0) {
        <p class="mt-8 rounded-box bg-base-100 p-6 text-center text-base-content/70 shadow-card">
          No hay fletes en este estado.
        </p>
      } @else {
        <div
          class="mt-6 overflow-x-auto rounded-box border border-base-300 bg-base-100 shadow-card"
        >
          <table class="table">
            <thead>
              <tr>
                <th>Carga</th>
                <th>Transportista</th>
                <th>Estado</th>
                <th class="text-right">Tarifa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (f of visibles(); track f.id) {
                <tr>
                  <td>
                    <div class="font-medium">
                      {{ f.cultivoNombre ?? 'Flete' }}
                      @if (f.pesoTon) {
                        · {{ f.pesoTon }} t
                      }
                    </div>
                    <div class="text-xs text-base-content/60">
                      @if (f.acopioNombre) {
                        → {{ f.acopioNombre }} ·
                      }
                      {{ f.createdAt | date: 'short' }}
                    </div>
                  </td>
                  <td class="text-sm">
                    <div>{{ f.transportistaNombre ?? '—' }}</div>
                    <div class="text-xs text-base-content/60">
                      @if (f.vehiculoPlaca) {
                        <span class="font-mono">{{ f.vehiculoPlaca }}</span>
                      }
                      @if (f.auto) {
                        · asignación automática
                      }
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      class="cursor-pointer align-middle transition hover:opacity-80"
                      title="Ver detalle del flete"
                      (click)="abrirDetalle(f)"
                    >
                      <app-estado-badge [estado]="f.estado" />
                    </button>
                  </td>
                  <td class="text-right font-semibold text-primary">
                    $ {{ f.tarifa | number: '1.2-2' }}
                  </td>
                  <td class="text-right">
                    @if (puedeReasignar(f.estado)) {
                      <button class="btn btn-ghost btn-xs" (click)="abrirReasignar(f)">
                        Reasignar
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <app-paginacion
          [total]="fletes().length"
          [pagina]="pagina()"
          [porPagina]="porPagina"
          (paginaChange)="pagina.set($event)"
        />
      }
    </div>

    <dialog class="modal" [class.modal-open]="!!detalleDe()">
      @if (detalleDe(); as f) {
        <div class="modal-box max-w-lg">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold">
              {{ f.cultivoNombre ?? 'Flete' }}
              @if (f.pesoTon) {
                · {{ f.pesoTon }} t
              }
            </h3>
            <app-estado-badge [estado]="f.estado" />
          </div>
          <p class="mt-1 text-sm text-base-content/60">
            @if (f.acopioNombre) {
              → {{ f.acopioNombre }} ·
            }
            {{ f.createdAt | date: 'medium' }}
            @if (f.auto) {
              · asignación automática
            }
          </p>

          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <div class="rounded-field border border-base-300 p-3">
              <div class="text-xs font-semibold uppercase text-base-content/50">Transportista</div>
              <div class="mt-1 font-medium">
                {{ transportistaDe(f)?.nombreCompleto ?? f.transportistaNombre ?? '—' }}
              </div>
              @if (transportistaDe(f); as t) {
                <div class="text-sm text-base-content/70">{{ t.telefono }}</div>
                <div class="text-sm text-base-content/70">{{ t.email }}</div>
                @if (t.estado === 'INACTIVO') {
                  <span class="badge badge-ghost badge-sm mt-1">dado de baja</span>
                }
              }
            </div>
            <div class="rounded-field border border-base-300 p-3">
              <div class="text-xs font-semibold uppercase text-base-content/50">Vehículo</div>
              <div class="mt-1 font-mono font-medium">
                {{ vehiculoDe(f)?.placa ?? f.vehiculoPlaca ?? '—' }}
              </div>
              @if (vehiculoDe(f); as v) {
                <div class="text-sm text-base-content/70">
                  {{ v.tipo }} · {{ v.capacidadTon }} t · {{ v.zona }}
                </div>
                <div class="text-sm text-base-content/70">{{ estadoTexto(v.estado) }}</div>
              }
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between text-sm">
            <span class="text-base-content/60">Tarifa (pagada por el productor)</span>
            <span class="font-semibold text-primary">$ {{ f.tarifa | number: '1.2-2' }}</span>
          </div>
          @if (f.distanciaVialKm) {
            <div class="text-xs text-base-content/50">
              Ruta por carretera: {{ f.distanciaVialKm | number: '1.1-1' }} km (solo referencia).
            </div>
          }

          @if (f.motivoCancelacion) {
            <p class="mt-3 rounded-field bg-base-200 px-3 py-2 text-sm">
              <span class="font-semibold">Cancelación:</span> {{ f.motivoCancelacion }}
            </p>
          }
          @if (f.incidencia; as inc) {
            <p class="mt-3 rounded-field bg-error/10 px-3 py-2 text-sm text-error">
              <span class="font-semibold">Incidencia:</span> {{ inc.motivo }}
              @if (inc.vehiculoFueraDeServicio) {
                · vehículo fuera de servicio
              }
            </p>
          }

          <div class="mt-4">
            <div class="text-xs font-semibold uppercase text-base-content/50">Historial</div>
            <div class="mt-2">
              <app-timeline [eventos]="f.timeline" />
            </div>
          </div>

          <div class="modal-action">
            @if (puedeReasignar(f.estado)) {
              <button
                class="btn btn-outline btn-sm rounded-full"
                (click)="cerrarDetalle(); abrirReasignar(f)"
              >
                Reasignar
              </button>
            }
            <button class="btn btn-sm rounded-full" (click)="cerrarDetalle()">Cerrar</button>
          </div>
        </div>
      }
      <form method="dialog" class="modal-backdrop" (submit)="cerrarDetalle()">
        <button>close</button>
      </form>
    </dialog>

    <dialog class="modal" [class.modal-open]="!!reasignarDe()">
      <div class="modal-box">
        <h3 class="text-lg font-bold">Reasignar flete</h3>
        @if (reasignarDe(); as f) {
          <p class="mt-1 text-sm text-base-content/60">
            {{ f.cultivoNombre }} · {{ f.pesoTon }} t — actualmente: {{ f.transportistaNombre }} ({{
              f.vehiculoPlaca
            }}). El flete actual se cancela y la carga se asigna al vehículo elegido.
          </p>

          @if (cargandoCand()) {
            <div class="mt-4 h-20 animate-pulse rounded-field bg-base-200"></div>
          } @else if (candidatos().length === 0) {
            <p class="mt-4 text-sm text-warning">
              No hay otro vehículo disponible compatible (misma zona, capacidad suficiente).
            </p>
          } @else {
            <ul class="mt-4 space-y-2">
              @for (v of candidatos(); track v.id) {
                <li>
                  <label
                    class="flex cursor-pointer items-center gap-3 rounded-field border border-base-300 p-3"
                  >
                    <input
                      type="radio"
                      name="veh"
                      class="radio radio-sm"
                      [value]="v.id"
                      [(ngModel)]="vehiculoSel"
                    />
                    <span class="flex-1">
                      <span class="font-mono font-semibold">{{ v.placa }}</span>
                      <span class="text-sm text-base-content/60">
                        · {{ v.tipo }} · {{ v.capacidadTon }} t · {{ v.zona }}
                      </span>
                    </span>
                  </label>
                </li>
              }
            </ul>
          }
        }

        <div class="modal-action">
          <button class="btn btn-ghost" (click)="cerrarReasignar()">Cancelar</button>
          <button
            class="btn btn-primary rounded-full"
            [disabled]="!vehiculoSel || reasignando()"
            (click)="confirmarReasignar()"
          >
            @if (reasignando()) {
              <span class="loading loading-spinner loading-sm"></span>
            }
            Reasignar
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" (submit)="cerrarReasignar()">
        <button>close</button>
      </form>
    </dialog>
  `,
})
export class FletesAdminComponent implements OnInit {
  private readonly service = inject(FleteService);
  private readonly flota = inject(FlotaService);
  private readonly vehiculos = inject(VehiculoService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly estadoTexto = estadoLabel;
  protected readonly porPagina = POR_PAGINA;
  protected readonly cargando = signal(true);
  protected readonly fletes = signal<Flete[]>([]);
  protected readonly filtro = signal<Filtro>('TODOS');
  protected readonly pagina = signal(1);

  protected readonly opcionesFiltro: OpcionFiltro[] = [
    { valor: 'TODOS', etiqueta: 'Todos' },
    ...ESTADOS_FLETE.map((e) => ({ valor: e, etiqueta: estadoLabel(e) })),
  ];

  protected readonly visibles = computed(() =>
    paginar(this.fletes(), this.pagina(), this.porPagina),
  );

  private readonly transportistaPorId = signal<Map<string, PerfilPublico>>(new Map());
  private readonly vehiculoPorId = signal<Map<string, Vehiculo>>(new Map());

  protected readonly detalleDe = signal<Flete | null>(null);

  protected readonly reasignarDe = signal<Flete | null>(null);
  protected readonly candidatos = signal<Vehiculo[]>([]);
  protected readonly cargandoCand = signal(false);
  protected readonly reasignando = signal(false);
  protected vehiculoSel = '';

  ngOnInit(): void {
    this.cargar();
    this.flota
      .listarTransportistas()
      .subscribe({ next: (l) => this.transportistaPorId.set(new Map(l.map((t) => [t.id, t]))) });
    this.flota
      .listarVehiculos()
      .subscribe({ next: (l) => this.vehiculoPorId.set(new Map(l.map((v) => [v.id, v]))) });
  }

  filtrar(f: string): void {
    this.filtro.set(f as Filtro);
    this.pagina.set(1);
    this.cargar();
  }

  protected puedeReasignar(estado: EstadoFlete): boolean {
    return REASIGNABLE.has(estado);
  }

  protected transportistaDe(f: Flete): PerfilPublico | undefined {
    return this.transportistaPorId().get(f.transportistaId);
  }
  protected vehiculoDe(f: Flete): Vehiculo | undefined {
    return this.vehiculoPorId().get(f.vehiculoId);
  }

  protected abrirDetalle(f: Flete): void {
    this.detalleDe.set(f);
  }
  protected cerrarDetalle(): void {
    this.detalleDe.set(null);
  }

  private cargar(): void {
    this.cargando.set(true);
    const f = this.filtro();
    this.service.listar(f === 'TODOS' ? undefined : f).subscribe({
      next: (list) => {
        this.fletes.set(list);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected abrirReasignar(f: Flete): void {
    this.reasignarDe.set(f);
    this.vehiculoSel = '';
    this.candidatos.set([]);
    this.cargandoCand.set(true);
    this.vehiculos.compatibles(f.solicitudId).subscribe({
      next: (list) => {
        this.candidatos.set(list.filter((v) => v.id !== f.vehiculoId));
        this.cargandoCand.set(false);
      },
      error: () => this.cargandoCand.set(false),
    });
  }

  protected cerrarReasignar(): void {
    this.reasignarDe.set(null);
  }

  protected confirmarReasignar(): void {
    const f = this.reasignarDe();
    if (!f || !this.vehiculoSel) return;
    this.reasignando.set(true);
    this.service.reasignar(f.id, this.vehiculoSel).subscribe({
      next: () => {
        this.reasignando.set(false);
        this.cerrarReasignar();
        this.feedback.success('Flete reasignado');
        this.cargar();
      },
      error: (err) => {
        this.reasignando.set(false);
        this.feedback.error(apiMessage(err, 'No se pudo reasignar'));
      },
    });
  }
}
