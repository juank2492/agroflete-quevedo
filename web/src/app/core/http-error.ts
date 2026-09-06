import { HttpErrorResponse } from '@angular/common/http';
import type { ApiFail } from '@agroflete/shared';

/** Extrae el mensaje legible de una respuesta de error de la API. */
export function apiMessage(err: unknown, fallback = 'No se pudo completar la operación'): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as Partial<ApiFail> | null;
    if (body && typeof body === 'object' && body.error?.message) return body.error.message;
    if (err.status === 0) return 'Sin conexión con el servidor';
  }
  return fallback;
}
