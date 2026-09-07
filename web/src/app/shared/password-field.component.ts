import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { ReactiveFormsModule, type FormControl } from '@angular/forms';
import { IconComponent } from '../core/icon.component';

/** Campo de contraseña con mostrar/ocultar y mensaje de error. */
@Component({
  selector: 'app-password-field',
  imports: [ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <label class="form-control w-full">
      <span class="label-text mb-1">{{ label() }}</span>
      <div class="relative">
        <input
          [type]="ver() ? 'text' : 'password'"
          [formControl]="control()"
          [attr.autocomplete]="autocomplete()"
          class="input input-bordered w-full pr-10"
          [class.input-error]="hayError()"
        />
        <button
          type="button"
          class="btn btn-ghost btn-xs absolute right-1 top-1/2 -translate-y-1/2"
          [attr.aria-label]="ver() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          (click)="ver.set(!ver())"
        >
          <app-icon [name]="ver() ? 'eye-off' : 'eye'" [size]="16" />
        </button>
      </div>
      @if (hayError() && error()) {
        <span class="mt-1 text-xs text-error">{{ error() }}</span>
      }
    </label>
  `,
})
export class PasswordFieldComponent {
  readonly control = input.required<FormControl<string>>();
  readonly label = input('Contraseña');
  readonly autocomplete = input('current-password');
  readonly error = input<string>('');

  protected readonly ver = signal(false);

  protected hayError(): boolean {
    const c = this.control();
    return c.invalid && (c.touched || c.dirty);
  }
}
