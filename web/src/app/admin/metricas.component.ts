import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import type { MetricasOperativas } from '@agroflete/shared';
import { MetricasService } from '../core/metricas.service';
import { estadoLabel } from '../shared/estado-labels';
import { GraficoBarrasComponent, type DatoGrafico } from '../shared/grafico-barras.component';
import { GraficoActividadComponent, type SerieDia } from '../shared/grafico-actividad.component';

interface Tarjeta {
  etiqueta: string;
  valor: string;
  nota?: string;
}

interface Dial {
  etiqueta: string;
  valor: number;
  clase: string;
}

const VERDE = 'var(--color-primary, #2f9e5e)';
const AZUL = 'var(--color-info, #3b82f6)';

/** Color de barra por estado, alineado con los badges. */
const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: 'var(--color-warning, #f59e0b)',
  ASIGNADA: AZUL,
  EN_PROCESO: AZUL,
  COMPLETADA: 'var(--color-success, #16a34a)',
  CANCELADA: 'var(--color-base-300, #d1d5db)',
  ASIGNADO: AZUL,
  EN_CAMINO_ORIGEN: AZUL,
  CARGANDO: AZUL,
  EN_RUTA: AZUL,
  ENTREGADO: 'var(--color-success, #16a34a)',
  CANCELADO: 'var(--color-base-300, #d1d5db)',
  INCIDENCIA: 'var(--color-error, #dc2626)',
};

@Component({
  selector: 'app-metricas',
  imports: [GraficoBarrasComponent, GraficoActividadComponent],
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
        <div class="mt-6 h-64 animate-pulse rounded-box bg-base-300"></div>
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

        <div class="mt-6 grid gap-4 lg:grid-cols-2">
          <div class="rounded-box bg-base-100 p-5 shadow-card">
            <h2 class="font-semibold">Fletes por estado</h2>
            <p class="mt-0.5 text-xs text-base-content/50">
              {{ totalFletes(datos) }} fletes en total
            </p>
            <div class="mt-4">
              <app-grafico-barras [datos]="fletesData(datos)" />
            </div>
          </div>

          <div class="rounded-box bg-base-100 p-5 shadow-card">
            <h2 class="font-semibold">Solicitudes por estado</h2>
            <p class="mt-0.5 text-xs text-base-content/50">
              {{ totalSolicitudes(datos) }} solicitudes en total
            </p>
            <div class="mt-4">
              <app-grafico-barras [datos]="solicitudesData(datos)" />
            </div>
          </div>
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <div class="rounded-box bg-base-100 p-5 shadow-card">
            <h2 class="font-semibold">Solicitudes por cultivo</h2>
            <p class="mt-0.5 text-xs text-base-content/50">reparto de la demanda</p>
            @if (datos.solicitudesPorCultivo.length === 0) {
              <p class="mt-6 text-center text-sm text-base-content/50">
                Sin solicitudes registradas.
              </p>
            } @else {
              <div class="mt-4">
                <app-grafico-barras [datos]="cultivoData(datos)" />
              </div>
            }
          </div>

          <div class="rounded-box bg-base-100 p-5 shadow-card">
            <h2 class="font-semibold">Cumplimiento</h2>
            <p class="mt-0.5 text-xs text-base-content/50">porcentajes clave</p>
            <div class="mt-5 flex flex-wrap justify-around gap-4">
              @for (d of diales(datos); track d.etiqueta) {
                <div class="flex flex-col items-center gap-2">
                  <div
                    class="radial-progress {{ d.clase }}"
                    [style.--value]="d.valor"
                    style="--size: 5rem; --thickness: 0.5rem"
                    role="progressbar"
                    [attr.aria-valuenow]="d.valor"
                  >
                    <span class="text-sm font-semibold">{{ d.valor }}%</span>
                  </div>
                  <span class="max-w-24 text-center text-xs text-base-content/60">{{
                    d.etiqueta
                  }}</span>
                </div>
              }
            </div>
          </div>
        </div>

        <div class="mt-4 rounded-box bg-base-100 p-5 shadow-card">
          <div class="flex items-baseline justify-between">
            <h2 class="font-semibold">Actividad diaria</h2>
            <span class="text-xs text-base-content/50">últimos 14 días</span>
          </div>
          @if (totalActividad(datos) === 0) {
            <p class="mt-6 text-center text-sm text-base-content/50">
              Sin movimientos en el periodo.
            </p>
          } @else {
            <div class="mt-4">
              <app-grafico-actividad [series]="serieActividad(datos)" />
            </div>
          }
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

  protected fletesData(d: MetricasOperativas): DatoGrafico[] {
    return Object.entries(d.fletesPorEstado).map(([estado, valor]) => ({
      etiqueta: estadoLabel(estado),
      valor,
      color: COLOR_ESTADO[estado],
    }));
  }

  protected solicitudesData(d: MetricasOperativas): DatoGrafico[] {
    return Object.entries(d.solicitudesPorEstado).map(([estado, valor]) => ({
      etiqueta: estadoLabel(estado),
      valor,
      color: COLOR_ESTADO[estado],
    }));
  }

  protected cultivoData(d: MetricasOperativas): DatoGrafico[] {
    return d.solicitudesPorCultivo.map((c) => ({ etiqueta: c.cultivo, valor: c.cantidad }));
  }

  protected serieActividad(d: MetricasOperativas): SerieDia[] {
    return [
      { nombre: 'Solicitudes creadas', color: VERDE, puntos: d.solicitudesPorDia },
      { nombre: 'Entregas confirmadas', color: AZUL, puntos: d.entregasPorDia },
    ];
  }

  protected diales(d: MetricasOperativas): Dial[] {
    const totalS = this.totalSolicitudes(d);
    const totalF = this.totalFletes(d);
    const completadas = d.solicitudesPorEstado.COMPLETADA ?? 0;
    const entregados = d.fletesPorEstado.ENTREGADO ?? 0;
    return [
      { etiqueta: 'Espera > 6 h', valor: Math.round(d.pctEsperaMayor6h), clase: 'text-warning' },
      {
        etiqueta: 'Solicitudes completadas',
        valor: totalS ? Math.round((completadas / totalS) * 100) : 0,
        clase: 'text-success',
      },
      {
        etiqueta: 'Fletes entregados',
        valor: totalF ? Math.round((entregados / totalF) * 100) : 0,
        clase: 'text-primary',
      },
    ];
  }

  protected totalFletes(d: MetricasOperativas): number {
    return Object.values(d.fletesPorEstado).reduce((a, b) => a + b, 0);
  }

  protected totalSolicitudes(d: MetricasOperativas): number {
    return Object.values(d.solicitudesPorEstado).reduce((a, b) => a + b, 0);
  }

  protected totalActividad(d: MetricasOperativas): number {
    return [...d.solicitudesPorDia, ...d.entregasPorDia].reduce((a, p) => a + p.cantidad, 0);
  }
}
