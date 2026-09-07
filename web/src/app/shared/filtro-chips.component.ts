import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface OpcionFiltro {
  valor: string;
  etiqueta: string;
}

/** Fila reutilizable de filtros tipo chip. */
@Component({
  selector: 'app-filtro-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap gap-2">
      @for (o of opciones(); track o.valor) {
        <button
          type="button"
          class="btn btn-sm rounded-full"
          [class.btn-primary]="o.valor === valor()"
          [class.btn-ghost]="o.valor !== valor()"
          (click)="valorChange.emit(o.valor)"
        >
          {{ o.etiqueta }}
        </button>
      }
    </div>
  `,
})
export class FiltroChipsComponent {
  readonly opciones = input.required<OpcionFiltro[]>();
  readonly valor = input.required<string>();
  readonly valorChange = output<string>();
}
