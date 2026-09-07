import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiFeedbackComponent } from './core/ui-feedback.component';
import { UiFeedbackService } from './core/ui-feedback.service';
import { ConfirmDialogComponent } from './shared/confirm-dialog.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UiFeedbackComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <app-ui-feedback />
    <app-confirm-dialog />
  `,
})
export class App {
  protected readonly feedback = inject(UiFeedbackService);
}
