import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiFeedbackComponent } from './core/ui-feedback.component';
import { UiFeedbackService } from './core/ui-feedback.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UiFeedbackComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <app-ui-feedback />
  `,
})
export class App {
  // Instancia temprana para que los toasts estén disponibles globalmente.
  protected readonly feedback = inject(UiFeedbackService);
}
