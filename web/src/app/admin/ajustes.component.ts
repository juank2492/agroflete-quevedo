import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import type { AjustesOperacion } from '@agroflete/shared';
import { AjustesService } from '../core/ajustes.service';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { apiMessage } from '../core/http-error';

@Component({
  selector: 'app-ajustes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl">
      <h1 class="text-2xl font-bold">Ajustes de operación</h1>

      @if (cargando()) {
        <div class="mt-6 h-24 animate-pulse rounded-box bg-base-300"></div>
      } @else {
        <div class="mt-6 rounded-box bg-base-100 p-5 shadow-card">
          <label class="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              class="toggle toggle-success mt-1"
              [checked]="ajustes()?.autoEmparejar ?? false"
              [disabled]="guardando()"
              (change)="alternar($event)"
            />
            <span>
              <span class="font-semibold">Emparejamiento automático</span>
              <span class="mt-1 block text-sm text-base-content/60">
                Cuando un productor crea una solicitud, el sistema intenta asignarla al vehículo
                disponible más adecuado de la misma zona. Si no hay ninguno, queda pendiente para
                que la asignes tú.
              </span>
            </span>
          </label>
        </div>
      }
    </div>
  `,
})
export class AjustesComponent implements OnInit {
  private readonly service = inject(AjustesService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly ajustes = signal<AjustesOperacion | null>(null);

  ngOnInit(): void {
    this.service.obtener().subscribe({
      next: (a) => {
        this.ajustes.set(a);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  alternar(ev: Event): void {
    const autoEmparejar = (ev.target as HTMLInputElement).checked;
    this.guardando.set(true);
    this.service.actualizar({ autoEmparejar }).subscribe({
      next: (a) => {
        this.guardando.set(false);
        this.ajustes.set(a);
        this.feedback.success(
          a.autoEmparejar
            ? 'Emparejamiento automático activado'
            : 'Emparejamiento automático desactivado',
        );
      },
      error: (err) => {
        this.guardando.set(false);
        this.feedback.error(apiMessage(err, 'No se pudo guardar el ajuste'));
      },
    });
  }
}
