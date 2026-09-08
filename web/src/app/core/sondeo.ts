import { DestroyRef, inject } from '@angular/core';

/**
 * Ejecuta `fn` cada `ms` mientras la pestaña esté visible, para reflejar cambios
 * hechos por otros usuarios sin recargar la página. Se detiene solo al destruir
 * el componente. Debe llamarse dentro de un contexto de inyección.
 */
export function sondear(ms: number, fn: () => void): void {
  const ref = inject(DestroyRef);
  const id = setInterval(() => {
    if (typeof document === 'undefined' || !document.hidden) fn();
  }, ms);
  ref.onDestroy(() => clearInterval(id));
}
