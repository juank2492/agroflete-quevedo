import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  PagarPasarelaRequest,
  RegistrarDepositoRequest,
  ResultadoPago,
  RevisarPagoRequest,
  Solicitud,
} from '@agroflete/shared';
import { Api } from './api';

@Injectable({ providedIn: 'root' })
export class PagoService {
  private readonly api = inject(Api);

  pagarPasarela(solicitudId: string, body: PagarPasarelaRequest): Observable<ResultadoPago> {
    return this.api.post<ResultadoPago>(`/solicitudes/${solicitudId}/pago/pasarela`, body);
  }

  registrarDeposito(
    solicitudId: string,
    body: RegistrarDepositoRequest,
  ): Observable<ResultadoPago> {
    return this.api.post<ResultadoPago>(`/solicitudes/${solicitudId}/pago/deposito`, body);
  }

  enRevision(): Observable<Solicitud[]> {
    return this.api.get<Solicitud[]>('/admin/pagos');
  }

  revisar(solicitudId: string, body: RevisarPagoRequest): Observable<ResultadoPago> {
    return this.api.post<ResultadoPago>(`/admin/pagos/${solicitudId}/revision`, body);
  }
}
