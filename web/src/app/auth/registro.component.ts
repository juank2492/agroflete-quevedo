import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { apiMessage } from '../core/http-error';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { PasswordFieldComponent } from '../shared/password-field.component';

const TELEFONO = /^(09\d{8}|\+5939\d{8})$/;
const PASS = /^(?=.*[A-Z])(?=.*\d).+$/;

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink, PasswordFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-bold">Crear cuenta</h1>
    <p class="mt-1 text-sm text-base-content/70">Para productores.</p>

    @if (serverError()) {
      <div class="alert alert-error mt-4 text-sm">{{ serverError() }}</div>
    }

    <form [formGroup]="form" (ngSubmit)="enviar()" class="mt-6 space-y-4">
      <label class="form-control w-full">
        <span class="label-text mb-1">Nombre completo</span>
        <input
          formControlName="nombreCompleto"
          class="input input-bordered w-full"
          [class.input-error]="invalido('nombreCompleto')"
        />
        @if (invalido('nombreCompleto')) {
          <span class="mt-1 text-xs text-error">Mínimo 3 caracteres</span>
        }
      </label>

      <label class="form-control w-full">
        <span class="label-text mb-1">Correo</span>
        <input
          type="email"
          formControlName="email"
          autocomplete="email"
          class="input input-bordered w-full"
          [class.input-error]="invalido('email')"
        />
        @if (invalido('email')) {
          <span class="mt-1 text-xs text-error">Correo inválido</span>
        }
      </label>

      <label class="form-control w-full">
        <span class="label-text mb-1">Celular</span>
        <input
          formControlName="telefono"
          inputmode="tel"
          placeholder="09XXXXXXXX"
          class="input input-bordered w-full"
          [class.input-error]="invalido('telefono')"
        />
        @if (invalido('telefono')) {
          <span class="mt-1 text-xs text-error">Formato 09XXXXXXXX o +5939XXXXXXXX</span>
        }
      </label>

      <app-password-field
        [control]="form.controls.password"
        label="Contraseña"
        autocomplete="new-password"
        error="Mínimo 8 caracteres, con una mayúscula y un número"
      />

      <div class="pt-2">
        <button
          type="submit"
          class="btn btn-primary btn-block rounded-full"
          [disabled]="cargando()"
        >
          @if (cargando()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          Crear cuenta
        </button>
      </div>
    </form>

    <p class="mt-4 text-center text-sm text-base-content/70">
      ¿Ya tienes cuenta? <a routerLink="/auth/login" class="link link-primary">Inicia sesión</a>
    </p>
  `,
})
export class RegistroComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly cargando = signal(false);
  protected readonly serverError = signal('');

  protected readonly form = this.fb.nonNullable.group({
    nombreCompleto: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.required, Validators.pattern(TELEFONO)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(PASS)]],
  });

  protected invalido(campo: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || c.dirty);
  }

  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.serverError.set('');
    const value = this.form.getRawValue();
    this.auth
      .registrar({
        nombreCompleto: value.nombreCompleto,
        email: value.email,
        telefono: value.telefono,
        password: value.password,
        rol: 'productor',
      })
      .subscribe({
        next: () => {
          this.feedback.success('Cuenta creada. Revisa tu correo para el código.');
          void this.router.navigate(['/auth/confirmar'], { queryParams: { email: value.email } });
        },
        error: (err) => {
          this.cargando.set(false);
          this.serverError.set(apiMessage(err, 'No se pudo crear la cuenta'));
        },
      });
  }
}
