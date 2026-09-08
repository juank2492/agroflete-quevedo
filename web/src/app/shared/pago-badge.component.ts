import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { EstadoPago } from '@agroflete/shared';

const INFO: Record<EstadoPago, { clase: string; texto: string }> = {
  PENDIENTE: { clase: 'badge-warning', texto: 'Pago pendiente' },
  EN_REVISION: { clase: 'badge-info', texto: 'Pago en revisión' },
  PAGADO: { clase: 'badge-success', texto: 'Pagado' },
  RECHAZADO: { clase: 'badge-error', texto: 'Pago rechazado' },
};

@Component({
  selector: 'app-pago-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge badge-sm {{ info().clase }}">{{ info().texto }}</span>`,
})
export class PagoBadgeComponent {
  readonly estado = input.required<EstadoPago>();
  protected readonly info = computed(() => INFO[this.estado()]);
}
