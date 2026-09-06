import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AsignarFleteRequest,
  CambiarEstadoFleteRequest,
  EstadoFlete,
  Flete,
} from '@agroflete/shared';
import { Api } from './api';

@Injectable({ providedIn: 'root' })
export class FleteService {
  private readonly api = inject(Api);

  /** admin */
  asignar(body: AsignarFleteRequest): Observable<Flete> {
    return this.api.post<Flete>('/fletes', body);
  }

  listar(estado?: EstadoFlete): Observable<Flete[]> {
    return this.api.get<Flete[]>('/fletes', estado ? { estado } : undefined);
  }

  obtener(id: string): Observable<Flete> {
    return this.api.get<Flete>(`/fletes/${id}`);
  }

  /** transportista dueño o admin (L5) */
  cambiarEstado(id: string, body: CambiarEstadoFleteRequest): Observable<Flete> {
    return this.api.patch<Flete>(`/fletes/${id}/estado`, body);
  }
}
