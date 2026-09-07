import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { EstadoFlete, EventoTimeline } from '@agroflete/shared';

const LABEL: Record<EstadoFlete, string> = {
  ASIGNADO: 'Flete asignado',
  EN_CAMINO_ORIGEN: 'Transportista en camino al origen',
  CARGANDO: 'Cargando en finca',
  EN_RUTA: 'En ruta al centro de acopio',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  INCIDENCIA: 'Incidencia en ruta',
};

@Component({
  selector: 'app-timeline',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="space-y-0">
      @for (ev of eventos; track $index; let last = $last) {
        <li class="flex gap-3">
          <div class="flex flex-col items-center">
            <span
              class="h-3 w-3 shrink-0 rounded-full"
              [class.bg-primary]="last"
              [class.bg-base-300]="!last"
            ></span>
            @if (!last) {
              <span class="w-px flex-1 bg-base-300"></span>
            }
          </div>
          <div class="pb-4">
            <div class="text-sm font-medium" [class.text-primary]="last">
              {{ label(ev.estado) }}
            </div>
            <div class="text-xs text-base-content/50">{{ ev.ts | date: 'medium' }}</div>
          </div>
        </li>
      }
    </ol>
  `,
})
export class TimelineComponent {
  @Input({ required: true }) eventos: EventoTimeline[] = [];

  protected label(estado: EstadoFlete): string {
    return LABEL[estado] ?? estado;
  }
}
