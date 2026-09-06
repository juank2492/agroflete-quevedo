import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { apiMessage } from '../core/http-error';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-confirmar',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-bold">Confirmar correo</h1>
    <p class="mt-1 text-sm text-base-content/70">Escribe el código de 6 dígitos que te enviamos.</p>
    @if (!production) {
      <p class="mt-2 text-xs text-base-content/50">
        En local, el correo llega a Mailpit: <span class="font-mono">localhost:8025</span>
      </p>
    }

    @if (serverError()) {
      <div class="alert alert-error mt-4 text-sm">{{ serverError() }}</div>
    }

    <form [formGroup]="form" (ngSubmit)="enviar()" class="mt-6 space-y-4">
      <label class="form-control w-full">
        <span class="label-text mb-1">Correo</span>
        <input
          type="email"
          formControlName="email"
          class="input input-bordered w-full"
          [class.input-error]="invalido('email')"
        />
      </label>

      <label class="form-control w-full">
        <span class="label-text mb-1">Código</span>
        <input
          formControlName="codigo"
          inputmode="numeric"
          maxlength="6"
          class="input input-bordered w-full tracking-[0.5em]"
          [class.input-error]="invalido('codigo')"
        />
        @if (invalido('codigo')) {
          <span class="mt-1 text-xs text-error">Son 6 dígitos</span>
        }
      </label>

      <button type="submit" class="btn btn-primary btn-block rounded-full" [disabled]="cargando()">
        @if (cargando()) {
          <span class="loading loading-spinner loading-sm"></span>
        }
        Confirmar
      </button>
    </form>

    <p class="mt-4 text-center text-sm text-base-content/70">
      <a routerLink="/auth/login" class="link link-primary">Volver a iniciar sesión</a>
    </p>
  `,
})
export class ConfirmarComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly production = environment.production;
  protected readonly cargando = signal(false);
  protected readonly serverError = signal('');

  /** Prellenado desde ?email= (withComponentInputBinding). */
  @Input() email?: string;

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  ngOnInit(): void {
    if (this.email) this.form.controls.email.setValue(this.email);
  }

  protected invalido(campo: 'email' | 'codigo'): boolean {
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
    this.auth.confirmar(this.form.getRawValue()).subscribe({
      next: () => {
        this.feedback.success('Cuenta confirmada. Ya puedes iniciar sesión.');
        void this.router.navigate(['/auth/login']);
      },
      error: (err) => {
        this.cargando.set(false);
        this.serverError.set(apiMessage(err, 'No se pudo confirmar el código'));
      },
    });
  }
}
