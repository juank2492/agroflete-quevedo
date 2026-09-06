import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UiFeedbackService } from '../core/ui-feedback.service';

@Component({
  selector: 'app-landing-contacto',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="container-page max-w-xl py-16">
      <h1 class="text-3xl font-bold sm:text-4xl">Contacto</h1>
      <p class="mt-3 text-base-content/70">
        ¿Eres parte de una comercializadora agrícola de Quevedo? Escríbenos y coordinamos una demo.
      </p>

      <form [formGroup]="form" (ngSubmit)="enviar()" class="mt-8 space-y-4">
        <label class="form-control w-full">
          <span class="label-text mb-1">Nombre</span>
          <input type="text" formControlName="nombre" class="input input-bordered w-full" />
        </label>
        <label class="form-control w-full">
          <span class="label-text mb-1">Correo</span>
          <input type="email" formControlName="email" class="input input-bordered w-full" />
        </label>
        <label class="form-control w-full">
          <span class="label-text mb-1">Mensaje</span>
          <textarea
            formControlName="mensaje"
            rows="4"
            class="textarea textarea-bordered w-full"
          ></textarea>
        </label>
        <button type="submit" class="btn btn-primary rounded-full" [disabled]="form.invalid">
          Enviar
        </button>
        @if (enviado()) {
          <p class="text-sm text-success">
            Gracias. Este formulario aún no envía datos: es una maqueta para la defensa.
          </p>
        }
      </form>
    </section>
  `,
})
export class ContactoComponent {
  private readonly fb = inject(FormBuilder);
  private readonly feedback = inject(UiFeedbackService);
  protected readonly enviado = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    mensaje: ['', [Validators.required, Validators.minLength(10)]],
  });

  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviado.set(true);
    this.feedback.info('Mensaje registrado localmente (maqueta).');
    this.form.reset();
  }
}
