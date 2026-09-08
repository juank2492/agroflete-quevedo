import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Notificacion } from '@agroflete/shared';
import { Api } from './api';

@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private readonly api = inject(Api);

  listar(): Observable<Notificacion[]> {
    return this.api.get<Notificacion[]>('/notificaciones');
  }

  marcarLeida(id: string): Observable<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>(`/notificaciones/${id}/leida`, {});
  }

  marcarTodasLeidas(): Observable<{ marcadas: number }> {
    return this.api.post<{ marcadas: number }>('/notificaciones/leer-todas', {});
  }
}
