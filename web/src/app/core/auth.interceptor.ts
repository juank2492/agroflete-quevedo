import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { SessionStore } from './session';

/** Adjunta `Authorization: Bearer <token>` a las llamadas a la API. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionStore);
  const token = session.token();
  const esApi = req.url.startsWith(environment.apiUrl) || req.url.startsWith('/');

  if (token && esApi) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
