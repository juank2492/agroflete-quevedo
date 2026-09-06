import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { CrearSolicitudRequest, EstadoSolicitud, Solicitud } from '@agroflete/shared';
import { Api } from './api';

@Injectable({ providedIn: 'root' })
export class SolicitudService {
  private readonly api = inject(Api);

  crear(body: CrearSolicitudRequest): Observable<Solicitud> {
    return this.api.post<Solicitud>('/solicitudes', body);
  }

  listar(estado?: EstadoSolicitud): Observable<Solicitud[]> {
    return this.api.get<Solicitud[]>('/solicitudes', estado ? { estado } : undefined);
  }

  obtener(id: string): Observable<Solicitud> {
    return this.api.get<Solicitud>(`/solicitudes/${id}`);
  }
}
