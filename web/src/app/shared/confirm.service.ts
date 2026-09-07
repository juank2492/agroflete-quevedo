import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  titulo: string;
  mensaje: string;
  confirmar?: string;
  cancelar?: string;
  peligro?: boolean;
}

interface Peticion extends ConfirmOptions {
  resolver: (aceptado: boolean) => void;
}

/** Gestiona las confirmaciones mostradas por el diálogo global. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _peticion = signal<Peticion | null>(null);
  readonly peticion = this._peticion.asReadonly();

  ask(opts: ConfirmOptions): Promise<boolean> {
    // Cancela la petición anterior para no dejar promesas pendientes.
    this._peticion()?.resolver(false);
    return new Promise((resolve) => this._peticion.set({ ...opts, resolver: resolve }));
  }

  responder(aceptado: boolean): void {
    const p = this._peticion();
    if (!p) return;
    this._peticion.set(null);
    p.resolver(aceptado);
  }
}
