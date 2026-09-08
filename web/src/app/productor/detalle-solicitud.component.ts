import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { pagoConfirmado } from '@agroflete/shared';
import type { Flete, LatLon, RutaVialDTO, Solicitud, UbicacionFlete } from '@agroflete/shared';
import { IconComponent } from '../core/icon.component';
import { FleteService } from '../core/flete.service';
import { GeoService } from '../core/geo.service';
import { SolicitudService } from '../core/solicitud.service';
import { EstadoSolicitudComponent } from '../shared/estado-solicitud.component';
import { TimelineComponent } from '../shared/timeline.component';
import { MapaFleteComponent } from '../shared/mapa-flete.component';
import { PagoSolicitudComponent } from './pago-solicitud.component';
import { tipoVehiculoLabel } from '../shared/vehiculo-labels';
import { estadoViaje, haceTexto } from '../shared/tracking.util';

const EN_CURSO = new Set(['ASIGNADO', 'EN_CAMINO_ORIGEN', 'CARGANDO', 'EN_RUTA']);

@Component({
  selector: 'app-detalle-solicitud',
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    IconComponent,
    EstadoSolicitudComponent,
    TimelineComponent,
    MapaFleteComponent,
    PagoSolicitudComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-md">
      <a routerLink="/p/solicitudes" class="link link-hover text-sm text-base-content/60">
        ← Mis solicitudes
      </a>

      @if (cargando()) {
        <div class="mt-4 h-64 animate-pulse rounded-box bg-base-300"></div>
      } @else if (solicitud(); as s) {
        <div class="mt-4 rounded-box bg-base-100 p-5 shadow-card">
          <div class="flex items-center justify-between">
            <h1 class="text-xl font-bold">{{ s.cultivoNombre }} · {{ s.pesoTon }} t</h1>
            <app-estado-solicitud [solicitud]="s" />
          </div>

          <div class="mt-4 space-y-3 text-sm">
            <div class="flex items-start gap-3">
              <app-icon name="pin" [size]="18" class="mt-0.5 text-primary" />
              <div>
                <div class="text-base-content/60">Origen</div>
                @if (s.origenNombre) {
                  {{ s.origenNombre }}
                } @else {
                  {{ s.origen.lat | number: '1.4-4' }}, {{ s.origen.lon | number: '1.4-4' }}
                }
              </div>
            </div>
            <div class="flex items-start gap-3">
              <app-icon name="pin" [size]="18" class="mt-0.5 text-secondary" />
              <div>
                <div class="text-base-content/60">Destino</div>
                {{ s.acopioNombre }}
              </div>
            </div>
            <div class="flex items-start gap-3">
              <app-icon name="route" [size]="18" class="mt-0.5 text-base-content/50" />
              <div>{{ s.distanciaKm | number: '1.1-1' }} km por carretera (estimado)</div>
            </div>
            @if (s.categoriaCarga) {
              <div class="flex items-start gap-3">
                <app-icon name="truck" [size]="18" class="mt-0.5 text-base-content/50" />
                <div>{{ tipoLabel(s.categoriaCarga) }} ({{ s.pesoTon }} t)</div>
              </div>
            }
          </div>

          <div class="mt-4 flex items-center justify-between border-t border-base-300 pt-4">
            <span class="text-base-content/60">Tarifa</span>
            <span class="font-display text-2xl font-bold text-primary">
              $ {{ s.tarifaEstimada | number: '1.2-2' }}
            </span>
          </div>

          <p class="mt-3 text-xs text-base-content/50">
            Publicada el {{ s.createdAt | date: 'medium' }}.
            @if (s.estado === 'PENDIENTE' && pagado()) {
              Esperando que la comercializadora asigne un transportista.
            }
          </p>
        </div>

        @if (!flete()) {
          <div class="mt-4">
            <app-pago-solicitud [solicitud]="s" (procesado)="recargar()" />
          </div>
        }

        @if (flete(); as f) {
          <div class="mt-4 rounded-box bg-base-100 p-5 shadow-card">
            <h2 class="font-semibold">Seguimiento del flete</h2>

            <div class="mt-3">
              <app-mapa-flete
                [origen]="f.origen ?? s.origen"
                [destino]="f.destino ?? null"
                [ultima]="f.ultimaUbicacion ?? null"
                [ruta]="ruta()"
                [rutaVial]="rutaVialEfectiva()"
              />

              @if (viaje(); as v) {
                @if (v.progreso !== null) {
                  <div class="mt-3">
                    <div class="flex justify-between text-xs text-base-content/60">
                      <span>{{ v.kmRestantes | number: '1.0-1' }} km al acopio</span>
                      <span>
                        @if (v.eta) {
                          llega ~{{ v.eta | date: 'shortTime' }}
                        }
                      </span>
                    </div>
                    <div class="mt-1 h-2 overflow-hidden rounded-full bg-base-300">
                      <div
                        class="h-full rounded-full bg-primary transition-[width] duration-500"
                        [style.width.%]="v.progreso * 100"
                      ></div>
                    </div>
                  </div>
                }
                <p class="mt-2 flex items-center gap-2 text-xs">
                  <span
                    class="inline-block h-2 w-2 rounded-full"
                    [class.bg-success]="v.senal === 'viva'"
                    [class.bg-warning]="v.senal === 'debil'"
                    [class.bg-base-300]="v.senal === 'sin'"
                  ></span>
                  @switch (v.senal) {
                    @case ('viva') {
                      <span class="text-base-content/60">
                        Señal en vivo del transportista
                        @if (f.ultimaUbicacion?.velocidad; as vel) {
                          · {{ vel }} km/h
                        }
                      </span>
                    }
                    @case ('debil') {
                      <span class="text-base-content/60">
                        Última señal {{ hace(f.ultimaUbicacion!.ts) }}
                      </span>
                    }
                    @default {
                      <span class="text-base-content/50">
                        @if (f.ultimaUbicacion) {
                          Sin señal reciente ({{ hace(f.ultimaUbicacion.ts) }})
                        } @else {
                          Aún sin señal de ubicación del transportista.
                        }
                      </span>
                    }
                  }
                </p>
              }
            </div>

            <div class="mt-4">
              <app-timeline [eventos]="f.timeline" />
            </div>
          </div>
        }
      } @else {
        <p class="mt-6 text-base-content/70">No se encontró la solicitud.</p>
      }
    </div>
  `,
})
export class DetalleSolicitudComponent implements OnInit {
  private readonly service = inject(SolicitudService);
  private readonly fleteService = inject(FleteService);
  private readonly geo = inject(GeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly solicitud = signal<Solicitud | null>(null);
  protected readonly flete = signal<Flete | null>(null);
  protected readonly ruta = signal<UbicacionFlete[]>([]);
  /** Ruta obtenida para fletes antiguos sin ruta guardada. */
  private readonly rutaFallback = signal<RutaVialDTO | null>(null);

  protected readonly enCurso = computed(() => {
    const f = this.flete();
    return !!f && EN_CURSO.has(f.estado);
  });

  protected readonly pagado = computed(() => {
    const s = this.solicitud();
    return !!s && pagoConfirmado(s);
  });

  protected readonly rutaVialEfectiva = computed<LatLon[]>(() => {
    const f = this.flete();
    if (f?.rutaVial?.length) return f.rutaVial;
    return this.rutaFallback()?.geometria ?? [];
  });

  /** Métricas calculadas del viaje. */
  protected readonly viaje = computed(() => {
    const f = this.flete();
    if (!f) return null;
    const fb = this.rutaFallback();
    return estadoViaje({
      rutaVial: this.rutaVialEfectiva(),
      origen: f.origen ?? this.solicitud()?.origen ?? null,
      destino: f.destino ?? null,
      ultima: f.ultimaUbicacion ?? null,
      rastro: this.ruta(),
      distanciaVialKm: f.distanciaVialKm ?? fb?.distanciaKm,
      duracionEstimadaMin: f.duracionEstimadaMin ?? fb?.duracionMin,
    });
  });

  @Input() id!: string;

  private tick = 0;

  ngOnInit(): void {
    this.recargar();

    // Sondeo casi en vivo: sigue la posición del transportista cada 2 s mientras
    // el flete está en curso, refresca el rastro y detecta la asignación cada 10 s.
    interval(2_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        this.tick += 1;
        const f = this.flete();
        if (f && this.enCurso()) {
          this.seguirPosicion(f.id);
          if (this.tick % 5 === 0) {
            this.fleteService.ruta(f.id).subscribe({ next: (r) => this.ruta.set(r) });
          }
        } else if (this.tick % 5 === 0) {
          this.recargar();
        }
      });
  }

  /** Relee el flete (posición, estado, timeline) sin recargar toda la vista. */
  private seguirPosicion(fleteId: string): void {
    this.fleteService.obtener(fleteId).subscribe({
      next: (f) => {
        this.flete.set(f);
        this.asegurarRuta(f);
      },
    });
  }

  protected recargar(): void {
    this.service.obtener(this.id).subscribe({
      next: (s) => {
        this.solicitud.set(s);
        this.cargando.set(false);
        if (s.fleteId) this.cargarFlete(s.fleteId);
      },
      error: () => this.cargando.set(false),
    });
  }

  private cargarFlete(fleteId: string): void {
    this.fleteService.obtener(fleteId).subscribe({
      next: (f) => {
        this.flete.set(f);
        this.asegurarRuta(f);
      },
    });
    this.fleteService.ruta(fleteId).subscribe({ next: (r) => this.ruta.set(r) });
  }

  /** Obtiene la ruta una vez si el flete no la trae. */
  private asegurarRuta(f: Flete): void {
    if (f.rutaVial?.length || this.rutaFallback()) return;
    const o = f.origen ?? this.solicitud()?.origen ?? null;
    const d = f.destino ?? null;
    if (!o || !d) return;
    this.geo.ruta(o, d).subscribe({ next: (r) => this.rutaFallback.set(r) });
  }

  protected readonly tipoLabel = tipoVehiculoLabel;

  protected hace(iso: string): string {
    return haceTexto(iso);
  }
}
