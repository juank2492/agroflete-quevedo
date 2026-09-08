import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { pagoDe, type Solicitud } from '@agroflete/shared';
import { PagoService } from '../core/pago.service';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { apiMessage } from '../core/http-error';

@Component({
  selector: 'app-pagos-admin',
  imports: [DatePipe, DecimalPipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-3xl">
      <h1 class="text-2xl font-bold">Pagos por revisar</h1>
      <p class="mt-1 text-sm text-base-content/60">
        Depósitos y transferencias que los productores registraron. Al aprobar, la solicitud entra
        en la cola de asignación.
      </p>

      @if (cargando()) {
        <div class="mt-6 h-32 animate-pulse rounded-box bg-base-300"></div>
      } @else if (pendientes().length === 0) {
        <p class="mt-8 rounded-box bg-base-100 p-6 text-center text-base-content/70 shadow-card">
          No hay comprobantes pendientes de revisión.
        </p>
      } @else {
        <ul class="mt-6 space-y-4">
          @for (s of pendientes(); track s.id) {
            <li class="rounded-box border border-base-300 bg-base-100 p-4 shadow-card">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="font-medium">{{ s.cultivoNombre }} · {{ s.pesoTon }} t</div>
                  <div class="text-xs text-base-content/60">→ {{ s.acopioNombre }}</div>
                </div>
                <span class="font-semibold text-primary">
                  $ {{ pagoDe(s).monto ?? s.tarifaEstimada | number: '1.2-2' }}
                </span>
              </div>

              @if (pagoDe(s).comprobante; as c) {
                <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt class="text-base-content/60">Banco</dt>
                  <dd>{{ c.banco }}</dd>
                  <dt class="text-base-content/60">Comprobante</dt>
                  <dd class="font-mono">{{ c.referencia }}</dd>
                  <dt class="text-base-content/60">Monto declarado</dt>
                  <dd>$ {{ c.monto | number: '1.2-2' }}</dd>
                  <dt class="text-base-content/60">Fecha</dt>
                  <dd>{{ c.fecha }}</dd>
                </dl>
              }

              <input
                type="text"
                [(ngModel)]="nota[s.id]"
                placeholder="Nota (obligatoria para rechazar)"
                class="input input-bordered input-sm mt-3 w-full"
              />

              <div class="mt-3 flex justify-end gap-2">
                <button
                  class="btn btn-outline btn-error btn-sm rounded-full"
                  [disabled]="procesando() === s.id || !nota[s.id]?.trim()"
                  (click)="revisar(s, false)"
                >
                  Rechazar
                </button>
                <button
                  class="btn btn-primary btn-sm rounded-full"
                  [disabled]="procesando() === s.id"
                  (click)="revisar(s, true)"
                >
                  @if (procesando() === s.id) {
                    <span class="loading loading-spinner loading-sm"></span>
                  }
                  Aprobar
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class PagosAdminComponent implements OnInit {
  private readonly service = inject(PagoService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly pagoDe = pagoDe;
  protected readonly cargando = signal(true);
  protected readonly pendientes = signal<Solicitud[]>([]);
  protected readonly procesando = signal<string | null>(null);
  protected readonly nota: Record<string, string> = {};

  ngOnInit(): void {
    this.recargar();
  }

  private recargar(): void {
    this.cargando.set(true);
    this.service.enRevision().subscribe({
      next: (list) => {
        this.pendientes.set(list);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected revisar(s: Solicitud, aprobar: boolean): void {
    const nota = this.nota[s.id]?.trim();
    if (!aprobar && !nota) return;
    this.procesando.set(s.id);
    this.service.revisar(s.id, { aprobar, ...(nota ? { nota } : {}) }).subscribe({
      next: () => {
        this.procesando.set(null);
        this.feedback.success(aprobar ? 'Pago aprobado' : 'Pago rechazado');
        delete this.nota[s.id];
        this.recargar();
      },
      error: (err) => {
        this.procesando.set(null);
        this.feedback.error(apiMessage(err, 'No se pudo procesar'));
      },
    });
  }
}
