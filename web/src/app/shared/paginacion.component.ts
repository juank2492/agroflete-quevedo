import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export function paginar<T>(items: readonly T[], pagina: number, porPagina: number): T[] {
  const inicio = Math.max(0, (pagina - 1) * porPagina);
  return items.slice(inicio, inicio + porPagina);
}

export function totalPaginas(total: number, porPagina: number): number {
  return Math.max(1, Math.ceil(total / porPagina));
}

@Component({
  selector: 'app-paginacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (paginas() > 1) {
      <div class="mt-4 flex items-center justify-between gap-3 text-sm">
        <span class="text-base-content/60">{{ desde() }}–{{ hasta() }} de {{ total() }}</span>
        <div class="join">
          <button
            class="btn btn-sm join-item"
            [disabled]="pagina() <= 1"
            (click)="ir(pagina() - 1)"
          >
            ‹
          </button>
          <span class="btn btn-sm join-item pointer-events-none">
            {{ pagina() }} / {{ paginas() }}
          </span>
          <button
            class="btn btn-sm join-item"
            [disabled]="pagina() >= paginas()"
            (click)="ir(pagina() + 1)"
          >
            ›
          </button>
        </div>
      </div>
    }
  `,
})
export class PaginacionComponent {
  readonly total = input.required<number>();
  readonly pagina = input.required<number>();
  readonly porPagina = input(10);
  readonly paginaChange = output<number>();

  protected readonly paginas = computed(() => totalPaginas(this.total(), this.porPagina()));
  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * this.porPagina() + 1,
  );
  protected readonly hasta = computed(() =>
    Math.min(this.total(), this.pagina() * this.porPagina()),
  );

  protected ir(p: number): void {
    const destino = Math.min(Math.max(1, p), this.paginas());
    if (destino !== this.pagina()) this.paginaChange.emit(destino);
  }
}
