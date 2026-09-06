import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import type { EstadoFlete, EstadoSolicitud, EstadoVehiculo } from '@agroflete/shared';

type Estado = EstadoSolicitud | EstadoFlete | EstadoVehiculo;

const MAP: Record<Estado, { clase: string; label: string }> = {
  // Solicitud
  PENDIENTE: { clase: 'badge-warning', label: 'Pendiente' },
  ASIGNADA: { clase: 'badge-info', label: 'Asignada' },
  EN_PROCESO: { clase: 'badge-info', label: 'En proceso' },
  COMPLETADA: { clase: 'badge-success', label: 'Completada' },
  CANCELADA: { clase: 'badge-ghost', label: 'Cancelada' },
  // Flete
  ASIGNADO: { clase: 'badge-info', label: 'Asignado' },
  EN_CAMINO_ORIGEN: { clase: 'badge-info', label: 'En camino al origen' },
  CARGANDO: { clase: 'badge-info', label: 'Cargando' },
  EN_RUTA: { clase: 'badge-info', label: 'En ruta' },
  ENTREGADO: { clase: 'badge-success', label: 'Entregado' },
  CANCELADO: { clase: 'badge-ghost', label: 'Cancelado' },
  // Vehículo
  DISPONIBLE: { clase: 'badge-success', label: 'Disponible' },
  OCUPADO: { clase: 'badge-info', label: 'Ocupado' },
  INACTIVO: { clase: 'badge-ghost', label: 'Inactivo' },
};

@Component({
  selector: 'app-estado-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge {{ info().clase }}">{{ info().label }}</span>`,
})
export class EstadoBadgeComponent {
  private readonly _estado = signal<Estado>('PENDIENTE');
  @Input({ required: true }) set estado(v: Estado) {
    this._estado.set(v);
  }
  protected readonly info = computed(
    () => MAP[this._estado()] ?? { clase: 'badge-ghost', label: this._estado() },
  );
}
