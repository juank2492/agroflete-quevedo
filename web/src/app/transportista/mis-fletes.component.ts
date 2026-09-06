import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TRANSICIONES_FLETE, type EstadoFlete, type Flete } from '@agroflete/shared';
import { FleteService } from '../core/flete.service';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { apiMessage } from '../core/http-error';
import { EstadoBadgeComponent } from '../shared/estado-badge.component';
import { TimelineComponent } from '../shared/timeline.component';

const LABEL_ACCION: Record<EstadoFlete, string> = {
  ASIGNADO: 'Asignado',
  EN_CAMINO_ORIGEN: 'Salir hacia el origen',
  CARGANDO: 'Empezar a cargar',
  EN_RUTA: 'Salir hacia el acopio',
  ENTREGADO: 'Confirmar entrega',
  CANCELADO: 'Cancelar',
};

@Component({
  selector: 'app-mis-fletes',
  imports: [DecimalPipe, EstadoBadgeComponent, TimelineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl">
      <h1 class="text-2xl font-bold">Mis fletes</h1>

      @if (cargando()) {
        <div class="mt-6 space-y-3">
          @for (i of [1, 2]; track i) {
            <div class="h-32 animate-pulse rounded-box bg-base-300"></div>
          }
        </div>
      } @else if (fletes().length === 0) {
        <p class="mt-8 rounded-box bg-base-100 p-6 text-center text-base-content/70 shadow-card">
          Todavía no tienes fletes asignados.
        </p>
      } @else {
        <ul class="mt-6 space-y-4">
          @for (f of fletes(); track f.id) {
            <li class="rounded-box border border-base-300 bg-base-100 p-4 shadow-card">
              <div class="flex items-center justify-between">
                <span class="font-display font-semibold">
                  Flete · $ {{ f.tarifa | number: '1.2-2' }}
                </span>
                <app-estado-badge [estado]="f.estado" />
              </div>

              <div class="mt-3">
                <app-timeline [eventos]="f.timeline" />
              </div>

              @if (siguientes(f.estado).length > 0) {
                <div class="mt-2 flex flex-wrap gap-2">
                  @for (sig of siguientes(f.estado); track sig) {
                    <button
                      class="btn btn-sm rounded-full"
                      [class.btn-primary]="sig !== 'CANCELADO'"
                      [class.btn-ghost]="sig === 'CANCELADO'"
                      [disabled]="actualizandoId() === f.id"
                      (click)="avanzar(f, sig)"
                    >
                      {{ accion(sig) }}
                    </button>
                  }
                </div>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class MisFletesComponent implements OnInit {
  private readonly service = inject(FleteService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly cargando = signal(true);
  protected readonly fletes = signal<Flete[]>([]);
  protected readonly actualizandoId = signal<string | null>(null);

  ngOnInit(): void {
    this.recargar();
  }

  protected siguientes(estado: EstadoFlete): EstadoFlete[] {
    return TRANSICIONES_FLETE[estado];
  }

  protected accion(estado: EstadoFlete): string {
    return LABEL_ACCION[estado];
  }

  private recargar(): void {
    this.cargando.set(true);
    this.service.listar().subscribe({
      next: (list) => {
        this.fletes.set(list);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  avanzar(f: Flete, nuevoEstado: EstadoFlete): void {
    this.actualizandoId.set(f.id);
    this.service.cambiarEstado(f.id, { nuevoEstado }).subscribe({
      next: () => {
        this.actualizandoId.set(null);
        this.feedback.success('Estado actualizado');
        this.recargar();
      },
      error: (err) => {
        this.actualizandoId.set(null);
        this.feedback.error(apiMessage(err, 'No se pudo actualizar el estado'));
      },
    });
  }
}
