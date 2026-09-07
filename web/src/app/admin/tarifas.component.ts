import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
} from '@angular/forms';
import {
  claveDesdeNombre,
  type ActualizarReglasRequest,
  type CultivoTarifa,
  type ReglasTarifa,
} from '@agroflete/shared';
import { IconComponent } from '../core/icon.component';
import { TarifaService } from '../core/tarifa.service';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { apiMessage } from '../core/http-error';
import { ConfirmService } from '../shared/confirm.service';
import type { PuedeDesactivar } from '../shared/unsaved-changes.guard';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const TIP_NOMBRE = 'Nombre visible en el selector del productor y en las solicitudes.';
const TIP_FACTOR =
  'Multiplicador de la tarifa para este cultivo. 1 = tarifa base; 1.15 = 15% más caro (carga más voluminosa o delicada).';

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
        tarifa = base/km × distancia vial × factor del cultivo × (1 + recargo si es temporada de
        cosecha).
      </p>

      @if (cargandoInicial()) {
        <div class="mt-6 h-64 animate-pulse rounded-box bg-base-300"></div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="guardar()" class="mt-6 space-y-6">
          <div class="rounded-box bg-base-100 p-5 shadow-card">
            <div class="grid gap-4 sm:grid-cols-3">
              @for (n of numericos; track n.key) {
                <label class="form-control w-full">
                  <span class="label-text mb-1 flex items-center gap-1.5">
                    {{ n.label }}
                    <span
                      class="cursor-help text-base-content/40 hover:text-base-content/70"
                      [title]="n.tip"
                      [attr.aria-label]="n.tip"
                    >
                      <app-icon name="help" [size]="14" />
                    </span>
                  </span>
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

          <div class="flex items-center justify-between">
            <h2 class="font-semibold">Catálogo de cultivos</h2>
            <button type="button" class="btn btn-sm rounded-full" (click)="agregarCultivo()">
              <app-icon name="plus" [size]="16" /> Cultivo
            </button>
          </div>

          <div formArrayName="cultivos" class="space-y-4">
            @for (cg of cultivos.controls; track cg; let ci = $index) {
              <div
                class="rounded-box bg-base-100 p-5 shadow-card"
                [class.opacity-60]="cg.get('activo')?.value === false"
                [formGroupName]="ci"
              >
                @if (!persistido(cg)) {
                  <p class="mb-3 text-xs font-medium text-primary">
                    Nuevo cultivo — completa los datos
                  </p>
                }
                <div class="grid gap-3 sm:grid-cols-2">
                  <label class="form-control w-full">
                    <span class="label-text mb-1 flex items-center gap-1.5">
                      Nombre
                      <span
                        class="cursor-help text-base-content/40 hover:text-base-content/70"
                        [title]="tipNombre"
                        [attr.aria-label]="tipNombre"
                      >
                        <app-icon name="help" [size]="14" />
                      </span>
                    </span>
                    <input
                      formControlName="nombre"
                      class="input input-bordered w-full"
                      [class.input-error]="ctrlMalo(cg, 'nombre')"
                      (input)="sincronizarClave(ci)"
                    />
                  </label>
                  <label class="form-control w-full">
                    <span class="label-text mb-1 flex items-center gap-1.5">
                      Factor de tarifa
                      <span
                        class="cursor-help text-base-content/40 hover:text-base-content/70"
                        [title]="tipFactor"
                        [attr.aria-label]="tipFactor"
                      >
                        <app-icon name="help" [size]="14" />
                      </span>
                    </span>
                    <input
                      type="number"
                      step="0.05"
                      formControlName="factor"
                      class="input input-bordered w-full"
                      [class.input-error]="ctrlMalo(cg, 'factor')"
                    />
                    <span class="mt-1 text-xs text-base-content/50">0.5 – 3</span>
                  </label>
                </div>

                <details
                  class="collapse-arrow collapse mt-4 border border-base-300"
                  [open]="temporadas(ci).invalid"
                >
                  <summary class="collapse-title min-h-0 px-4 py-2 text-sm font-medium">
                    Temporada de cosecha · {{ temporadas(ci).length }} rango(s)
                  </summary>
                  <div class="collapse-content" formArrayName="temporadas">
                    <div class="flex justify-end pb-2">
                      <button type="button" class="btn btn-ghost btn-sm" (click)="agregarRango(ci)">
                        <app-icon name="plus" [size]="16" /> Rango
                      </button>
                    </div>
                    @for (rg of temporadas(ci).controls; track rg; let ri = $index) {
                      <div class="flex items-center gap-2 py-1" [formGroupName]="ri">
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
                        @if (rg.errors?.['rango']) {
                          <span class="text-xs text-error">rango inválido</span>
                        }
                        <button
                          type="button"
                          class="btn btn-square btn-ghost btn-sm ml-auto shrink-0 text-error"
                          (click)="quitarRango(ci, ri)"
                          aria-label="Quitar rango"
                        >
                          <app-icon name="trash" [size]="16" />
                        </button>
                      </div>
                    } @empty {
                      <p class="text-sm text-base-content/50">Sin rangos: nunca aplica recargo.</p>
                    }
                  </div>
                </details>

                <div class="mt-4 flex items-center justify-end gap-4">
                  @if (persistido(cg)) {
                    <label class="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        class="toggle toggle-success"
                        formControlName="activo"
                      />
                      {{ cg.get('activo')?.value === false ? 'Inactivo' : 'Activo' }}
                    </label>
                  } @else {
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm text-error"
                      (click)="quitarCultivoNuevo(ci)"
                      aria-label="Descartar cultivo"
                    >
                      <app-icon name="trash" [size]="16" /> Descartar
                    </button>
                  }
                </div>
                @if (persistido(cg) && cg.get('activo')?.value === false) {
                  <p class="mt-1 text-right text-xs text-base-content/50">
                    No aparece para nuevos fletes; las solicitudes ya creadas no se tocan.
                  </p>
                }
              </div>
            }
          </div>

          <div class="flex items-center gap-3">
            <button
              type="submit"
              class="btn btn-primary rounded-full"
              [disabled]="guardando() || form.invalid || form.pristine"
            >
              @if (guardando()) {
                <span class="loading loading-spinner loading-sm"></span>
              }
              Guardar reglas
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              [disabled]="form.pristine || guardando()"
              (click)="descartar()"
            >
              Descartar cambios
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class TarifasComponent implements OnInit, PuedeDesactivar {
  private readonly fb = inject(FormBuilder);
  private readonly tarifa = inject(TarifaService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly confirmar = inject(ConfirmService);

  private readonly persistidos = new WeakSet<AbstractControl>();

  protected readonly meses = MESES;
  protected readonly tipNombre = TIP_NOMBRE;
  protected readonly tipFactor = TIP_FACTOR;
  protected readonly cargandoInicial = signal(true);
  protected readonly guardando = signal(false);

  protected readonly numericos = [
    {
      key: 'tarifaBaseKm',
      label: 'Tarifa base por km (USD)',
      step: 0.05,
      hint: '> 0',
      tip: 'Precio por kilómetro de carretera antes de aplicar el factor del cultivo. Es el ancla de toda la tarifa.',
    },
    {
      key: 'recargoTemporada',
      label: 'Recargo de temporada',
      step: 0.05,
      hint: '0 – 1 (0.2 = +20%)',
      tip: 'Sobreprecio que se suma cuando el mes de la solicitud cae dentro de la temporada de cosecha del cultivo. 0.2 = +20%.',
    },
    {
      key: 'factorSinuosidad',
      label: 'Factor de sinuosidad vial',
      step: 0.05,
      hint: '1 – 2',
      tip: 'Las carreteras no van en línea recta. Multiplica la distancia geodésica (Haversine) por este número para aproximar los kilómetros reales de ruta. ~1.3 para la zona de Quevedo.',
    },
  ] as const;

  protected readonly form = this.fb.nonNullable.group({
    tarifaBaseKm: [0.9, [Validators.required, Validators.min(0.01), Validators.max(50)]],
    recargoTemporada: [0.2, [Validators.required, Validators.min(0), Validators.max(1)]],
    factorSinuosidad: [1.3, [Validators.required, Validators.min(1), Validators.max(2)]],
    cultivos: this.fb.array<FormGroup>([]),
  });

  protected get cultivos(): FormArray<FormGroup> {
    return this.form.controls.cultivos;
  }

  protected temporadas(ci: number): FormArray<FormGroup> {
    return this.cultivos.at(ci).get('temporadas') as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    this.recargar();
  }

  hayCambiosSinGuardar(): boolean {
    return this.form.dirty && !this.guardando();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected antesDeSalir(e: BeforeUnloadEvent): void {
    if (this.hayCambiosSinGuardar()) e.preventDefault();
  }

  protected invalido(key: string): boolean {
    const c = this.form.get(key);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  protected ctrlMalo(group: AbstractControl, campo: string): boolean {
    const c = group.get(campo);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  protected persistido(cg: AbstractControl): boolean {
    return this.persistidos.has(cg);
  }

  protected sincronizarClave(ci: number): void {
    const grupo = this.cultivos.at(ci);
    grupo.get('clave')?.setValue(claveDesdeNombre(grupo.get('nombre')?.value ?? ''));
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

  private nuevoCultivo(c?: CultivoTarifa): FormGroup {
    return this.fb.group({
      clave: [c?.clave ?? '', [Validators.required, Validators.pattern(/^[a-z0-9-]{2,32}$/)]],
      nombre: [
        c?.nombre ?? '',
        [Validators.required, Validators.minLength(2), Validators.maxLength(40)],
      ],
      factor: [c?.factor ?? 1, [Validators.required, Validators.min(0.5), Validators.max(3)]],
      activo: [c?.activo ?? true],
      temporadas: this.fb.array<FormGroup>(
        (c?.temporadas ?? []).map(([ini, fin]) => this.nuevoRango(ini, fin)),
      ),
    });
  }

  protected agregarCultivo(): void {
    this.cultivos.insert(0, this.nuevoCultivo());
    this.form.markAsDirty();
  }

  /** Solo se descartan cultivos no guardados. */
  protected quitarCultivoNuevo(ci: number): void {
    this.cultivos.removeAt(ci);
    this.form.markAsDirty();
  }

  protected agregarRango(ci: number): void {
    this.temporadas(ci).push(this.nuevoRango());
    this.form.markAsDirty();
  }

  protected async quitarRango(ci: number, ri: number): Promise<void> {
    const ok = await this.confirmar.ask({
      titulo: 'Quitar rango',
      mensaje: '¿Quitar este rango de temporada de cosecha?',
      confirmar: 'Quitar',
      peligro: true,
    });
    if (!ok) return;
    this.temporadas(ci).removeAt(ri);
    this.form.markAsDirty();
  }

  async descartar(): Promise<void> {
    if (this.form.pristine) return;
    const ok = await this.confirmar.ask({
      titulo: 'Descartar cambios',
      mensaje: 'Se perderán los cambios que no has guardado.',
      confirmar: 'Descartar',
      cancelar: 'Seguir editando',
      peligro: true,
    });
    if (ok) this.recargar();
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
      recargoTemporada: r.recargoTemporada,
      factorSinuosidad: r.factorSinuosidad,
    });
    this.cultivos.clear();
    for (const c of r.cultivos) {
      const grupo = this.nuevoCultivo(c);
      this.persistidos.add(grupo);
      this.cultivos.push(grupo);
    }
    this.form.markAsPristine();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const cultivos = this.cultivos.controls.map((cg): CultivoTarifa => {
      const raw = cg.getRawValue() as {
        clave: string;
        nombre: string;
        factor: number;
        activo: boolean;
        temporadas: { ini: number; fin: number }[];
      };
      return {
        clave: raw.clave,
        nombre: raw.nombre,
        factor: Number(raw.factor),
        activo: raw.activo,
        temporadas: raw.temporadas.map((t): [number, number] => [Number(t.ini), Number(t.fin)]),
      };
    });

    const payload: ActualizarReglasRequest = {
      tarifaBaseKm: v.tarifaBaseKm,
      recargoTemporada: v.recargoTemporada,
      factorSinuosidad: v.factorSinuosidad,
      cultivos,
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
