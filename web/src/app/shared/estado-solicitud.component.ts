import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { pagoDe, type Solicitud } from '@agroflete/shared';
import { estadoLabel } from './estado-labels';

/** Prioriza el estado del pago antes de asignar un flete. */
function vista(s: Solicitud): { texto: string; clase: string } {
  if (!s.fleteId) {
    switch (pagoDe(s).estado) {
      case 'PENDIENTE':
        return { texto: 'Pago pendiente', clase: 'badge-warning' };
      case 'EN_REVISION':
        return { texto: 'En revisión', clase: 'badge-info' };
      case 'RECHAZADO':
        return { texto: 'Pago rechazado', clase: 'badge-error' };
    }
  }
  const clase =
    s.estado === 'COMPLETADA'
      ? 'badge-success'
      : s.estado === 'CANCELADA'
        ? 'badge-ghost'
        : s.estado === 'PENDIENTE'
          ? 'badge-warning'
          : 'badge-info';
  return { texto: estadoLabel(s.estado), clase };
}

@Component({
  selector: 'app-estado-solicitud',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge {{ v().clase }}">{{ v().texto }}</span>`,
})
export class EstadoSolicitudComponent {
  readonly solicitud = input.required<Solicitud>();
  protected readonly v = computed(() => vista(this.solicitud()));
}
