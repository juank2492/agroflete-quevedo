import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TIPOS_VEHICULO, ZONAS, type Vehiculo } from '@agroflete/shared';
import { IconComponent } from '../core/icon.component';
import { VehiculoService } from '../core/vehiculo.service';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { apiMessage } from '../core/http-error';
import { EstadoBadgeComponent } from '../shared/estado-badge.component';
import { zonaLabel } from '../shared/zona';

const PLACA = /^[A-Z]{3}-?\d{3,4}$/;

@Component({
  selector: 'app-mi-vehiculo',
  imports: [ReactiveFormsModule, TitleCasePipe, IconComponent, EstadoBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl">
      <h1 class="text-2xl font-bold">Mis vehículos</h1>

      @if (cargando()) {
        <div class="mt-6 space-y-3">
          @for (i of [1, 2]; track i) {
            <div class="h-24 animate-pulse rounded-box bg-base-300"></div>
          }
        </div>
      } @else {
        <ul class="mt-6 space-y-3">
          @for (v of vehiculos(); track v.id) {
            <li class="rounded-box border border-base-300 bg-base-100 p-4 shadow-card">
              <div class="flex items-center justify-between">
                <span class="font-display text-lg font-bold">{{ v.placa }}</span>
                <app-estado-badge [estado]="v.estado" />
              </div>
              <div class="mt-1 text-sm text-base-content/70">
                {{ v.tipo | titlecase }} · {{ v.capacidadTon }} t · {{ label(v.zona) }}
              </div>
              <div class="mt-3">
                @if (v.estado === 'OCUPADO') {
                  <span class="text-xs text-base-content/50">Asignado a un flete en curso.</span>
                } @else {
                  <button
                    class="btn btn-sm"
                    [class.btn-primary]="v.estado === 'INACTIVO'"
                    [class.btn-ghost]="v.estado === 'DISPONIBLE'"
                    [disabled]="guardandoId() === v.id"
                    (click)="alternar(v)"
                  >
                    {{ v.estado === 'DISPONIBLE' ? 'Marcar inactivo' : 'Marcar disponible' }}
                  </button>
                }
              </div>
            </li>
          } @empty {
            <li class="rounded-box bg-base-100 p-6 text-center text-base-content/70 shadow-card">
              Aún no registras vehículos.
            </li>
          }
        </ul>

        <div class="mt-8 rounded-box bg-base-100 p-5 shadow-card">
          <h2 class="font-semibold">Registrar un vehículo</h2>
          <form [formGroup]="form" (ngSubmit)="registrar()" class="mt-4 grid gap-4 sm:grid-cols-2">
            <label class="form-control w-full">
              <span class="label-text mb-1">Placa</span>
              <input
                formControlName="placa"
                placeholder="ABC-1234"
                class="input input-bordered w-full uppercase"
                [class.input-error]="malo('placa')"
              />
            </label>
            <label class="form-control w-full">
              <span class="label-text mb-1">Tipo</span>
              <select formControlName="tipo" class="select select-bordered w-full">
                @for (t of tipos; track t) {
                  <option [value]="t">{{ t | titlecase }}</option>
                }
              </select>
            </label>
            <label class="form-control w-full">
              <span class="label-text mb-1">Capacidad (toneladas)</span>
              <input
                type="number"
                formControlName="capacidadTon"
                step="0.5"
                min="0.5"
                max="40"
                class="input input-bordered w-full"
                [class.input-error]="malo('capacidadTon')"
              />
            </label>
            <label class="form-control w-full">
              <span class="label-text mb-1">Zona</span>
              <select formControlName="zona" class="select select-bordered w-full">
                @for (z of zonas; track z) {
                  <option [value]="z">{{ label(z) }}</option>
                }
              </select>
            </label>
            <div class="sm:col-span-2">
              <button
                type="submit"
                class="btn btn-primary rounded-full"
                [disabled]="enviando() || form.invalid"
              >
                @if (enviando()) {
                  <span class="loading loading-spinner loading-sm"></span>
                }
                <app-icon name="plus" [size]="16" /> Registrar
              </button>
            </div>
          </form>
        </div>
      }
    </div>
  `,
})
export class MiVehiculoComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(VehiculoService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly tipos = TIPOS_VEHICULO;
  protected readonly zonas = ZONAS;
  protected readonly label = zonaLabel;

  protected readonly cargando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly guardandoId = signal<string | null>(null);
  protected readonly vehiculos = signal<Vehiculo[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    placa: ['', [Validators.required, Validators.pattern(PLACA)]],
    tipo: [TIPOS_VEHICULO[0], [Validators.required]],
    capacidadTon: [10, [Validators.required, Validators.min(0.5), Validators.max(40)]],
    zona: [ZONAS[0], [Validators.required]],
  });

  ngOnInit(): void {
    this.recargar();
  }

  protected malo(campo: 'placa' | 'capacidadTon'): boolean {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || c.dirty);
  }

  private recargar(): void {
    this.cargando.set(true);
    this.service.mios().subscribe({
      next: (list) => {
        this.vehiculos.set(list);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  registrar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.service.registrar(this.form.getRawValue()).subscribe({
      next: () => {
        this.enviando.set(false);
        this.feedback.success('Vehículo registrado');
        this.form.reset({
          placa: '',
          tipo: TIPOS_VEHICULO[0],
          capacidadTon: 10,
          zona: ZONAS[0],
        });
        this.recargar();
      },
      error: (err) => {
        this.enviando.set(false);
        this.feedback.error(apiMessage(err, 'No se pudo registrar el vehículo'));
      },
    });
  }

  alternar(v: Vehiculo): void {
    const nuevo: 'DISPONIBLE' | 'INACTIVO' = v.estado === 'DISPONIBLE' ? 'INACTIVO' : 'DISPONIBLE';
    this.guardandoId.set(v.id);
    this.service.actualizar(v.id, { estado: nuevo }).subscribe({
      next: () => {
        this.guardandoId.set(null);
        this.recargar();
      },
      error: (err) => {
        this.guardandoId.set(null);
        this.feedback.error(apiMessage(err, 'No se pudo actualizar'));
      },
    });
  }
}
