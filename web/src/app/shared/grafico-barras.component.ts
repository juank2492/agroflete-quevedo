import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface DatoGrafico {
  etiqueta: string;
  valor: number;
  /** Color CSS de la barra; por defecto el verde primario. */
  color?: string;
}

const COLOR_DEFECTO = 'var(--color-primary, #2f9e5e)';
const COLOR_RIEL = 'var(--color-base-300, #e5e7eb)';
const COLOR_TEXTO = 'var(--color-base-content, #1f2937)';
const COLOR_TEXTO_TENUE =
  'color-mix(in oklab, var(--color-base-content, #1f2937) 55%, transparent)';

/**
 * Gráfico de barras horizontales en SVG puro (sin librerías).
 *
 * Cada barra se mide **contra el total** de la serie: el riel completo = 100 %
 * de los ítems, así se ve el "tope" aunque un valor sea el máximo. La etiqueta
 * de valor muestra `valor / total`.
 */
@Component({
  selector: 'app-grafico-barras',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .barra {
      transform-box: fill-box;
      transform-origin: left center;
      animation: grafico-crecer 0.6s cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    @keyframes grafico-crecer {
      from {
        transform: scaleX(0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .barra {
        animation: none;
      }
    }
  `,
  template: `
    <svg
      [attr.viewBox]="'0 0 100 ' + alto()"
      class="w-full"
      role="img"
      [attr.aria-label]="resumen()"
    >
      @for (b of barras(); track b.etiqueta) {
        <text [attr.x]="0" [attr.y]="b.top + 3.4" font-size="3.6" [attr.fill]="colorTextoTenue">
          {{ b.etiqueta }}
        </text>
        <text
          [attr.x]="100"
          [attr.y]="b.top + 3.4"
          text-anchor="end"
          font-size="3.7"
          font-weight="600"
          [attr.fill]="colorTexto"
        >
          {{ b.etiquetaValor }}
        </text>
        <rect
          [attr.x]="0"
          [attr.y]="b.top + 5.2"
          width="100"
          height="3.8"
          rx="1.9"
          [attr.fill]="colorRiel"
        />
        <rect
          class="barra"
          [attr.x]="0"
          [attr.y]="b.top + 5.2"
          [attr.width]="b.w"
          height="3.8"
          rx="1.9"
          [attr.fill]="b.color"
          [style.animation-delay.ms]="b.i * 60"
        >
          <title>{{ b.etiqueta }}: {{ b.valor }} de {{ total() }}</title>
        </rect>
      }
    </svg>
  `,
})
export class GraficoBarrasComponent {
  readonly datos = input.required<DatoGrafico[]>();

  protected readonly colorTexto = COLOR_TEXTO;
  protected readonly colorTextoTenue = COLOR_TEXTO_TENUE;
  protected readonly colorRiel = COLOR_RIEL;

  protected readonly total = computed(() => this.datos().reduce((a, d) => a + d.valor, 0));

  /** 12 unidades por fila (etiqueta + barra). */
  protected readonly alto = computed(() => Math.max(12, this.datos().length * 12));

  protected readonly barras = computed(() => {
    const total = this.total();
    const t = total || 1;
    return this.datos().map((d, i) => ({
      etiqueta: d.etiqueta,
      valor: d.valor,
      etiquetaValor: `${d.valor}/${total}`,
      w: (d.valor / t) * 100,
      color: d.color ?? COLOR_DEFECTO,
      top: i * 12,
      i,
    }));
  });

  protected readonly resumen = computed(() =>
    this.datos()
      .map((d) => `${d.etiqueta}: ${d.valor} de ${this.total()}`)
      .join(', '),
  );
}
