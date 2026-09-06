import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import type { Observable } from 'rxjs';
import type {
  ConfirmarRequest,
  LoginRequest,
  LoginResponse,
  RegistroRequest,
  RegistroResponse,
} from '@agroflete/shared';
import { Api } from './api';
import { SessionStore } from './session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(Api);
  private readonly session = inject(SessionStore);

  readonly claims = this.session.claims;
  readonly role = this.session.role;
  readonly isAuthenticated = this.session.isAuthenticated;
  readonly nombre = this.session.nombre;

  registrar(body: RegistroRequest): Observable<RegistroResponse> {
    return this.api.post<RegistroResponse>('/auth/registro', body);
  }

  confirmar(body: ConfirmarRequest): Observable<void> {
    return this.api.post<void>('/auth/confirmar', body);
  }

  login(body: LoginRequest): Observable<LoginResponse> {
    return this.api
      .post<LoginResponse>('/auth/login', body)
      .pipe(tap((res) => this.session.set(res.token)));
  }

  logout(): void {
    this.session.clear();
  }

  homePath(): string {
    return this.session.homePath();
  }
}
