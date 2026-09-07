import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { EstadoStock, InventarioAcopio, StockCultivo } from '@agroflete/shared';
import { InventarioService } from '../core/inventario.service';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { apiMessage } from '../core/http-error';
import { zonaLabel } from '../shared/zona';

const CLASE_ESTADO: Record<EstadoStock, string> = {
  BAJO: 'badge-error',
  OK: 'badge-success',
  ALTO: 'badge-warning',
};

interface FilaSel {
  acopioId: string;
  acopioNombre: string;
  fila: StockCultivo;
}

@Component({
  selector: 'app-inventario',
  imports: [DecimalPipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-4xl">
      <h1 class="text-2xl font-bold">Inventario de acopios</h1>
      <p class="mt-1 text-sm text-base-content/70">
        El stock sube solo al confirmar entregas. Registra salidas y fija los umbrales para las
        alertas de stock bajo y stock alto.
      </p>

      @if (cargando()) {
        <div class="mt-6 h-48 animate-pulse rounded-box bg-base-300"></div>
      } @else {
        <div class="mt-6 space-y-6">
          @for (acopio of tablero(); track acopio.acopioId) {
            <div class="overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-card">
              <div class="flex items-center justify-between border-b border-base-300 px-5 py-3">
                <h2 class="font-display font-semibold">{{ acopio.acopioNombre }}</h2>
                <span class="text-xs text-base-content/50">{{ zona(acopio.zona) }}</span>
              </div>
              @if (acopio.stock.length === 0) {
                <p class="px-5 py-6 text-sm text-base-content/60">
                  Sin filas de inventario todavía.
                </p>
              } @else {
                <table class="table">
                  <thead>
                    <tr>
                      <th>Cultivo</th>
                      <th class="text-right">Cantidad (t)</th>
                      <th class="text-right">Mín</th>
                      <th class="text-right">Máx</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (f of acopio.stock; track f.cultivo) {
                      <tr>
                        <td>{{ f.cultivoNombre }}</td>
                        <td class="text-right font-semibold">
                          {{ f.cantidadActual | number: '1.0-2' }}
                        </td>
                        <td class="text-right text-base-content/60">{{ f.umbralMinimo }}</td>
                        <td class="text-right text-base-content/60">
                          {{ f.umbralMaximo || '—' }}
                        </td>
                        <td>
                          <span class="badge {{ clase(f.estado) }}">{{ f.estado }}</span>
                        </td>
                        <td class="text-right">
                          <button
                            class="btn btn-ghost btn-sm rounded-full"
                            (click)="abrir(acopio, f)"
                          >
                            Gestionar
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          }
        </div>
      }
    </div>

    <dialog class="modal" [class.modal-open]="!!sel()">
      <div class="modal-box">
        @if (sel(); as s) {
          <h3 class="text-lg font-bold">{{ s.fila.cultivoNombre }} · {{ s.acopioNombre }}</h3>
          <p class="mt-1 text-sm text-base-content/60">
            Stock actual: <b>{{ s.fila.cantidadActual }} t</b>
          </p>

          <section class="mt-4 rounded-field border border-base-300 p-4">
            <h4 class="text-sm font-semibold">Umbrales de alerta</h4>
            <div class="mt-3 flex flex-wrap items-end gap-3">
              <label class="form-control">
                <span class="label-text mb-1">Mínimo (t)</span>
                <input
                  type="number"
                  min="0"
                  class="input input-bordered input-sm w-28"
                  [(ngModel)]="umbralMin"
                />
              </label>
              <label class="form-control">
                <span class="label-text mb-1">Máximo (t)</span>
                <input
                  type="number"
                  min="0"
                  class="input input-bordered input-sm w-28"
                  [(ngModel)]="umbralMax"
                />
              </label>
              <button
                class="btn btn-primary btn-sm rounded-full"
                [disabled]="umbralMin() > umbralMax() || guardando()"
                (click)="guardarUmbrales(s)"
              >
                Guardar
              </button>
            </div>
          </section>

          <section class="mt-4 rounded-field border border-base-300 p-4">
            <h4 class="text-sm font-semibold">Ajuste manual</h4>
            <p class="mt-1 text-xs text-base-content/50">
              Positivo = entra grano · negativo = salida hacia la comercializadora.
            </p>
            <div class="mt-3 space-y-2">
              <input
                type="number"
                step="0.5"
                placeholder="Toneladas (± )"
                class="input input-bordered input-sm w-40"
                [(ngModel)]="delta"
              />
              <input
                type="text"
                placeholder="Motivo"
                class="input input-bordered input-sm w-full"
                [(ngModel)]="motivo"
              />
              <button
                class="btn btn-sm rounded-full"
                [disabled]="!delta() || motivo().trim().length < 3 || guardando()"
                (click)="aplicarAjuste(s)"
              >
                Aplicar ajuste
              </button>
            </div>
          </section>

          <div class="modal-action">
            <button class="btn btn-ghost" (click)="cerrar()">Cerrar</button>
          </div>
        }
      </div>
      <form method="dialog" class="modal-backdrop" (submit)="cerrar()">
        <button>close</button>
      </form>
    </dialog>
  `,
})
export class InventarioComponent implements OnInit {
  private readonly service = inject(InventarioService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly zona = zonaLabel;
  protected readonly cargando = signal(true);
  protected readonly tablero = signal<InventarioAcopio[]>([]);
  protected readonly guardando = signal(false);

  protected readonly sel = signal<FilaSel | null>(null);
  protected readonly umbralMin = signal(0);
  protected readonly umbralMax = signal(0);
  protected readonly delta = signal<number | null>(null);
  protected readonly motivo = signal('');

  ngOnInit(): void {
    this.recargar();
  }

  protected clase(e: EstadoStock): string {
    return CLASE_ESTADO[e];
  }

  private recargar(): void {
    this.cargando.set(true);
    this.service.obtener().subscribe({
      next: (t) => {
        this.tablero.set(t);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  abrir(acopio: InventarioAcopio, fila: StockCultivo): void {
    this.sel.set({ acopioId: acopio.acopioId, acopioNombre: acopio.acopioNombre, fila });
    this.umbralMin.set(fila.umbralMinimo);
    this.umbralMax.set(fila.umbralMaximo);
    this.delta.set(null);
    this.motivo.set('');
  }

  cerrar(): void {
    this.sel.set(null);
  }

  guardarUmbrales(s: FilaSel): void {
    this.guardando.set(true);
    this.service
      .fijarUmbrales(s.acopioId, s.fila.cultivo, {
        umbralMinimo: this.umbralMin(),
        umbralMaximo: this.umbralMax(),
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.feedback.success('Umbrales guardados');
          this.cerrar();
          this.recargar();
        },
        error: (err) => {
          this.guardando.set(false);
          this.feedback.error(apiMessage(err, 'No se pudieron guardar los umbrales'));
        },
      });
  }

  aplicarAjuste(s: FilaSel): void {
    const d = this.delta();
    if (!d || this.motivo().trim().length < 3) return;
    this.guardando.set(true);
    this.service
      .ajustar(s.acopioId, s.fila.cultivo, { delta: d, motivo: this.motivo().trim() })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.feedback.success('Ajuste aplicado');
          this.cerrar();
          this.recargar();
        },
        error: (err) => {
          this.guardando.set(false);
          this.feedback.error(apiMessage(err, 'No se pudo aplicar el ajuste'));
        },
      });
  }
}
