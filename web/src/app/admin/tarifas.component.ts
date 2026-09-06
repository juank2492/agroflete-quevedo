import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
} from '@angular/forms';
import type { ActualizarReglasRequest, Cultivo, ReglasTarifa } from '@agroflete/shared';
import { IconComponent } from '../core/icon.component';
import { TarifaService } from '../core/tarifa.service';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { apiMessage } from '../core/http-error';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function iniLteFin(group: AbstractControl): { rango: true } | null {
  const ini = group.get('ini')?.value as number;
  const fin = group.get('fin')?.value as number;
  return ini <= fin ? null : { rango: true };
}

@Component({
  selector: 'app-admin-tarifas',
  imports: [ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-3xl">
      <h1 class="text-2xl font-bold">Reglas de tarifa</h1>
      <p class="mt-1 text-sm text-base-content/70">
        Parámetros del cálculo automático: tarifa = base/km × distancia vial × factor del cultivo ×
        (1 + recargo si es temporada de cosecha).
      </p>

      @if (cargandoInicial()) {
        <div class="mt-6 h-64 animate-pulse rounded-box bg-base-300"></div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="guardar()" class="mt-6 space-y-6">
          <div class="rounded-box bg-base-100 p-5 shadow-card">
            <div class="grid gap-4 sm:grid-cols-2">
              @for (n of numericos; track n.key) {
                <label class="form-control w-full">
                  <span class="label-text mb-1">{{ n.label }}</span>
                  <input
                    type="number"
                    [formControlName]="n.key"
                    [step]="n.step"
                    class="input input-bordered w-full"
                    [class.input-error]="invalido(n.key)"
                  />
                  <span class="mt-1 text-xs text-base-content/50">{{ n.hint }}</span>
                </label>
              }
            </div>
          </div>

          @for (c of cultivos; track c.key) {
            <div class="rounded-box bg-base-100 p-5 shadow-card">
              <div class="flex items-center justify-between">
                <h2 class="font-semibold">Temporada de cosecha — {{ c.label }}</h2>
                <button type="button" class="btn btn-ghost btn-sm" (click)="agregarRango(c.key)">
                  <app-icon name="plus" [size]="16" /> Rango
                </button>
              </div>
              <div class="mt-3 space-y-2" [formArrayName]="c.key">
                @for (grupo of arreglo(c.key).controls; track $index) {
                  <div class="flex items-center gap-2" [formGroupName]="$index">
                    <select formControlName="ini" class="select select-bordered select-sm">
                      @for (m of meses; track $index) {
                        <option [value]="$index + 1">{{ m }}</option>
                      }
                    </select>
                    <span class="text-sm text-base-content/50">a</span>
                    <select formControlName="fin" class="select select-bordered select-sm">
                      @for (m of meses; track $index) {
                        <option [value]="$index + 1">{{ m }}</option>
                      }
                    </select>
                    @if (grupo.errors?.['rango']) {
                      <span class="text-xs text-error">rango inválido</span>
                    }
                    <button
                      type="button"
                      class="btn btn-ghost btn-square btn-sm ml-auto"
                      (click)="quitarRango(c.key, $index)"
                      aria-label="Quitar"
                    >
                      <app-icon name="minus" [size]="16" />
                    </button>
                  </div>
                } @empty {
                  <p class="text-sm text-base-content/50">Sin rangos: nunca aplica recargo.</p>
                }
              </div>
            </div>
          }

          <div class="flex items-center gap-3">
            <button
              type="submit"
              class="btn btn-primary rounded-full"
              [disabled]="guardando() || form.invalid"
            >
              @if (guardando()) {
                <span class="loading loading-spinner loading-sm"></span>
              }
              Guardar reglas
            </button>
            <button type="button" class="btn btn-ghost" (click)="recargar()">
              Descartar cambios
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class TarifasComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tarifa = inject(TarifaService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly meses = MESES;
  protected readonly cargandoInicial = signal(true);
  protected readonly guardando = signal(false);

  protected readonly numericos = [
    { key: 'tarifaBaseKm', label: 'Tarifa base por km (USD)', step: 0.05, hint: '> 0' },
    { key: 'factorMaiz', label: 'Factor maíz', step: 0.05, hint: '0.5 – 3' },
    { key: 'factorBanano', label: 'Factor banano', step: 0.05, hint: '0.5 – 3' },
    {
      key: 'recargoTemporada',
      label: 'Recargo de temporada',
      step: 0.05,
      hint: '0 – 1 (0.2 = +20%)',
    },
    { key: 'factorSinuosidad', label: 'Factor de sinuosidad vial', step: 0.05, hint: '1 – 2' },
  ] as const;

  protected readonly cultivos: Array<{ key: 'maiz' | 'banano'; label: string }> = [
    { key: 'maiz', label: 'Maíz' },
    { key: 'banano', label: 'Banano' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    tarifaBaseKm: [0.9, [Validators.required, Validators.min(0.01), Validators.max(50)]],
    factorMaiz: [1, [Validators.required, Validators.min(0.5), Validators.max(3)]],
    factorBanano: [1.15, [Validators.required, Validators.min(0.5), Validators.max(3)]],
    recargoTemporada: [0.2, [Validators.required, Validators.min(0), Validators.max(1)]],
    factorSinuosidad: [1.3, [Validators.required, Validators.min(1), Validators.max(2)]],
    maiz: this.fb.array<FormGroup>([]),
    banano: this.fb.array<FormGroup>([]),
  });

  ngOnInit(): void {
    this.recargar();
  }

  protected arreglo(cultivo: Cultivo): FormArray<FormGroup> {
    return this.form.get(cultivo) as FormArray<FormGroup>;
  }

  private rangos(cultivo: Cultivo): [number, number][] {
    return this.arreglo(cultivo).controls.map((g): [number, number] => [
      Number(g.value.ini),
      Number(g.value.fin),
    ]);
  }

  protected invalido(key: string): boolean {
    const c = this.form.get(key);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  private nuevoRango(ini = 1, fin = 3): FormGroup {
    return this.fb.group(
      {
        ini: [ini, [Validators.required, Validators.min(1), Validators.max(12)]],
        fin: [fin, [Validators.required, Validators.min(1), Validators.max(12)]],
      },
      { validators: iniLteFin },
    );
  }

  protected agregarRango(cultivo: Cultivo): void {
    this.arreglo(cultivo).push(this.nuevoRango());
  }

  protected quitarRango(cultivo: Cultivo, i: number): void {
    this.arreglo(cultivo).removeAt(i);
  }

  recargar(): void {
    this.cargandoInicial.set(true);
    this.tarifa.obtenerReglas().subscribe({
      next: (r) => {
        this.aplicar(r);
        this.cargandoInicial.set(false);
      },
      error: () => this.cargandoInicial.set(false),
    });
  }

  private aplicar(r: ReglasTarifa): void {
    this.form.patchValue({
      tarifaBaseKm: r.tarifaBaseKm,
      factorMaiz: r.factorMaiz,
      factorBanano: r.factorBanano,
      recargoTemporada: r.recargoTemporada,
      factorSinuosidad: r.factorSinuosidad,
    });
    for (const c of this.cultivos) {
      const arr = this.arreglo(c.key);
      arr.clear();
      for (const [ini, fin] of r.temporadas[c.key]) arr.push(this.nuevoRango(ini, fin));
    }
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: ActualizarReglasRequest = {
      tarifaBaseKm: v.tarifaBaseKm,
      factorMaiz: v.factorMaiz,
      factorBanano: v.factorBanano,
      recargoTemporada: v.recargoTemporada,
      factorSinuosidad: v.factorSinuosidad,
      temporadas: {
        maiz: this.rangos('maiz'),
        banano: this.rangos('banano'),
      },
    };

    this.guardando.set(true);
    this.tarifa.actualizarReglas(payload).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.aplicar(r);
        this.feedback.success('Reglas de tarifa guardadas');
      },
      error: (err) => {
        this.guardando.set(false);
        this.feedback.error(apiMessage(err, 'No se pudieron guardar las reglas'));
      },
    });
  }
}
