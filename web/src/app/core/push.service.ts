import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { Api } from './api';

/** Activa Web Push cuando el Service Worker está habilitado. */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private intentado = false;

  constructor() {
    if (this.swPush.isEnabled) {
      this.swPush.notificationClicks.subscribe((ev) => {
        const url = (ev.notification.data as { url?: string } | undefined)?.url;
        if (url) void this.router.navigateByUrl(url);
      });
    }
  }

  async activar(): Promise<void> {
    if (!this.swPush.isEnabled || this.intentado) return;
    this.intentado = true;
    try {
      const { clave } = await firstValueFrom(
        this.api.get<{ clave: string | null }>('/notificaciones/push/clave-publica'),
      );
      if (!clave) return;
      const sub = await this.swPush.requestSubscription({ serverPublicKey: clave });
      await firstValueFrom(this.api.post('/notificaciones/push/suscripcion', sub.toJSON()));
    } catch {
      // Permiso denegado o navegador sin soporte: no activa Web Push.
    }
  }
}
