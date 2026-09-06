import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="container-page flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center"
    >
      <div class="badge badge-outline">En construcción</div>
      <h1 class="text-2xl font-semibold">{{ titulo }}</h1>
      <p class="max-w-md text-base-content/70">{{ detalle }}</p>
      <a routerLink="/" class="btn btn-primary rounded-full">Volver al inicio</a>
    </div>
  `,
})
export class PlaceholderComponent {
  @Input() titulo = 'Módulo en desarrollo';
  @Input() detalle = 'Esta sección se habilita en una fase posterior del plan.';
}
