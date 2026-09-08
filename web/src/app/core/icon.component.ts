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
  dollar:
    'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20ZM16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 18V6',
  receipt:
    'M12 17V7M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Zm-8 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  check: 'M20 6 9 17l-5-5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  x: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 1 0 0-8Z',
  users:
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  box: 'M3 8v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8M2 3h20v5H2zM10 12h4',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4',
  help: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z',
  trash:
    'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6M10 11v6M14 11v6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  'eye-off':
    'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 4.2A10.9 10.9 0 0 1 12 4c6.5 0 10 7 10 7a17.7 17.7 0 0 1-3.3 4M6.6 6.6A17.6 17.6 0 0 0 2 11s3.5 7 10 7a10.7 10.7 0 0 0 5-1.2',
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
