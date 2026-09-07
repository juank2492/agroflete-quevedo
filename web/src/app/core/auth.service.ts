import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import type { Observable } from 'rxjs';
import type {
  ActualizarPerfilRequest,
  CambiarPasswordRequest,
  ConfirmarRequest,
  LoginRequest,
  LoginResponse,
  PerfilPublico,
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

  private readonly _perfil = signal<PerfilPublico | null>(null);
  readonly perfil = this._perfil.asReadonly();

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
    this._perfil.set(null);
    this.session.clear();
  }

  cargarPerfil(): Observable<PerfilPublico> {
    return this.api.get<PerfilPublico>('/perfil').pipe(tap((p) => this._perfil.set(p)));
  }

  actualizarPerfil(body: ActualizarPerfilRequest): Observable<PerfilPublico> {
    return this.api.patch<PerfilPublico>('/perfil', body).pipe(
      tap((p) => {
        this._perfil.set(p);
        this.session.setNombre(p.nombreCompleto);
      }),
    );
  }

  cambiarPassword(body: CambiarPasswordRequest): Observable<void> {
    return this.api.post<void>('/perfil/password', body);
  }

  homePath(): string {
    return this.session.homePath();
  }
}
