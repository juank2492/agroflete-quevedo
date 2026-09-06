import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';

/** Contador que anima de 0 al valor objetivo cuando entra en viewport. */
@Component({
  selector: 'app-stat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-box bg-base-100 p-6 text-center shadow-card">
      <div class="font-display text-3xl font-bold text-primary sm:text-4xl">
        {{ prefijo }}{{ display() }}{{ sufijo }}
      </div>
      <p class="mt-1 text-sm text-base-content/70">{{ etiqueta }}</p>
    </div>
  `,
})
export class StatComponent implements AfterViewInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  @Input({ required: true }) valor!: number;
  @Input({ required: true }) etiqueta!: string;
  @Input() prefijo = '';
  @Input() sufijo = '';
  @Input() decimales = 0;

  readonly display = signal('0');

  ngAfterViewInit(): void {
    const start = () => this.animar();
    if (typeof IntersectionObserver === 'undefined') {
      start();
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          start();
          this.observer?.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    this.observer.observe(this.el.nativeElement);
  }

  private animar(): void {
    const dur = 1100;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      this.display.set((this.valor * eased).toFixed(this.decimales));
      if (p < 1) requestAnimationFrame(tick);
      else this.display.set(this.valor.toFixed(this.decimales));
    };
    requestAnimationFrame(tick);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
