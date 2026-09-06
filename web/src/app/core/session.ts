import { Injectable, computed, signal } from '@angular/core';
import type { JwtClaims, Rol } from '@agroflete/shared';

const TOKEN_KEY = 'agroflete.token';

function decodeJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly _token = signal<string | null>(readToken());

  readonly token = this._token.asReadonly();
  readonly claims = computed<JwtClaims | null>(() => {
    const t = this._token();
    if (!t) return null;
    const c = decodeJwt(t);
    if (c?.exp && c.exp * 1000 < Date.now()) return null;
    return c;
  });
  readonly isAuthenticated = computed(() => this.claims() !== null);
  readonly role = computed<Rol | null>(() => this.claims()?.role ?? null);
  readonly nombre = computed(() => this.claims()?.name ?? '');

  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* almacenamiento no disponible: la sesión vive solo en memoria */
    }
    this._token.set(token);
  }

  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* noop */
    }
    this._token.set(null);
  }

  homePath(): string {
    switch (this.role()) {
      case 'productor':
        return '/p';
      case 'transportista':
        return '/t';
      case 'admin':
        return '/a';
      default:
        return '/';
    }
  }
}
