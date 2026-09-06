import type { Zona } from '@agroflete/shared';

/** Etiqueta legible para una zona logística. */
export function zonaLabel(z: Zona | string): string {
  return z
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}
