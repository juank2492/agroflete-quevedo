import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  ActualizarVehiculoRequest,
  CrearTransportistaRequest,
  CrearTransportistaResponse,
  CrearVehiculoAdminRequest,
  PerfilPublico,
  Vehiculo,
} from '@agroflete/shared';
import { Api } from './api';

/** Operaciones de flota del administrador. */
@Injectable({ providedIn: 'root' })
export class FlotaService {
  private readonly api = inject(Api);

  listarTransportistas(): Observable<PerfilPublico[]> {
    return this.api.get<PerfilPublico[]>('/admin/transportistas');
  }

  crearTransportista(body: CrearTransportistaRequest): Observable<CrearTransportistaResponse> {
    return this.api.post<CrearTransportistaResponse>('/admin/transportistas', body);
  }

  cambiarActividad(id: string, activo: boolean): Observable<PerfilPublico> {
    return this.api.patch<PerfilPublico>(`/admin/transportistas/${id}`, { activo });
  }

  listarVehiculos(): Observable<Vehiculo[]> {
    return this.api.get<Vehiculo[]>('/admin/vehiculos');
  }

  crearVehiculo(body: CrearVehiculoAdminRequest): Observable<Vehiculo> {
    return this.api.post<Vehiculo>('/admin/vehiculos', body);
  }

  editarVehiculo(id: string, body: ActualizarVehiculoRequest): Observable<Vehiculo> {
    return this.api.patch<Vehiculo>(`/admin/vehiculos/${id}`, body);
  }
}
