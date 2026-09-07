import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ESTADOS_SOLICITUD, type EstadoSolicitud, type Solicitud } from '@agroflete/shared';
import { IconComponent } from '../core/icon.component';
import { SolicitudService } from '../core/solicitud.service';
import { EstadoBadgeComponent } from '../shared/estado-badge.component';
import { FiltroChipsComponent, type OpcionFiltro } from '../shared/filtro-chips.component';
import { PaginacionComponent, paginar } from '../shared/paginacion.component';
import { estadoLabel } from '../shared/estado-labels';

const POR_PAGINA = 8;

@Component({
  selector: 'app-mis-solicitudes',
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    IconComponent,
    EstadoBadgeComponent,
    FiltroChipsComponent,
    PaginacionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold">Mis solicitudes</h1>
        <a routerLink="/p/solicitudes/nueva" class="btn btn-primary btn-sm rounded-full">
          <app-icon name="plus" [size]="16" /> Nueva
        </a>
      </div>

      @if (cargando()) {
        <div class="mt-6 space-y-3">
          @for (i of [1, 2, 3]; track i) {
            <div class="h-20 animate-pulse rounded-box bg-base-300"></div>
          }
        </div>
      } @else if (solicitudes().length === 0) {
        <div class="mt-10 rounded-box bg-base-100 p-8 text-center shadow-card">
          <app-icon name="leaf" [size]="28" class="mx-auto text-primary" />
          <p class="mt-3 text-base-content/70">Aún no has publicado ninguna carga.</p>
          <a routerLink="/p/solicitudes/nueva" class="btn btn-primary mt-4 rounded-full">
            Publicar mi primera carga
          </a>
        </div>
      } @else {
        <div class="mt-5">
          <app-filtro-chips
            [opciones]="opcionesFiltro()"
            [valor]="filtro()"
            (valorChange)="cambiarFiltro($event)"
          />
        </div>

        @if (filtradas().length === 0) {
          <p class="mt-6 rounded-box bg-base-100 p-6 text-center text-base-content/70 shadow-card">
            No hay solicitudes en este estado.
          </p>
        } @else {
          <ul class="mt-4 space-y-3">
            @for (s of visibles(); track s.id) {
              <li>
                <a
                  [routerLink]="['/p/solicitudes', s.id]"
                  class="block rounded-box border border-base-300 bg-base-100 p-4 shadow-card transition hover:border-primary/40"
                >
                  <div class="flex items-center justify-between">
                    <span class="font-semibold">{{ s.cultivoNombre }} · {{ s.pesoTon }} t</span>
                    <app-estado-badge [estado]="s.estado" />
                  </div>
                  <div class="mt-1 text-sm text-base-content/70">→ {{ s.acopioNombre }}</div>
                  <div class="mt-2 flex items-center justify-between text-sm">
                    <span class="text-base-content/60">
                      {{ s.distanciaKm | number: '1.1-1' }} km ·
                      {{ s.createdAt | date: 'short' }}
                    </span>
                    <span class="font-semibold text-primary">
                      $ {{ s.tarifaEstimada | number: '1.2-2' }}
                    </span>
                  </div>
                </a>
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
  `,
})
export class MisSolicitudesComponent implements OnInit {
  private readonly service = inject(SolicitudService);
  protected readonly cargando = signal(true);
  protected readonly solicitudes = signal<Solicitud[]>([]);
  protected readonly filtro = signal<EstadoSolicitud | 'TODOS'>('TODOS');
  protected readonly pagina = signal(1);
  protected readonly porPagina = POR_PAGINA;

  protected readonly opcionesFiltro = computed<OpcionFiltro[]>(() => {
    const presentes = new Set(this.solicitudes().map((s) => s.estado));
    return [
      { valor: 'TODOS', etiqueta: 'Todas' },
      ...ESTADOS_SOLICITUD.filter((e) => presentes.has(e)).map((e) => ({
        valor: e,
        etiqueta: estadoLabel(e),
      })),
    ];
  });

  protected readonly filtradas = computed(() => {
    const f = this.filtro();
    return f === 'TODOS' ? this.solicitudes() : this.solicitudes().filter((s) => s.estado === f);
  });

  protected readonly visibles = computed(() =>
    paginar(this.filtradas(), this.pagina(), this.porPagina),
  );

  ngOnInit(): void {
    this.service.listar().subscribe({
      next: (list) => {
        this.solicitudes.set(list);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected cambiarFiltro(v: string): void {
    this.filtro.set(v as EstadoSolicitud | 'TODOS');
    this.pagina.set(1);
  }
}
