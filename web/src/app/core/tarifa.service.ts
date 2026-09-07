import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  Acopio,
  ActualizarReglasRequest,
  CultivoOpcion,
  EstimacionTarifaRequest,
  EstimacionTarifaResponse,
  ReglasTarifa,
} from '@agroflete/shared';
import { Api } from './api';

@Injectable({ providedIn: 'root' })
export class TarifaService {
  private readonly api = inject(Api);

  listarAcopios(): Observable<Acopio[]> {
    return this.api.get<Acopio[]>('/acopios');
  }

  listarCultivos(): Observable<CultivoOpcion[]> {
    return this.api.get<CultivoOpcion[]>('/cultivos');
  }

  obtenerReglas(): Observable<ReglasTarifa> {
    return this.api.get<ReglasTarifa>('/tarifas/reglas');
  }

  actualizarReglas(patch: ActualizarReglasRequest): Observable<ReglasTarifa> {
    return this.api.put<ReglasTarifa>('/tarifas/reglas', patch);
  }

  estimar(body: EstimacionTarifaRequest): Observable<EstimacionTarifaResponse> {
    return this.api.post<EstimacionTarifaResponse>('/solicitudes/estimacion', body);
  }
}
