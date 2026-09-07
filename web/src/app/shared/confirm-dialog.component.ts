import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';

/** Diálogo de confirmación global. */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog class="modal" [class.modal-open]="!!svc.peticion()">
      @if (svc.peticion(); as p) {
        <div class="modal-box">
          <h3 class="text-lg font-bold">{{ p.titulo }}</h3>
          <p class="mt-2 text-sm text-base-content/80" style="white-space: pre-line">
            {{ p.mensaje }}
          </p>
          <div class="modal-action">
            <button class="btn btn-ghost" (click)="svc.responder(false)">
              {{ p.cancelar || 'Cancelar' }}
            </button>
            <button
              class="btn rounded-full"
              [class.btn-primary]="!p.peligro"
              [class.btn-error]="p.peligro"
              (click)="svc.responder(true)"
            >
              {{ p.confirmar || 'Confirmar' }}
            </button>
          </div>
        </div>
      }
      <form method="dialog" class="modal-backdrop" (submit)="svc.responder(false)">
        <button>close</button>
      </form>
    </dialog>
  `,
})
export class ConfirmDialogComponent {
  protected readonly svc = inject(ConfirmService);

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.svc.peticion()) this.svc.responder(false);
  }
}
