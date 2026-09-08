import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';

export interface SerieDia {
  nombre: string;
  color: string;
  puntos: { fecha: string; cantidad: number }[];
}

const RIEL = 'var(--color-base-300, #e5e7eb)';
const EJE = 'color-mix(in oklab, var(--color-base-content, #1f2937) 28%, transparent)';
const TENUE = 'color-mix(in oklab, var(--color-base-content, #1f2937) 55%, transparent)';
const PLOT = { x0: 9, x1: 99, y0: 4, y1: 28 };

/**
 * Gráfico de barras agrupadas por día, con eje X/Y, rejilla y **tooltip
 * interactivo** al pasar el puntero. SVG puro, sin librerías.
 */
@Component({
  selector: 'app-grafico-actividad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .barra {
      transform-box: fill-box;
      transform-origin: center bottom;
      animation: actividad-sube 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    @keyframes actividad-sube {
      from {
        transform: scaleY(0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .barra {
        animation: none;
      }
    }
  `,
  template: `
    <div
      #cont
      class="relative"
      (mousemove)="mover($event.clientX)"
      (mouseleave)="activo.set(null)"
      (touchstart)="mover($event.touches[0]?.clientX)"
      (touchmove)="mover($event.touches[0]?.clientX)"
      (touchend)="activo.set(null)"
    >
      @if (series().length > 1) {
        <div class="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-base-content/70">
          @for (s of series(); track s.nombre) {
            <span class="inline-flex items-center gap-1.5">
              <span class="inline-block h-2 w-2 rounded-full" [style.background]="s.color"></span>
              {{ s.nombre }}
            </span>
          }
        </div>
      }

      <svg viewBox="0 0 100 36" class="w-full select-none" role="img" [attr.aria-label]="resumen()">
        @for (g of grid(); track g.v) {
          <line
            [attr.x1]="plot.x0"
            [attr.x2]="plot.x1"
            [attr.y1]="g.y"
            [attr.y2]="g.y"
            [attr.stroke]="riel"
            stroke-width="0.3"
            stroke-dasharray="1 1.5"
          />
          <text
            [attr.x]="plot.x0 - 2"
            [attr.y]="g.y + 1"
            text-anchor="end"
            font-size="2.6"
            [attr.fill]="tenue"
          >
            {{ g.v }}
          </text>
        }

        <line
          [attr.x1]="plot.x0"
          [attr.x2]="plot.x0"
          [attr.y1]="plot.y0"
          [attr.y2]="plot.y1"
          [attr.stroke]="eje"
          stroke-width="0.4"
        />
        <line
          [attr.x1]="plot.x0"
          [attr.x2]="plot.x1"
          [attr.y1]="plot.y1"
          [attr.y2]="plot.y1"
          [attr.stroke]="eje"
          stroke-width="0.4"
        />

        @if (activo() !== null) {
          <rect
            [attr.x]="bandaX()"
            [attr.y]="plot.y0"
            [attr.width]="slot()"
            [attr.height]="plot.y1 - plot.y0"
            [attr.fill]="tenue"
            opacity="0.09"
          />
        }

        @for (col of columnas(); track col.i) {
          @for (b of col.barras; track b.nombre) {
            @if (b.h > 0) {
              <rect
                class="barra"
                [attr.x]="b.x"
                [attr.y]="b.y"
                [attr.width]="b.w"
                [attr.height]="b.h"
                rx="0.4"
                [attr.fill]="b.color"
                [style.animation-delay.ms]="col.i * 20"
              />
            }
          }
          <line
            [attr.x1]="col.cx"
            [attr.x2]="col.cx"
            [attr.y1]="plot.y1"
            [attr.y2]="plot.y1 + 0.8"
            [attr.stroke]="eje"
            stroke-width="0.3"
          />
          @if (col.i % 2 === 0) {
            <text [attr.x]="col.cx" y="34" text-anchor="middle" font-size="2.6" [attr.fill]="tenue">
              {{ col.etiqueta }}
            </text>
          }
        }
      </svg>

      @if (tip(); as t) {
        <div
          class="pointer-events-none absolute top-9 z-10 w-max max-w-52 -translate-x-1/2 rounded-box border border-base-300 bg-base-100 px-3 py-2 text-xs shadow-card"
          [style.left.%]="t.left"
        >
          <div class="font-semibold">{{ t.fecha }}</div>
          @for (r of t.filas; track r.nombre) {
            <div class="mt-1 flex items-center justify-between gap-4">
              <span class="inline-flex items-center gap-1.5">
                <span class="inline-block h-2 w-2 rounded-full" [style.background]="r.color"></span>
                {{ r.nombre }}
              </span>
              <span class="font-semibold">{{ r.valor }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class GraficoActividadComponent {
  readonly series = input.required<SerieDia[]>();
  private readonly cont = viewChild.required<ElementRef<HTMLElement>>('cont');

  protected readonly plot = PLOT;
  protected readonly riel = RIEL;
  protected readonly eje = EJE;
  protected readonly tenue = TENUE;

  protected readonly activo = signal<number | null>(null);

  private readonly n = computed(() => Math.max(1, this.series()[0]?.puntos.length ?? 0));
  protected readonly slot = computed(() => (PLOT.x1 - PLOT.x0) / this.n());

  private readonly maxY = computed(() => {
    const m = Math.max(1, ...this.series().flatMap((s) => s.puntos.map((p) => p.cantidad)));
    return Math.ceil(m / 2) * 2;
  });

  protected readonly grid = computed(() => {
    const my = this.maxY();
    return [0, my / 2, my].map((v) => ({ v, y: this.y(v) }));
  });

  private cx(i: number): number {
    return PLOT.x0 + this.slot() * (i + 0.5);
  }

  private y(v: number): number {
    return PLOT.y1 - (v / this.maxY()) * (PLOT.y1 - PLOT.y0);
  }

  protected readonly columnas = computed(() => {
    const ss = this.series();
    const k = Math.max(1, ss.length);
    const slot = this.slot();
    const bw = Math.min(2.6, (slot * 0.72) / k);
    const grupoW = bw * k + 0.5 * (k - 1);
    const pts = ss[0]?.puntos ?? [];
    const rango = PLOT.y1 - PLOT.y0;
    return pts.map((p, i) => {
      const cx = this.cx(i);
      const inicio = cx - grupoW / 2;
      return {
        i,
        cx,
        etiqueta: fechaCorta(p.fecha),
        barras: ss.map((s, j) => {
          const val = s.puntos[i]?.cantidad ?? 0;
          const h = val > 0 ? Math.max(0.5, (val / this.maxY()) * rango) : 0;
          return {
            nombre: s.nombre,
            color: s.color,
            x: inicio + j * (bw + 0.5),
            w: bw,
            h,
            y: PLOT.y1 - h,
          };
        }),
      };
    });
  });

  protected readonly bandaX = computed(() => PLOT.x0 + this.slot() * (this.activo() ?? 0));

  protected readonly tip = computed(() => {
    const i = this.activo();
    if (i === null) return null;
    const ss = this.series();
    const p0 = ss[0]?.puntos[i];
    if (!p0) return null;
    return {
      fecha: fechaCorta(p0.fecha),
      left: Math.min(90, Math.max(10, this.cx(i))),
      filas: ss.map((s) => ({
        nombre: s.nombre,
        color: s.color,
        valor: s.puntos[i]?.cantidad ?? 0,
      })),
    };
  });

  protected readonly resumen = computed(() =>
    this.series()
      .map((s) => `${s.nombre}: ${s.puntos.reduce((a, p) => a + p.cantidad, 0)} en total`)
      .join('; '),
  );

  protected mover(clientX: number | undefined): void {
    if (clientX === undefined) return;
    const r = this.cont().nativeElement.getBoundingClientRect();
    if (r.width === 0) return;
    const frac = (clientX - r.left) / r.width;
    const t = (frac - PLOT.x0 / 100) / ((PLOT.x1 - PLOT.x0) / 100);
    const i = Math.round(t * (this.n() - 1));
    this.activo.set(Math.min(this.n() - 1, Math.max(0, i)));
  }
}

function fechaCorta(valor: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(valor);
  return m ? `${m[2]}/${m[1]}` : valor;
}
