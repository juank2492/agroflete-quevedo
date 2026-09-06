import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { MetricasOperativas } from '@agroflete/shared';
import { Api } from './api';

@Injectable({ providedIn: 'root' })
export class MetricasService {
  private readonly api = inject(Api);

  obtener(): Observable<MetricasOperativas> {
    return this.api.get<MetricasOperativas>('/admin/metricas');
  }
}
