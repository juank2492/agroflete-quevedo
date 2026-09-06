import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  ActualizarVehiculoRequest,
  RegistrarVehiculoRequest,
  Vehiculo,
} from '@agroflete/shared';
import { Api } from './api';

@Injectable({ providedIn: 'root' })
export class VehiculoService {
  private readonly api = inject(Api);

  mios(): Observable<Vehiculo[]> {
    return this.api.get<Vehiculo[]>('/vehiculos/mios');
  }

  registrar(body: RegistrarVehiculoRequest): Observable<Vehiculo> {
    return this.api.post<Vehiculo>('/vehiculos', body);
  }

  actualizar(id: string, patch: ActualizarVehiculoRequest): Observable<Vehiculo> {
    return this.api.patch<Vehiculo>(`/vehiculos/${id}`, patch);
  }

  compatibles(solicitudId: string): Observable<Vehiculo[]> {
    return this.api.get<Vehiculo[]>('/vehiculos/compatibles', { solicitudId });
  }
}
