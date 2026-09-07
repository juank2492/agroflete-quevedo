import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { apiMessage } from '../core/http-error';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { PasswordFieldComponent } from '../shared/password-field.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, PasswordFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-bold">Iniciar sesión</h1>
    <p class="mt-1 text-sm text-base-content/70">Accede a tu panel de AgroFlete.</p>

    @if (serverError()) {
      <div class="alert alert-error mt-4 text-sm">{{ serverError() }}</div>
    }

    <form [formGroup]="form" (ngSubmit)="enviar()" class="mt-6 space-y-4">
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
          <span class="mt-1 text-xs text-error">Ingresa un correo válido</span>
        }
      </label>

      <app-password-field
        [control]="form.controls.password"
        label="Contraseña"
        autocomplete="current-password"
        error="Requerida"
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
          Entrar
        </button>
      </div>
    </form>

    <p class="mt-4 text-center text-sm text-base-content/70">
      ¿No tienes cuenta?
      <a routerLink="/auth/registro" class="link link-primary">Crear una</a>
    </p>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly cargando = signal(false);
  protected readonly serverError = signal('');

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected invalido(campo: 'email' | 'password'): boolean {
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
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.feedback.success('Sesión iniciada');
        void this.router.navigateByUrl(this.auth.homePath());
      },
      error: (err) => {
        this.cargando.set(false);
        this.serverError.set(apiMessage(err, 'No se pudo iniciar sesión'));
      },
    });
  }
}
