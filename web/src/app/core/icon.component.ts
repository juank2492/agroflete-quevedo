import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Íconos SVG inline (trazos estilo lucide) para no cargar una fuente de iconos. */
const PATHS: Record<string, string> = {
  truck:
    'M14 18V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1M14 9h4l3 3v5a1 1 0 0 1-1 1h-1M9 18h6M7.5 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm12 0a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  leaf: 'M11 20A7 7 0 0 1 4 13c0-6 5-9 15-9 0 8-4 13-8 15Zm-7 2C6 16 9 12 15 9',
  route:
    'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-2 0h-4a3 3 0 0 0-3 3v2a3 3 0 0 1-3 3',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  chart: 'M3 3v18h18M8 16v-5m5 5V8m5 8v-3',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Zm-8 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  check: 'M20 6 9 17l-5-5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  x: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
};

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path [attr.d]="d" />
    </svg>
  `,
  host: { class: 'inline-flex' },
})
export class IconComponent {
  @Input({ required: true }) name!: keyof typeof PATHS | string;
  @Input() size = 20;

  get d(): string {
    return PATHS[this.name] ?? '';
  }
}
