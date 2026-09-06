import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import type { Solicitud, Vehiculo } from '@agroflete/shared';
import { FleteService } from '../core/flete.service';
import { SolicitudService } from '../core/solicitud.service';
import { VehiculoService } from '../core/vehiculo.service';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { apiMessage } from '../core/http-error';
import { zonaLabel } from '../shared/zona';

@Component({
  selector: 'app-cola-solicitudes',
  imports: [DatePipe, DecimalPipe, TitleCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-4xl">
      <h1 class="text-2xl font-bold">Solicitudes pendientes</h1>

      @if (cargando()) {
        <div class="mt-6 h-40 animate-pulse rounded-box bg-base-300"></div>
      } @else if (pendientes().length === 0) {
        <p class="mt-8 rounded-box bg-base-100 p-6 text-center text-base-content/70 shadow-card">
          No hay solicitudes pendientes de asignación.
        </p>
      } @else {
        <div
          class="mt-6 overflow-x-auto rounded-box border border-base-300 bg-base-100 shadow-card"
        >
          <table class="table">
            <thead>
              <tr>
                <th>Carga</th>
                <th>Zona</th>
                <th>Destino</th>
                <th class="text-right">Tarifa</th>
                <th>Publicada</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (s of pendientes(); track s.id) {
                <tr>
                  <td>{{ s.cultivo | titlecase }} · {{ s.pesoTon }} t</td>
                  <td>{{ label(s.zona) }}</td>
                  <td class="max-w-[12rem] truncate">{{ s.acopioNombre }}</td>
                  <td class="text-right font-semibold text-primary">
                    $ {{ s.tarifaEstimada | number: '1.2-2' }}
                  </td>
                  <td class="text-sm text-base-content/60">{{ s.createdAt | date: 'short' }}</td>
                  <td class="text-right">
                    <button class="btn btn-primary btn-sm rounded-full" (click)="abrir(s)">
                      Asignar
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- Diálogo de asignación -->
    <dialog class="modal" [class.modal-open]="!!seleccion()">
      <div class="modal-box">
        @if (seleccion(); as s) {
          <h3 class="text-lg font-bold">Asignar {{ s.cultivo | titlecase }} · {{ s.pesoTon }} t</h3>
          <p class="mt-1 text-sm text-base-content/60">
            {{ label(s.zona) }} → {{ s.acopioNombre }}
          </p>

          @if (cargandoVehiculos()) {
            <div class="mt-4 h-24 animate-pulse rounded bg-base-300"></div>
          } @else if (compatibles().length === 0) {
            <p class="mt-4 text-sm text-warning">
              No hay vehículos disponibles compatibles (zona {{ label(s.zona) }}, ≥
              {{ s.pesoTon }} t).
            </p>
          } @else {
            <div class="mt-4 space-y-2">
              @for (v of compatibles(); track v.id) {
                <label
                  class="flex cursor-pointer items-center gap-3 rounded-field border border-base-300 p-3 hover:border-primary/40"
                  [class.border-primary]="vehiculoId() === v.id"
                >
                  <input
                    type="radio"
                    class="radio radio-primary radio-sm"
                    name="veh"
                    [checked]="vehiculoId() === v.id"
                    (change)="vehiculoId.set(v.id)"
                  />
                  <span class="font-display font-semibold">{{ v.placa }}</span>
                  <span class="text-sm text-base-content/60">
                    {{ v.tipo | titlecase }} · {{ v.capacidadTon }} t
                  </span>
                </label>
              }
            </div>
          }

          <div class="modal-action">
            <button class="btn btn-ghost" (click)="cerrar()">Cancelar</button>
            <button
              class="btn btn-primary rounded-full"
              [disabled]="!vehiculoId() || asignando()"
              (click)="confirmar()"
            >
              @if (asignando()) {
                <span class="loading loading-spinner loading-sm"></span>
              }
              Confirmar asignación
            </button>
          </div>
        }
      </div>
      <form method="dialog" class="modal-backdrop" (submit)="cerrar()">
        <button>close</button>
      </form>
    </dialog>
  `,
})
export class ColaSolicitudesComponent implements OnInit {
  private readonly solicitudes = inject(SolicitudService);
  private readonly vehiculos = inject(VehiculoService);
  private readonly fletes = inject(FleteService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly label = zonaLabel;

  protected readonly cargando = signal(true);
  protected readonly pendientes = signal<Solicitud[]>([]);

  protected readonly seleccion = signal<Solicitud | null>(null);
  protected readonly compatibles = signal<Vehiculo[]>([]);
  protected readonly cargandoVehiculos = signal(false);
  protected readonly vehiculoId = signal<string | null>(null);
  protected readonly asignando = signal(false);

  ngOnInit(): void {
    this.recargar();
  }

  private recargar(): void {
    this.cargando.set(true);
    this.solicitudes.listar('PENDIENTE').subscribe({
      next: (list) => {
        this.pendientes.set(list);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  abrir(s: Solicitud): void {
    this.seleccion.set(s);
    this.vehiculoId.set(null);
    this.compatibles.set([]);
    this.cargandoVehiculos.set(true);
    this.vehiculos.compatibles(s.id).subscribe({
      next: (list) => {
        this.compatibles.set(list);
        this.cargandoVehiculos.set(false);
      },
      error: () => this.cargandoVehiculos.set(false),
    });
  }

  cerrar(): void {
    this.seleccion.set(null);
  }

  confirmar(): void {
    const s = this.seleccion();
    const vId = this.vehiculoId();
    if (!s || !vId) return;
    this.asignando.set(true);
    this.fletes.asignar({ solicitudId: s.id, vehiculoId: vId }).subscribe({
      next: () => {
        this.asignando.set(false);
        this.feedback.success('Flete asignado');
        this.cerrar();
        this.recargar();
      },
      error: (err) => {
        this.asignando.set(false);
        this.feedback.error(apiMessage(err, 'No se pudo asignar el flete'));
      },
    });
  }
}
