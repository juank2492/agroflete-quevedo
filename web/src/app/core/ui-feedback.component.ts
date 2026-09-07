import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiFeedbackService } from './ui-feedback.service';

@Component({
  selector: 'app-ui-feedback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast toast-bottom toast-end z-50">
      @for (t of feedback.toasts(); track t.id) {
        <div
          class="alert shadow-card"
          [class.alert-success]="t.kind === 'success'"
          [class.alert-error]="t.kind === 'error'"
          [class.alert-info]="t.kind === 'info'"
          role="status"
        >
          <span>{{ t.text }}</span>
          <button class="btn btn-ghost btn-xs" (click)="feedback.dismiss(t.id)" aria-label="Cerrar">
            ✕
          </button>
        </div>
      }
    </div>
  `,
})
export class UiFeedbackComponent {
  protected readonly feedback = inject(UiFeedbackService);
}
