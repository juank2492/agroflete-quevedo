import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type ValidationErrors,
} from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { apiMessage } from '../core/http-error';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { PasswordFieldComponent } from './password-field.component';

const TELEFONO = /^(09\d{8}|\+5939\d{8})$/;
const PASS = /^(?=.*[A-Z])(?=.*\d).+$/;

/** Valida que `passwordNueva` y `passwordConfirmar` coincidan. */
function clavesCoinciden(g: AbstractControl): ValidationErrors | null {
  const nueva = g.get('passwordNueva')?.value;
  const confirmar = g.get('passwordConfirmar')?.value;
  return nueva && confirmar && nueva !== confirmar ? { noCoincide: true } : null;
}

@Component({
  selector: 'app-perfil',
  imports: [ReactiveFormsModule, PasswordFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-lg">
      <h1 class="text-2xl font-bold">Mi perfil</h1>

      <section class="mt-6 rounded-box bg-base-100 p-5 shadow-card">
        <h2 class="font-semibold">Datos personales</h2>
        <form [formGroup]="datos" (ngSubmit)="guardarDatos()" class="mt-4 space-y-4">
          <label class="form-control w-full">
            <span class="label-text mb-1">Nombre completo</span>
            <input
              formControlName="nombreCompleto"
              class="input input-bordered w-full"
              [class.input-error]="malo(datos.get('nombreCompleto'))"
            />
            @if (malo(datos.get('nombreCompleto'))) {
              <span class="mt-1 text-xs text-error">Mínimo 3 caracteres</span>
            }
          </label>

          <label class="form-control w-full">
            <span class="label-text mb-1">Celular</span>
            <input
              formControlName="telefono"
              inputmode="tel"
              class="input input-bordered w-full"
              [class.input-error]="malo(datos.get('telefono'))"
            />
            @if (malo(datos.get('telefono'))) {
              <span class="mt-1 text-xs text-error">Formato 09XXXXXXXX o +5939XXXXXXXX</span>
            }
          </label>

          <div class="grid grid-cols-2 gap-3 text-sm text-base-content/60">
            <div>
              <div class="label-text mb-1">Correo</div>
              <div class="truncate">{{ perfil()?.email }}</div>
            </div>
            <div>
              <div class="label-text mb-1">Rol</div>
              <div class="capitalize">{{ perfil()?.rol }}</div>
            </div>
          </div>

          <button
            type="submit"
            class="btn btn-primary rounded-full"
            [disabled]="datos.pristine || guardando()"
          >
            @if (guardando()) {
              <span class="loading loading-spinner loading-sm"></span>
            }
            Guardar cambios
          </button>
        </form>
      </section>

      <section class="mt-6 rounded-box bg-base-100 p-5 shadow-card">
        <h2 class="font-semibold">Cambiar contraseña</h2>
        <form [formGroup]="clave" (ngSubmit)="guardarClave()" class="mt-4 space-y-4">
          <app-password-field
            [control]="clave.controls.passwordActual"
            label="Contraseña actual"
            autocomplete="current-password"
          />
          <app-password-field
            [control]="clave.controls.passwordNueva"
            label="Nueva contraseña"
            autocomplete="new-password"
            error="Mínimo 8 caracteres, con una mayúscula y un número"
          />
          <div>
            <app-password-field
              [control]="clave.controls.passwordConfirmar"
              label="Repite la nueva contraseña"
              autocomplete="new-password"
            />
            @if (clave.hasError('noCoincide') && clave.controls.passwordConfirmar.touched) {
              <span class="mt-1 block text-xs text-error">Las contraseñas no coinciden</span>
            }
          </div>

          <div class="pt-2">
            <button
              type="submit"
              class="btn btn-primary rounded-full"
              [disabled]="clave.invalid || cambiando()"
            >
              @if (cambiando()) {
                <span class="loading loading-spinner loading-sm"></span>
              }
              Cambiar contraseña
            </button>
          </div>
        </form>
      </section>
    </div>
  `,
})
export class PerfilComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly perfil = this.auth.perfil;
  protected readonly guardando = signal(false);
  protected readonly cambiando = signal(false);

  protected readonly datos = this.fb.nonNullable.group({
    nombreCompleto: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    telefono: ['', [Validators.required, Validators.pattern(TELEFONO)]],
  });

  protected readonly clave = this.fb.nonNullable.group(
    {
      passwordActual: ['', [Validators.required]],
      passwordNueva: ['', [Validators.required, Validators.minLength(8), Validators.pattern(PASS)]],
      passwordConfirmar: ['', [Validators.required]],
    },
    { validators: clavesCoinciden },
  );

  ngOnInit(): void {
    this.auth.cargarPerfil().subscribe({
      next: (p) => this.datos.reset({ nombreCompleto: p.nombreCompleto, telefono: p.telefono }),
      error: (err) => this.feedback.error(apiMessage(err, 'No se pudo cargar el perfil')),
    });
  }

  protected malo(c: AbstractControl | null): boolean {
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  guardarDatos(): void {
    if (this.datos.invalid) {
      this.datos.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.auth.actualizarPerfil(this.datos.getRawValue()).subscribe({
      next: () => {
        this.guardando.set(false);
        this.datos.markAsPristine();
        this.feedback.success('Perfil actualizado');
      },
      error: (err) => {
        this.guardando.set(false);
        this.feedback.error(apiMessage(err, 'No se pudo actualizar el perfil'));
      },
    });
  }

  guardarClave(): void {
    if (this.clave.invalid) {
      this.clave.markAllAsTouched();
      return;
    }
    this.cambiando.set(true);
    const { passwordActual, passwordNueva } = this.clave.getRawValue();
    this.auth.cambiarPassword({ passwordActual, passwordNueva }).subscribe({
      next: () => {
        this.cambiando.set(false);
        this.clave.reset();
        this.feedback.success('Contraseña cambiada');
      },
      error: (err) => {
        this.cambiando.set(false);
        this.feedback.error(apiMessage(err, 'No se pudo cambiar la contraseña'));
      },
    });
  }
}
