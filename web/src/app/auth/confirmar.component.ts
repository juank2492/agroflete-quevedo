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

      <div class="form-control w-full">
        <span class="label-text mb-1">Código</span>
        <div class="flex gap-2" (paste)="pegar($event)">
          @for (i of celdasIdx; track i) {
            <input
              [id]="'cod-' + i"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="1"
              class="input input-bordered h-14 w-full p-0 text-center font-mono text-2xl"
              [class.input-error]="invalido('codigo')"
              [value]="celdas()[i]"
              (input)="escribir(i, $any($event.target).value)"
              (keydown)="tecla(i, $event)"
              (focus)="$any($event.target).select()"
            />
          }
        </div>
        @if (invalido('codigo')) {
          <span class="mt-1 text-xs text-error">Son 6 dígitos</span>
        }
      </div>

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

  protected readonly celdasIdx = [0, 1, 2, 3, 4, 5];
  protected readonly celdas = signal<string[]>(['', '', '', '', '', '']);

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

  private sincronizar(): void {
    this.form.controls.codigo.setValue(this.celdas().join(''));
    this.form.controls.codigo.markAsDirty();
  }

  private foco(i: number): void {
    document.getElementById(`cod-${i}`)?.focus();
  }

  protected escribir(i: number, valor: string): void {
    const d = valor.replace(/\D/g, '').slice(-1);
    this.celdas.update((c) => c.map((x, j) => (j === i ? d : x)));
    this.sincronizar();
    if (d && i < 5) this.foco(i + 1);
  }

  protected tecla(i: number, e: KeyboardEvent): void {
    if (e.key === 'Backspace' && !this.celdas()[i] && i > 0) {
      this.foco(i - 1);
    } else if (e.key === 'ArrowLeft' && i > 0) {
      this.foco(i - 1);
    } else if (e.key === 'ArrowRight' && i < 5) {
      this.foco(i + 1);
    }
  }

  protected pegar(e: ClipboardEvent): void {
    const texto = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 6);
    if (!texto) return;
    e.preventDefault();
    this.celdas.set(Array.from({ length: 6 }, (_, j) => texto[j] ?? ''));
    this.sincronizar();
    this.foco(Math.min(texto.length, 5));
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
