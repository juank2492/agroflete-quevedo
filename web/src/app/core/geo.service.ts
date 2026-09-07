import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { LatLon, LugarGeocodificado, RutaVialDTO } from '@agroflete/shared';
import { Api } from './api';

/** Acceso del frontend a geocodificación y rutas. */
@Injectable({ providedIn: 'root' })
export class GeoService {
  private readonly api = inject(Api);

  buscar(q: string): Observable<LugarGeocodificado[]> {
    return this.api.get<LugarGeocodificado[]>('/geo/buscar', { q });
  }

  /** Obtiene una ruta por carretera. */
  ruta(origen: LatLon, destino: LatLon): Observable<RutaVialDTO> {
    return this.api.get<RutaVialDTO>('/geo/ruta', {
      olat: origen.lat,
      olon: origen.lon,
      dlat: destino.lat,
      dlon: destino.lon,
    });
  }
}
