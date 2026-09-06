import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ESTADOS_FLETE, type EstadoFlete, type Flete } from '@agroflete/shared';
import { FleteService } from '../core/flete.service';
import { EstadoBadgeComponent } from '../shared/estado-badge.component';

type Filtro = EstadoFlete | 'TODOS';

@Component({
  selector: 'app-fletes-admin',
  imports: [DatePipe, DecimalPipe, EstadoBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-4xl">
      <h1 class="text-2xl font-bold">Fletes</h1>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          class="btn btn-sm rounded-full"
          [class.btn-primary]="filtro() === 'TODOS'"
          [class.btn-ghost]="filtro() !== 'TODOS'"
          (click)="filtrar('TODOS')"
        >
          Todos
        </button>
        @for (e of estados; track e) {
          <button
            class="btn btn-sm rounded-full"
            [class.btn-primary]="filtro() === e"
            [class.btn-ghost]="filtro() !== e"
            (click)="filtrar(e)"
          >
            {{ e }}
          </button>
        }
      </div>

      @if (cargando()) {
        <div class="mt-6 h-40 animate-pulse rounded-box bg-base-300"></div>
      } @else if (fletes().length === 0) {
        <p class="mt-8 rounded-box bg-base-100 p-6 text-center text-base-content/70 shadow-card">
          No hay fletes en este estado.
        </p>
      } @else {
        <div
          class="mt-6 overflow-x-auto rounded-box border border-base-300 bg-base-100 shadow-card"
        >
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Estado</th>
                <th class="text-right">Tarifa</th>
                <th>Creado</th>
              </tr>
            </thead>
            <tbody>
              @for (f of fletes(); track f.id) {
                <tr>
                  <td class="font-mono text-xs">{{ f.id.slice(0, 8) }}…</td>
                  <td><app-estado-badge [estado]="f.estado" /></td>
                  <td class="text-right font-semibold text-primary">
                    $ {{ f.tarifa | number: '1.2-2' }}
                  </td>
                  <td class="text-sm text-base-content/60">{{ f.createdAt | date: 'short' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class FletesAdminComponent implements OnInit {
  private readonly service = inject(FleteService);

  protected readonly estados = ESTADOS_FLETE;
  protected readonly cargando = signal(true);
  protected readonly fletes = signal<Flete[]>([]);
  protected readonly filtro = signal<Filtro>('TODOS');

  ngOnInit(): void {
    this.cargar();
  }

  filtrar(f: Filtro): void {
    this.filtro.set(f);
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    const f = this.filtro();
    this.service.listar(f === 'TODOS' ? undefined : f).subscribe({
      next: (list) => {
        this.fletes.set(list);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }
}
