import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { Flete, Solicitud } from '@agroflete/shared';
import { IconComponent } from '../core/icon.component';
import { FleteService } from '../core/flete.service';
import { SolicitudService } from '../core/solicitud.service';
import { EstadoBadgeComponent } from '../shared/estado-badge.component';
import { TimelineComponent } from '../shared/timeline.component';

@Component({
  selector: 'app-detalle-solicitud',
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    TitleCasePipe,
    IconComponent,
    EstadoBadgeComponent,
    TimelineComponent,
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
            <h1 class="text-xl font-bold">{{ s.cultivo | titlecase }} · {{ s.pesoTon }} t</h1>
            <app-estado-badge [estado]="s.estado" />
          </div>

          <div class="mt-4 space-y-3 text-sm">
            <div class="flex items-start gap-3">
              <app-icon name="pin" [size]="18" class="mt-0.5 text-primary" />
              <div>
                <div class="text-base-content/60">Origen</div>
                {{ s.origen.lat | number: '1.4-4' }}, {{ s.origen.lon | number: '1.4-4' }}
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
          </div>

          <div class="mt-4 flex items-center justify-between border-t border-base-300 pt-4">
            <span class="text-base-content/60">Tarifa estimada</span>
            <span class="font-display text-2xl font-bold text-primary">
              $ {{ s.tarifaEstimada | number: '1.2-2' }}
            </span>
          </div>

          <p class="mt-3 text-xs text-base-content/50">
            Publicada el {{ s.createdAt | date: 'medium' }}.
            @if (s.estado === 'PENDIENTE') {
              Esperando que la comercializadora asigne un transportista.
            }
          </p>
        </div>

        @if (flete(); as f) {
          <div class="mt-4 rounded-box bg-base-100 p-5 shadow-card">
            <h2 class="font-semibold">Seguimiento del flete</h2>
            <div class="mt-3">
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
  protected readonly cargando = signal(true);
  protected readonly solicitud = signal<Solicitud | null>(null);
  protected readonly flete = signal<Flete | null>(null);

  @Input() id!: string;

  ngOnInit(): void {
    this.service.obtener(this.id).subscribe({
      next: (s) => {
        this.solicitud.set(s);
        this.cargando.set(false);
        if (s.fleteId) {
          this.fleteService.obtener(s.fleteId).subscribe({ next: (f) => this.flete.set(f) });
        }
      },
      error: () => this.cargando.set(false),
    });
  }
}
