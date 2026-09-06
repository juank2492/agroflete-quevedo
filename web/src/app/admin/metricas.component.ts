import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import type { EstadoFlete, MetricasOperativas } from '@agroflete/shared';
import { MetricasService } from '../core/metricas.service';
import { EstadoBadgeComponent } from '../shared/estado-badge.component';

interface Tarjeta {
  etiqueta: string;
  valor: string;
  nota?: string;
}

@Component({
  selector: 'app-metricas',
  imports: [EstadoBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-4xl">
      <h1 class="text-2xl font-bold">Métricas operativas</h1>
      <p class="mt-1 text-sm text-base-content/70">
        Indicadores calculados sobre las solicitudes y fletes registrados.
      </p>

      @if (cargando()) {
        <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="h-24 animate-pulse rounded-box bg-base-300"></div>
          }
        </div>
      } @else if (m(); as datos) {
        <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          @for (t of tarjetas(datos); track t.etiqueta) {
            <div class="rounded-box bg-base-100 p-5 shadow-card">
              <div class="text-sm text-base-content/60">{{ t.etiqueta }}</div>
              <div class="mt-1 font-display text-2xl font-bold">{{ t.valor }}</div>
              @if (t.nota) {
                <div class="mt-1 text-xs text-base-content/50">{{ t.nota }}</div>
              }
            </div>
          }
        </div>

        <div class="mt-6 rounded-box bg-base-100 p-5 shadow-card">
          <h2 class="font-semibold">Fletes por estado</h2>
          <div class="mt-3 flex flex-wrap gap-3">
            @for (e of estadosFlete(datos); track e.estado) {
              <div class="flex items-center gap-2 rounded-field border border-base-300 px-3 py-2">
                <app-estado-badge [estado]="e.estado" />
                <span class="font-semibold">{{ e.cantidad }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class MetricasComponent implements OnInit {
  private readonly service = inject(MetricasService);
  protected readonly cargando = signal(true);
  protected readonly m = signal<MetricasOperativas | null>(null);

  ngOnInit(): void {
    this.service.obtener().subscribe({
      next: (data) => {
        this.m.set(data);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected tarjetas(d: MetricasOperativas): Tarjeta[] {
    return [
      {
        etiqueta: 'Tiempo medio de asignación',
        valor: `${d.tiempoMedioAsignacionH.toFixed(1)} h`,
      },
      {
        etiqueta: 'Espera > 6 h',
        valor: `${d.pctEsperaMayor6h.toFixed(0)} %`,
        nota: 'de las solicitudes asignadas',
      },
      { etiqueta: 'Tarifa media', valor: `$ ${d.tarifaMedia.toFixed(2)}` },
      { etiqueta: 'Solicitudes pendientes', valor: `${d.solicitudesPendientes}` },
      { etiqueta: 'Alertas de retraso emitidas', valor: `${d.retrasosDetectados}` },
    ];
  }

  protected estadosFlete(d: MetricasOperativas): Array<{ estado: EstadoFlete; cantidad: number }> {
    return Object.entries(d.fletesPorEstado).map(([estado, cantidad]) => ({
      estado: estado as EstadoFlete,
      cantidad,
    }));
  }
}
