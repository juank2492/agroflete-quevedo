import { Injectable } from '@angular/core';
import type { PreloadingStrategy, Route } from '@angular/router';
import { type Observable, of } from 'rxjs';

/**
 * Precarga en segundo plano solo las rutas marcadas con `data: { preload: true }`.
 * Se usa para el bundle de `/auth`: así, cuando el visitante de la landing pulsa
 * "Ingresar" / "Crear cuenta", el formulario aparece al instante en lugar de
 * esperar a que se descargue el chunk. El resto de bundles (paneles por rol)
 * siguen cargándose bajo demanda para no penalizar la primera carga móvil.
 */
@Injectable({ providedIn: 'root' })
export class PrecargaSelectiva implements PreloadingStrategy {
  preload(route: Route, cargar: () => Observable<unknown>): Observable<unknown> {
    return route.data?.['preload'] ? cargar() : of(null);
  }
}
