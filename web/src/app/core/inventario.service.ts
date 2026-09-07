import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AjustarStockRequest,
  FijarUmbralesRequest,
  InventarioAcopio,
  StockCultivo,
} from '@agroflete/shared';
import { Api } from './api';

@Injectable({ providedIn: 'root' })
export class InventarioService {
  private readonly api = inject(Api);

  obtener(): Observable<InventarioAcopio[]> {
    return this.api.get<InventarioAcopio[]>('/admin/inventario');
  }

  fijarUmbrales(
    acopioId: string,
    cultivo: string,
    body: FijarUmbralesRequest,
  ): Observable<StockCultivo> {
    return this.api.put<StockCultivo>(`/acopios/${acopioId}/stock/${cultivo}`, body);
  }

  ajustar(acopioId: string, cultivo: string, body: AjustarStockRequest): Observable<StockCultivo> {
    return this.api.post<StockCultivo>(`/acopios/${acopioId}/stock/${cultivo}/ajuste`, body);
  }
}
