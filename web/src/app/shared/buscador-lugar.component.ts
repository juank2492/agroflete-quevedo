import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  of,
  switchMap,
} from 'rxjs';
import type { LugarGeocodificado } from '@agroflete/shared';
import { GeoService } from '../core/geo.service';

/** Buscador reutilizable de lugares conectado al backend. */
@Component({
  selector: 'app-buscador-lugar',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <input
        type="text"
        class="input input-bordered w-full pr-9"
        [placeholder]="placeholder()"
        [value]="texto()"
        (input)="onInput($any($event.target).value)"
        (keydown)="onKeydown($event)"
        (focus)="siHay()"
        (blur)="cerrarPronto()"
        autocomplete="off"
        role="combobox"
        [attr.aria-expanded]="abierto()"
      />
      @if (texto()) {
        <button
          type="button"
          class="btn btn-circle btn-ghost btn-xs absolute right-1.5 top-1/2 -translate-y-1/2"
          aria-label="Limpiar"
          (click)="limpiar()"
        >
          ✕
        </button>
      }

      @if (abierto()) {
        <ul
          class="absolute z-[1200] mt-1 max-h-60 w-full overflow-y-auto rounded-box border border-base-300 bg-base-100 p-1 shadow-lg"
          role="listbox"
        >
          @if (cargando()) {
            <li class="px-3 py-2 text-sm text-base-content/50">Buscando…</li>
          } @else if (error()) {
            <li class="px-3 py-2 text-sm text-error">{{ error() }}</li>
          } @else if (resultados().length === 0) {
            <li class="px-3 py-2 text-sm text-base-content/50">Sin resultados cerca de Quevedo.</li>
          } @else {
            @for (l of resultados(); track l.nombre + l.lat + l.lon; let i = $index) {
              <li
                role="option"
                [attr.aria-selected]="i === activo()"
                class="cursor-pointer rounded-field px-3 py-2 text-sm"
                [class.bg-base-200]="i === activo()"
                (mousedown)="$event.preventDefault(); elegir(l)"
                (mouseenter)="activo.set(i)"
              >
                <span class="font-medium">{{ l.nombre }}</span>
                <span class="badge badge-ghost badge-sm ml-1 align-middle">{{ l.tipo }}</span>
                <span class="block text-xs text-base-content/60">
                  {{ l.etiqueta }}
                  @if (l.etiqueta && l.distanciaKm >= 1) {
                    ·
                  }
                  @if (l.distanciaKm >= 1) {
                    a {{ l.distanciaKm | number: '1.0-0' }} km
                  } @else {
                    aquí mismo
                  }
                </span>
              </li>
            }
          }
        </ul>
      }
    </div>
  `,
})
export class BuscadorLugarComponent {
  readonly placeholder = input('Escribe una dirección o lugar…');
  readonly selecciona = output<LugarGeocodificado>();
  readonly limpia = output<void>();

  private readonly geo = inject(GeoService);

  protected readonly texto = signal('');
  protected readonly resultados = signal<LugarGeocodificado[]>([]);
  protected readonly abierto = signal(false);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly activo = signal(-1);

  private readonly consulta$ = new Subject<string>();

  constructor() {
    this.consulta$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.trim().length < 3) {
            this.resultados.set([]);
            this.abierto.set(false);
            return EMPTY;
          }
          this.cargando.set(true);
          this.error.set(null);
          this.abierto.set(true);
          return this.geo.buscar(q.trim()).pipe(
            catchError(() => {
              this.error.set('No se pudo buscar direcciones');
              return of<LugarGeocodificado[]>([]);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        this.cargando.set(false);
        this.resultados.set(list);
        this.activo.set(-1);
      });
  }

  protected onInput(valor: string): void {
    this.texto.set(valor);
    this.consulta$.next(valor);
  }

  protected onKeydown(e: KeyboardEvent): void {
    const n = this.resultados().length;
    if (!this.abierto() || n === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activo.set((this.activo() + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activo.set((this.activo() - 1 + n) % n);
    } else if (e.key === 'Enter' && this.activo() >= 0) {
      e.preventDefault();
      this.elegir(this.resultados()[this.activo()]!);
    } else if (e.key === 'Escape') {
      this.abierto.set(false);
    }
  }

  protected elegir(l: LugarGeocodificado): void {
    this.texto.set(l.etiqueta ? `${l.nombre} · ${l.etiqueta}` : l.nombre);
    this.abierto.set(false);
    this.resultados.set([]);
    this.selecciona.emit(l);
  }

  protected limpiar(): void {
    this.texto.set('');
    this.resultados.set([]);
    this.abierto.set(false);
    this.error.set(null);
    this.limpia.emit();
  }

  protected siHay(): void {
    if (this.resultados().length > 0) this.abierto.set(true);
  }

  protected cerrarPronto(): void {
    setTimeout(() => this.abierto.set(false), 150);
  }
}
