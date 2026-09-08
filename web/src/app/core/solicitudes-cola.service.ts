import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import type { CrearSolicitudRequest } from '@agroflete/shared';
import { Api } from './api';
import { idb } from './idb';
import { UiFeedbackService } from './ui-feedback.service';

const STORE = 'solicitudes-cola';

export interface SolicitudEnCola {
  /** Se reutiliza como clave de idempotencia. */
  id: string;
  body: CrearSolicitudRequest;
  resumen: string;
  createdAt: string;
}

/** Cola offline persistida en IndexedDB y protegida contra duplicados. */
@Injectable({ providedIn: 'root' })
export class SolicitudesColaService {
  private readonly api = inject(Api);
  private readonly feedback = inject(UiFeedbackService);

  readonly cola = signal<SolicitudEnCola[]>([]);
  readonly enviadas = signal(0);

  constructor() {
    void this.cargar().then(() => this.flush());
    window.addEventListener('online', () => this.flush());
  }

  private async cargar(): Promise<void> {
    const items = await idb.todos<SolicitudEnCola>(STORE);
    this.cola.set(items.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }

  async encolar(item: SolicitudEnCola): Promise<void> {
    await idb.guardar(STORE, item);
    this.cola.update((l) => [...l, item]);
  }

  static esFalloDeRed(err: unknown): boolean {
    return !navigator.onLine || (err instanceof HttpErrorResponse && err.status === 0);
  }

  async flush(): Promise<void> {
    if (!navigator.onLine) return;
    let hubo = 0;
    for (const item of [...this.cola()]) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.api
            .post('/solicitudes', item.body)
            .subscribe({ next: () => resolve(), error: reject });
        });
        await idb.quitar(STORE, item.id);
        this.cola.update((l) => l.filter((x) => x.id !== item.id));
        hubo++;
      } catch (err) {
        if (SolicitudesColaService.esFalloDeRed(err)) break; // Reintenta al recuperar la conexión.
        // Un rechazo del servidor no debe bloquear la cola.
        await idb.quitar(STORE, item.id);
        this.cola.update((l) => l.filter((x) => x.id !== item.id));
        this.feedback.error(`No se pudo enviar una solicitud guardada: ${item.resumen}`);
      }
    }
    if (hubo > 0) {
      this.enviadas.update((n) => n + hubo);
      this.feedback.success(
        hubo === 1
          ? 'Se envió 1 solicitud que estaba pendiente'
          : `Se enviaron ${hubo} solicitudes pendientes`,
      );
    }
  }
}
