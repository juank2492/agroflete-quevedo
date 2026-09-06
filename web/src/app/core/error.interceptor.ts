import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import type { ApiFail } from '@agroflete/shared';
import { SessionStore } from './session';
import { UiFeedbackService } from './ui-feedback.service';

function mensajeDe(err: HttpErrorResponse): string {
  const body = err.error as Partial<ApiFail> | string | null;
  if (body && typeof body === 'object' && body.error?.message) return body.error.message;
  if (err.status === 0) return 'Sin conexión con el servidor';
  return 'Ocurrió un error inesperado';
}

/** Convierte errores HTTP en toasts y desloguea ante 401. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const feedback = inject(UiFeedbackService);
  const session = inject(SessionStore);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 401 && session.isAuthenticated()) {
          session.clear();
          void router.navigate(['/auth/login']);
        }
        // 422 se muestra en el formulario; el resto va a toast.
        if (err.status !== 422) feedback.error(mensajeDe(err));
      }
      return throwError(() => err);
    }),
  );
};
