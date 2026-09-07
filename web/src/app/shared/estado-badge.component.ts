import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { ESTADO_LABEL, type EstadoCualquiera } from './estado-labels';

const CLASE: Record<EstadoCualquiera, string> = {
  PENDIENTE: 'badge-warning',
  ASIGNADA: 'badge-info',
  EN_PROCESO: 'badge-info',
  COMPLETADA: 'badge-success',
  CANCELADA: 'badge-ghost',
  ASIGNADO: 'badge-info',
  EN_CAMINO_ORIGEN: 'badge-info',
  CARGANDO: 'badge-info',
  EN_RUTA: 'badge-info',
  ENTREGADO: 'badge-success',
  CANCELADO: 'badge-ghost',
  INCIDENCIA: 'badge-error',
  DISPONIBLE: 'badge-success',
  OCUPADO: 'badge-info',
  INACTIVO: 'badge-ghost',
};

@Component({
  selector: 'app-estado-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge {{ info().clase }}">{{ info().label }}</span>`,
})
export class EstadoBadgeComponent {
  private readonly _estado = signal<EstadoCualquiera>('PENDIENTE');
  @Input({ required: true }) set estado(v: EstadoCualquiera) {
    this._estado.set(v);
  }
  protected readonly info = computed(() => {
    const e = this._estado();
    return { clase: CLASE[e] ?? 'badge-ghost', label: ESTADO_LABEL[e] ?? e };
  });
}
