import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AsignarFleteRequest,
  CambiarEstadoFleteRequest,
  EstadoFlete,
  Flete,
  RegistrarIncidenciaRequest,
  RegistrarUbicacionRequest,
  RegistrarUbicacionResponse,
  UbicacionFlete,
} from '@agroflete/shared';
import { Api } from './api';

@Injectable({ providedIn: 'root' })
export class FleteService {
  private readonly api = inject(Api);

  asignar(body: AsignarFleteRequest): Observable<Flete> {
    return this.api.post<Flete>('/fletes', body);
  }

  /** Solo admin: reasigna un flete en curso. */
  reasignar(id: string, vehiculoId: string): Observable<Flete> {
    return this.api.post<Flete>(`/fletes/${id}/reasignar`, { vehiculoId });
  }

  listar(estado?: EstadoFlete): Observable<Flete[]> {
    return this.api.get<Flete[]>('/fletes', estado ? { estado } : undefined);
  }

  obtener(id: string): Observable<Flete> {
    return this.api.get<Flete>(`/fletes/${id}`);
  }

  cambiarEstado(id: string, body: CambiarEstadoFleteRequest): Observable<Flete> {
    return this.api.patch<Flete>(`/fletes/${id}/estado`, body);
  }

  /** Transportista dueño o admin: reporta una incidencia. */
  reportarIncidencia(id: string, body: RegistrarIncidenciaRequest): Observable<Flete> {
    return this.api.patch<Flete>(`/fletes/${id}/incidencia`, body);
  }

  /** Transportista dueño o admin: reporta la posición. */
  registrarUbicacion(
    id: string,
    body: RegistrarUbicacionRequest,
  ): Observable<RegistrarUbicacionResponse> {
    return this.api.post<RegistrarUbicacionResponse>(`/fletes/${id}/ubicacion`, body);
  }

  ruta(id: string): Observable<UbicacionFlete[]> {
    return this.api.get<UbicacionFlete[]>(`/fletes/${id}/ruta`);
  }
}
