import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';
import type { ApiOk } from '@agroflete/shared';
import { environment } from '../../environments/environment';

type QueryValue = string | number | boolean | undefined | null;

function toParams(query?: Record<string, QueryValue>): HttpParams | undefined {
  if (!query) return undefined;
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

/** Cliente HTTP fino: agrega la baseUrl y desenvuelve `{ data }`. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  get<T>(path: string, query?: Record<string, QueryValue>): Observable<T> {
    return this.http
      .get<ApiOk<T>>(this.base + path, { params: toParams(query) })
      .pipe(map((r) => r.data));
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<ApiOk<T>>(this.base + path, body ?? {}).pipe(map((r) => r.data));
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http.put<ApiOk<T>>(this.base + path, body ?? {}).pipe(map((r) => r.data));
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http.patch<ApiOk<T>>(this.base + path, body ?? {}).pipe(map((r) => r.data));
  }
}
