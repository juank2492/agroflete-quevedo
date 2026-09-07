import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from './confirm.service';

/** Contrato para pantallas que requieren confirmación al salir. */
export interface PuedeDesactivar {
  hayCambiosSinGuardar(): boolean;
}

/** Confirma la salida de una pantalla con cambios sin guardar. */
export const unsavedChangesGuard: CanDeactivateFn<PuedeDesactivar> = (cmp) => {
  if (!cmp.hayCambiosSinGuardar()) return true;
  return inject(ConfirmService).ask({
    titulo: 'Cambios sin guardar',
    mensaje: 'Si sales de esta pantalla perderás los cambios que no has guardado.',
    confirmar: 'Salir sin guardar',
    cancelar: 'Seguir editando',
    peligro: true,
  });
};
