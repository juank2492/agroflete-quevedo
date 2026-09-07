import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { ActualizarAjustesRequest, AjustesOperacion } from '@agroflete/shared';
import { Api } from './api';

@Injectable({ providedIn: 'root' })
export class AjustesService {
  private readonly api = inject(Api);

  obtener(): Observable<AjustesOperacion> {
    return this.api.get<AjustesOperacion>('/admin/ajustes');
  }

  actualizar(patch: ActualizarAjustesRequest): Observable<AjustesOperacion> {
    return this.api.put<AjustesOperacion>('/admin/ajustes', patch);
  }
}
