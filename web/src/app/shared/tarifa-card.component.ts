import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

/** Tarjeta presentacional con la tarifa estimada de un flete. */
@Component({
  selector: 'app-tarifa-card',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-box border border-base-300 bg-base-100 p-5 shadow-card">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-base-content/60">Tarifa estimada</span>
        @if (enTemporada) {
          <span class="badge badge-warning badge-sm">temporada de cosecha</span>
        }
      </div>

      @if (cargando) {
        <div class="mt-2 h-9 w-32 animate-pulse rounded bg-base-300"></div>
        <div class="mt-2 h-4 w-40 animate-pulse rounded bg-base-300"></div>
      } @else if (tarifa != null) {
        <div class="mt-1 font-display text-3xl font-bold">$ {{ tarifa | number: '1.2-2' }}</div>
        <p class="mt-1 text-sm text-base-content/60">
          {{ distanciaKm | number: '1.1-1' }} km por carretera (estimado)
        </p>
      } @else {
        <p class="mt-2 text-sm text-base-content/50">
          Completa origen, destino y cultivo para ver la tarifa.
        </p>
      }
    </div>
  `,
})
export class TarifaCardComponent {
  @Input() tarifa: number | null = null;
  @Input() distanciaKm = 0;
  @Input() enTemporada = false;
  @Input() cargando = false;
}
